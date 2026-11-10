# Plan: van Bistro de Borre naar een standalone reservatieproduct

Doel: de huidige app (Next.js 16 + Supabase + Resend, op Vercel) omvormen tot een multi-tenant
SaaS waarop elk restaurant zich kan registreren, zoals easybooker.be. Bistro de Borre wordt de
eerste klant. Het datamodel wordt meteen klaargemaakt voor de latere Google-integratie (Actions Center).

---

## 0. Beslissingen (besproken 2026-11-09)

| Vraag | Beslissing |
|---|---|
| Zelfde repo of nieuwe? | **Deze repo uitbouwen** (later hernoemen naar de productnaam). |
| Supabase-project | **Het bestaande project.** Borre is nog niet live, dus er is geen productiedata: de database mag gereset worden en de migraties 0001–0007 worden geconsolideerd tot één schoon multi-tenant schema. |
| Scope v1 | **Fase 1–4.** Restaurants worden door Joni aangemaakt (script), facturatie manueel. Selfservice-registratie, Stripe en GDPR-automatisatie volgen later. |
| Rollen | Enkel `eigenaar` en `beheerder`. `personeel` later. |
| Prijs | **€65 excl. btw per maand** per restaurant. |
| Productnaam + domein | Werknaam **Tafelvrij** (2026-11-10), op één plek: `src/lib/product.ts`. Domein nog te registreren. |

---

## 1. Huidige situatie: wat is single-tenant?

- `settings` is een singleton (`id = 1`, `check (id = 1)`). Alle code doet `.eq("id", 1)`.
- `shift_templates`, `date_exceptions`, `reservations`, `reservation_logs` en `notifications`
  hebben geen tenant-kolom.
- DB-functies (`create_reservation`, `get_bezetting`, `cancel_reservation`) werken over alle data.
  De capaciteitslock in `create_reservation` filtert enkel op `datum + tijdslot`.
- Beheerder = `app_metadata.role = 'admin'` (0007). Elke admin ziet dus alles.
- **Belangrijk:** admin-pagina's en publieke routes gebruiken de **service-role client**
  (`adminDb()`, `createServiceRoleClient()`). RLS beschermt in de praktijk niets. Bij
  multi-tenant zou één vergeten `.eq("restaurant_id", …)` data van een ander restaurant lekken.
- Tijdzone is hardcoded: `RESTAURANT_TIJDZONE = "Europe/Brussels"` (`src/lib/time.ts`, `src/lib/format.ts`).
- Branding hardcoded in ±18 bestanden: titels, `globals.css` (huisstijl Borre), `embed.js`
  (`window.BistroDeBorre`, `bistro-widget-*`-berichten), mail-afzender.
- De cron (`/api/cron/reminders`) leest één set instellingen en verwerkt alle reservaties.

---

## 2. Doelarchitectuur

### Datamodel

```sql
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  naam text not null,
  tijdzone text not null default 'Europe/Brussels',
  -- contact & locatie (ook nodig voor Google merchant-feed)
  email text, telefoon text, website text,
  straat text, postcode text, gemeente text, land text default 'BE',
  lat double precision, lng double precision,
  google_place_id text,
  -- abonnement
  status text not null default 'proef' check (status in ('proef','actief','achterstallig','opgezegd')),
  proef_tot date, stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create type lid_rol as enum ('eigenaar', 'beheerder', 'personeel');
create table memberships (
  user_id uuid references auth.users on delete cascade,
  restaurant_id uuid references restaurants on delete cascade,
  rol lid_rol not null default 'beheerder',
  primary key (user_id, restaurant_id)
);
```

- `settings`: singleton weg, `restaurant_id uuid primary key references restaurants`.
  `restaurant_naam` en `notificatie_email` verhuizen naar `restaurants`. Extra: `logo_url`,
  `standaard_duur_minuten` (Google heeft een duur per boeking nodig).
- `restaurant_id uuid not null references restaurants on delete cascade` op `shift_templates`,
  `date_exceptions`, `reservations`, `reservation_logs`, `notifications`.
- Indexen herzien: `(restaurant_id, datum, tijdslot)` i.p.v. `(datum, tijdslot)`, idem voor de
  partiële index `idx_reservations_actief`, `(restaurant_id, gelezen)` op notifications.
- `reservations`:
  - `bron` check uitbreiden met `'google'`
  - `externe_id text` + `unique (restaurant_id, bron, externe_id)` (idempotentie voor Google)
  - `duur_minuten int`
- Platformbeheerder (jij): `app_metadata.role = 'platform_admin'`.

### Toegangsmodel (de kern)

Twee strikte paden in plaats van overal de service-role:

1. **Admin = gebruikersclient + RLS.** Admin-pagina's gebruiken de sessie-client
   (`@/lib/supabase/server`). RLS-policies op elke tabel:
   ```sql
   create function is_lid(r uuid) returns boolean language sql stable security definer
     set search_path = public as $$
     select exists (select 1 from memberships where user_id = auth.uid() and restaurant_id = r)
   $$;
   create policy "leden" on reservations for all to authenticated
     using (is_lid(restaurant_id)) with check (is_lid(restaurant_id));
   ```
   Een vergeten filter levert dan hoogstens te weinig data op, nooit andermans data.
   `adminDb()` wordt `restaurantContext(slug)`: haalt het restaurant op via de sessie-client
   (RLS bewijst lidmaatschap) en geeft `{ restaurant, rol, db }` terug.
2. **Publiek/cron = service-role, altijd met expliciet `restaurant_id`.** Enkel in een kleine set
   functies (`laadAvailabilityContext(restaurantId)`, `create_reservation(p_restaurant_id, …)`,
   herinneringen). Deze functies zijn de enige plaatsen waar de service-key gebruikt wordt;
   een ESLint-regel (`no-restricted-imports` op `@/lib/supabase/service` buiten `src/lib/server/**`)
   bewaakt dat.

Realtime (`NotificatieBel`): de RLS-policies gelden ook voor Realtime, plus een filter
`restaurant_id=eq.<id>` op het kanaal.

### Routing

| Wat | Nu | Straks |
|---|---|---|
| Boekingspagina | `/reserveren` | `/{slug}` (bv. `app.<product>.be/bistro-de-borre`) |
| Annuleren | `/reserveren/annuleren/[token]` | `/annuleren/[token]` (token is globaal uniek, restaurant volgt uit de reservatie) |
| Widget (iframe) | `/widget` | `/w/{slug}` |
| Admin | `/admin/...` | `/app/{slug}/...` + `/app` (restaurantkiezer bij meerdere lidmaatschappen) |
| API | `/api/availability`, `/api/reservations` | `/api/r/{slug}/availability`, `/api/r/{slug}/reservations` |
| Platformbeheer | – | `/platform` |

Gereserveerde slugs blokkeren: `app`, `api`, `w`, `annuleren`, `platform`, `login`, `registreren`, …
Eigen domeinen per restaurant (Vercel Domains API) bewust **later**.

---

## 3. Fasering

Schattingen zijn ruwe werkdagen voor één ontwikkelaar.

### Fase 1: Datamodel (2–3 d) ✅ klaar (branch `multi-tenant`)

Gedaan: geconsolideerd schema `supabase/migrations/0001_schema.sql`, seed met twee restaurants,
types bijgewerkt, alle queries in de app filteren op `restaurant_id` (tijdelijk via
`standaardRestaurant()`), databasetests in `tests/db/schema.test.ts`. Extra t.o.v. het plan:
advisory lock in `create_reservation` (de oude `for update` beschermde een nog leeg slot niet),
samengestelde foreign keys zodat een shift/reservatie nooit naar een ander restaurant kan
verwijzen, en `restaurant_naam` + `NOTIFICATION_EMAIL`-fallback verwijderd (naam staat in
`restaurants`, een globale fallback zou meldingen naar het verkeerde restaurant sturen).
Nog te doen bij uitrol: remote database resetten en types opnieuw genereren.

Oorspronkelijk plan:
- Migraties 0001–0007 consolideren tot één schone `0001_schema.sql` met `restaurants`,
  `memberships`, `restaurant_id`-kolommen, indexen en `settings` per restaurant. Daarna de
  bestaande (niet-live) database resetten (`supabase db reset --linked`, eerst testdata exporteren
  als die bewaard moet worden).
- DB-functies herschrijven met `p_restaurant_id`:
  - `create_reservation`: lock en capaciteitscheck op `restaurant_id + datum + tijdslot`; controleren
    dat `shift_template_id` bij hetzelfde restaurant hoort.
  - `get_bezetting(p_restaurant_id, p_van, p_tot)`.
  - `log_and_notify` / trigger: `restaurant_id` overnemen van de reservatie.
- `src/types/database.ts` opnieuw genereren.
- `supabase/seed.sql`: twee test-restaurants met elk eigen shiften en reservaties.

### Fase 2: Toegang & RLS (2–3 d) ✅ klaar (branch `multi-tenant`)

Gedaan: migratie `0002_platform_admins.sql` (superadmins, `is_lid()` geldt ook voor hen,
`get_bezetting`/`create_reservation` ook voor ingelogde beheerders maar enkel voor hun eigen
restaurant), admin via de sessie-client (`adminContext()`), `app_metadata.role` niet meer
gebruikt, meldingen gefilterd per restaurant, pagina `/admin/geen-toegang`, ESLint-regel
tegen de service-key in het beheer, superadmin-tests. De overzichtspagina `/platform` voor
superadmins schuift naar fase 3 (samen met de routing) en vervangt het script uit fase 4b.

Oorspronkelijk plan:
- RLS-policies via `is_lid()`; `is_admin()` vervangen.
- `src/lib/admin/auth.ts` → `restaurantContext(slug)` + `requireRol('eigenaar')` voor instellingen/leden.
- Alle admin-pagina's en server actions (`reservaties`, `shiften`, `instellingen`, `dag`, `dashboard`)
  omzetten naar de gebruikersclient en het restaurant uit de route.
- `src/lib/supabase/middleware.ts`: niet langer de `app_metadata.role`-check, alleen ingelogd zijn
  voor `/app/*`; lidmaatschap wordt in de layout gecontroleerd.
- **Isolatietests** (vitest tegen lokale Supabase): gebruiker van restaurant A kan B niet lezen,
  wijzigen of via realtime ontvangen; publieke API van A toont nooit bezetting van B.

### Fase 3: Routing (2 d) ✅ klaar (branch `multi-tenant`)

Gedaan: `/{slug}`, `/w/{slug}`, `/annuleren/{token}`, `/api/r/{slug}/...`, beheer onder
`/app/{slug}` met restaurantkiezer `/app`, login op `/login`, superadmin-pagina `/platform`
(overzicht, status, restaurant aanmaken, beheerder koppelen; vervangt het script van fase 4b),
`embed.js` met verplicht `data-restaurant`, redirects voor oude URL's, migratie 0003
(gereserveerde slugs, `user_id_voor_email`). `standaardRestaurant()` is weg.
Beperking: een beheerder koppelen kan enkel voor een bestaand account; uitnodigen per mail
(met wachtwoord instellen) volgt bij de onboarding (fase 5).

Oorspronkelijk plan:
- Routes verplaatsen volgens de tabel hierboven; restaurant opzoeken op slug (gecachet), 404 bij
  onbekende slug, nette melding als het abonnement niet actief is.
- `embed.js` herschrijven: verplicht `data-restaurant="slug"`, berichten `<product>-widget-hoogte` /
  `-sluit`, globale API `window.<Product>.open()`. Geen compat-laag nodig (Borre is nog niet live).

### Fase 4: Per-restaurant gedrag (2 d) ✅ klaar (branch `fase-4`)

Gedaan: tijdzone per restaurant in alle datum-/tijdlogica (`vandaagIn`, `datumTijdslotNaarUtc`,
`formatTijdstip`, beschikbaarheid, herinneringen) met tests in een andere zone; mails vertrekken als
`"<Restaurant> via Tafelvrij"` met reply-to naar het contactadres van het restaurant (melding aan het
restaurant: reply-to = gast), logo en accentkleur in de mail; neutrale Tafelvrij-huisstijl, restaurants
krijgen enkel accentkleur, lettertype en logo (klasse `.thema`); logo-upload naar Storage (bucket
`logos`, server-side na RLS-controle); tijdzone en contactadres in de instellingen; geen hardcoded
"Bistro de Borre" meer in de app. Migratie `0004_per_restaurant.sql`: bucket, tijdzonecontrole en een
trigger die verhindert dat beheerders zelf `status`, `proef_tot` of `slug` wijzigen (dat kon via RLS).
Bij uitrol: `EMAIL_FROM_ADRES` instellen, platformdomein in Resend verifiëren.

Oorspronkelijk plan:
- **Tijdzone:** `src/lib/time.ts` en `src/lib/format.ts` krijgen een `tijdzone`-parameter in plaats
  van de constante; `tests/time.test.ts` en `tests/availability.test.ts` uitbreiden met een andere zone.
- **Mail** (`src/lib/email/send.ts`, templates): afzender `"<Restaurantnaam> via <Product>"
  <reservaties@<product>.be>`, `reply_to` = e-mail van het restaurant, kleur en logo uit de
  instellingen, annuleerlink naar `/annuleren/[token]`.
- **Cron herinneringen** (`src/lib/email/reminders.ts`): per restaurant met `herinneringen_actief`
  de eigen instellingen en tijdzone gebruiken; een fout bij één restaurant mag de rest niet stoppen.
  Resend-rate limits in de gaten houden (batchen).
- **Branding:** `globals.css` neutraal maken (producthuisstijl) en per restaurant enkel accentkleur,
  lettertype en logo via CSS-variabelen. Logo-upload naar Supabase Storage (bucket per restaurant-id).
- Alle hardcoded "Bistro de Borre"-teksten verwijderen.

### Fase 4b: Restaurant aanmaken zonder selfservice (0,5 d, hoort bij v1)
- Script `scripts/nieuw-restaurant.ts` (service-key, lokaal uitgevoerd): maakt restaurant + settings
  + standaardshiften aan en nodigt de eigenaar uit per e-mail (Supabase invite) met een `memberships`-rij.
- Bistro de Borre wordt zo het eerste restaurant (`bistro-de-borre`). Omdat Borre nog niet live is,
  is er geen datamigratie en geen compat-laag voor de oude widget nodig: Borre krijgt meteen de nieuwe
  embed-code.

---

**Hieronder: na v1.**

### Fase 5: Onboarding & platformbeheer (3 d)
- `/registreren`: account aanmaken (Supabase Auth, e-mailbevestiging).
- Wizard: naam + slug → adres/contact → openingsuren (shiften) → capaciteit & groepsgrootte →
  klaar: widget-snippet, directe boekingslink, uitleg hoe je de link als "afsprakenlink" in het
  Google Bedrijfsprofiel zet.
- Teamleden uitnodigen (e-mailuitnodiging → `memberships`).
- `/platform` (enkel `platform_admin`): lijst restaurants, status, aantal reservaties, restaurant
  pauzeren.

### Fase 6: Facturatie (2 d)
- Stripe Checkout + Customer Portal; webhook `/api/stripe/webhook` zet `restaurants.status`.
- Proefperiode (`proef_tot`). Na afloop of bij `achterstallig`: korte respijtperiode, daarna geen
  nieuwe online boekingen (admin blijft bereikbaar, bestaande reservaties blijven geldig).

### Fase 7: (vervallen) Borre is nog niet live; zie fase 4b.

### Fase 8: GDPR & juridisch
- De verwerkersovereenkomst en algemene voorwaarden zijn **al nodig voor de eerste betalende klant**
  (geen code, wel vóór livegang regelen). Automatisatie hieronder mag later.
- Je wordt **verwerker** voor de restaurants: verwerkersovereenkomst + algemene voorwaarden.
- Privacyverklaring voor gasten (per restaurant ingevuld).
- Bewaartermijn: persoonsgegevens van reservaties ouder dan bv. 24 maanden automatisch anonimiseren
  (cron), export per restaurant (CSV).

### Daarna: Google
Met dit model zijn de data voor de **merchant-feed** (adres, coördinaten, place-id) en de
**beschikbaarheidsfeed** (bestaande `getBeschikbareSlots` per restaurant) al aanwezig, en ondersteunt
`reservations` boekingen met `bron = 'google'` + idempotente `externe_id`. De Booking Server-endpoints
en de Real-time Updates API komen pas na aanvaarding als Google-partner.

---

## 4. Totaal & risico's

- **v1 (fase 1–4b):** ±9–10 werkdagen.
- **Later (fase 5, 6, 8-automatisatie):** ±6 werkdagen.
- **Grootste risico:** datalek tussen restaurants. Opgevangen door RLS als primaire bescherming,
  service-key beperkt tot één map, en isolatietests in CI.

## 5. Open vragen
1. Definitieve productnaam (werknaam Tafelvrij) en domein registreren.
