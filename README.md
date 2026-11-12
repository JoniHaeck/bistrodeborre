# Tafelvrij — reservaties voor restaurants

"Tafelvrij" is een werknaam (aan te passen in `src/lib/product.ts`). Bistro de Borre is het
eerste restaurant.

Lichtgewicht multi-tenant reservatiesysteem voor restaurants. Gasten reserveren een
kwartierslot en geven aan of ze het menu nemen, zodat de keuken op voorhand
weet hoeveel personen en menu's er verwacht worden.

## Stack

- **Next.js (App Router, TypeScript)** + **Tailwind CSS**
- **Supabase** (Postgres, Auth voor beheerders, Realtime, Row Level Security)
- **Resend** voor transactionele e-mails
- **Vercel** (deploy + Cron Jobs voor herinneringsmails)

## Projectstructuur

```
supabase/
  migrations/        -- SQL-migraties (multi-tenant schema, RLS, functies, realtime)
  seed.sql           -- restaurants Bistro de Borre + Demo Brasserie met weekshiften (idempotent)
src/
  app/
    (public)/        -- publieke reservatiepagina('s)
    widget/          -- embedbare iframe-widget
    admin/           -- beheerdersomgeving (Supabase Auth)
    api/             -- route handlers (reservaties, annuleren, cron, admin)
  components/        -- UI-componenten (public / admin / generiek)
  lib/
    supabase/        -- browser-, server- en service-role-clients
    email/           -- Resend-integratie + templates (stap 4)
    time.ts          -- Europe/Brussels tijdzonehelpers
    availability.ts  -- beschikbaarheidslogica (stap 2)
  types/database.ts  -- gegenereerde Supabase-types
tests/               -- vitest unit tests
public/embed.js      -- embed-script voor de widget (stap 5)
```

## Lokale ontwikkeling

1. Kopieer `.env.example` naar `.env.local` en vul de Supabase-, Resend- en
   cron-gegevens in.
2. `npm install`
3. `npm run dev` — start de Next.js-dev-server.
4. `npm test` — unit tests (vitest), inclusief databasetests van schema en RLS in een
   in-memory Postgres (PGlite, `tests/db/`). Geen Docker of Supabase nodig.

## Supabase

Het project is gelinkt via de Supabase CLI. Migraties toepassen:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Het schema is multi-tenant: elk restaurant (`restaurants`) heeft zijn eigen settings, shiften,
uitzonderingen en reservaties via `restaurant_id`. Zie `docs/multi-tenant-plan.md`.

Een restaurant kan onder **Instellingen → E-mails** optioneel zijn Google-reviewlink
invullen. Deze HTTPS-link verschijnt in de HTML- en tekstversie van de e-mails; zonder
link wordt niets getoond. De mails gebruiken de kleur, het lettertype en het logo van
het restaurant. E-mailprogramma's die het ingestelde lettertype niet hebben, gebruiken
een alternatief lettertype.

Gasten boven de ingestelde maximale groepsgrootte kunnen via de widget een groepsaanvraag
indienen (maximaal 100 personen). Zij kiezen een open shift en tijdstip, ook als het
kwartier vol is. De aanvraag is nog geen reservatie. Onder **Groepsaanvragen** ziet de
beheerder de aanvragen en bevestigt ze na een waarschuwing bij overcapaciteit. De
reservering verschijnt dan in het dagoverzicht en de gast krijgt een bevestigingsmail.
Bij een mislukte mail kan de beheerder die opnieuw versturen vanuit het overzicht.
Een shift kan voor een specifieke dag worden gesloten via het dagoverzicht of via
**Shiften → Uitzonderingen**; bestaande reservaties blijven behouden. Verwijder de
uitzondering onder Shiften om de shift opnieuw boekbaar te maken.

De bevestiging bevat een persoonlijke beheerlink en een downloadbaar `.ics`-agendabestand.
Via de beheerlink kan de gast tot 24 uur voor de reservatie de contactgegevens, menu,
datum, tijd en groepsgrootte wijzigen of annuleren. Nieuwe slots worden opnieuw op
beschikbaarheid en capaciteit gecontroleerd. Voor grotere groepen moet de gast het
restaurant contacteren; een bestaande grotere groep kan op hetzelfde tijdstip behouden
of verkleind worden. Oude annuleerlinks blijven werken en leiden naar dezelfde pagina.
Een gewijzigde reservatie wordt ook opgeslagen als de bevestigingsmail mislukt; dit wordt
uitdrukkelijk gemeld. De beheerlink geeft toegang tot persoonlijke gegevens en moet privé blijven.

Onder **Shiften → Uitzonderingen** kan een optionele einddatum worden ingevuld
(inclusief, maximaal 730 dagen). De uitzondering geldt dan voor alle geselecteerde
dagen; bij een specifieke shift worden dagen zonder die shift overgeslagen. Bestaande
reservaties blijven behouden en bij een impact verschijnt eerst een waarschuwing.
Een periode kan als geheel of per dag worden verwijderd.

Een superadmin kan onder **Platform** een bestaand account koppelen of een nieuwe
beheerder per e-mail uitnodigen. De gastbeheerder kiest zelf een wachtwoord via de
eenmalige uitnodigingslink. Supabase Auth verstuurt de uitnodiging: stel daar SMTP in
en voeg `https://<app-domein>/uitnodiging` toe aan de toegestane redirect-URL's.
`NEXT_PUBLIC_SITE_URL` moet naar het publieke HTTPS-appadres wijzen. Als de mail al
verzonden is maar de koppeling mislukt, kan de superadmin het bestaande account alsnog
koppelen. Een uitnodiging aan een nog onbevestigd uitnodigingsaccount kan opnieuw
worden verstuurd.

Onder **Platform → Beheerders** kunnen superadmins accounts en restaurantkoppelingen
bekijken. Een blokkering geldt onmiddellijk voor één restaurant en kan worden hersteld.
Een account verwijderen is definitief en verwijdert alle restaurantkoppelingen; bestaande
reservaties blijven behouden. Platformbeheerders kunnen via dit scherm niet worden
geblokkeerd of verwijderd. Een bestaande koppeling opnieuw toevoegen heft een blokkering
niet automatisch op: gebruik daarvoor **Toegang herstellen**.

De Nederlandstalige uitnodigingsmail staat in `supabase/templates/uitnodiging.html` en
gebruikt de restaurantnaam uit de uitnodigingsmetadata. Bij een heruitnodiging wordt die
naam bijgewerkt; voor oudere uitnodigingen zonder naam toont de template algemene tekst.
Het lokale sjabloon wordt niet automatisch op het gehoste Supabase-project toegepast:
stel het uitnodigingssjabloon en het onderwerp ook in via Supabase Auth of de Management
API. Gebruik nooit `supabase config push` zonder eerst alle productie-instellingen te
controleren: het lokale bestand kan ook andere Auth-instellingen overschrijven.

Types opnieuw genereren na een schemawijziging:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

De seed-data (`supabase/seed.sql`) is idempotent en kan veilig opnieuw
uitgevoerd worden (bv. via de Supabase SQL Editor).

### Beveiligingsmodel (RLS)

- Publiek (`anon`) heeft geen enkele rechtstreekse toegang. Boekingspagina, widget en cron
  lopen server-side met de service-role key en geven altijd een `restaurant_id` mee.
- Reservaties aanmaken/annuleren gebeurt uitsluitend via de
  `SECURITY DEFINER`-functies `create_reservation()` en
  `beheer_reservatie()`. Een advisory lock per restaurant + slot laat gelijktijdige
  aanvragen na elkaar lopen, zodat de capaciteit nooit overschreden wordt.
- Ingelogde gebruikers zien via RLS enkel de restaurants waarvan ze lid zijn
  (`memberships`, functie `is_lid()`). Superadmins (`platform_admins`) hebben toegang tot
  alle restaurants.
- Het beheer gebruikt altijd de sessie-client van de gebruiker, nooit de service-role key
  (afgedwongen met een ESLint-regel).
- Elke insert/update op `reservations` triggert automatisch een
  `reservation_logs`-rij en een `notifications`-rij (voor het live
  meldingensysteem in de admin-backend).

## Routes

| Route | Wat |
|---|---|
| `/{slug}` | publieke boekingspagina van een restaurant |
| `/w/{slug}` | embedbare widget (mag in een iframe op elke site) |
| `/reservatie-beheren/{token}` | persoonlijke beheerpagina; oude `/annuleren/{token}`-links verwijzen hiernaar |
| `/api/r/{slug}/availability`, `/api/r/{slug}/reservations` | publieke API van de boekingspagina/widget |
| `/login` | inloggen voor beheerders |
| `/app` | restaurantkiezer; `/app/{slug}/...` is het beheer van één restaurant |
| `/platform` | superadmin: alle restaurants, nieuw restaurant, beheerders koppelen, status |

Oude URL's (`/reserveren`, `/widget`, `/admin/...`) verwijzen door naar Bistro de Borre.

## Widget insluiten

Plaats op de publieke website (`data-restaurant` is verplicht):

```html
<script src="https://bistrodeborre.vercel.app/embed.js" data-restaurant="bistro-de-borre"
        data-kleur="#8b8a69" data-lettertype="Georgia, serif"></script>
```

`data-kleur` en `data-lettertype` zijn optioneel (standaard komen ze uit de instellingen);
`data-target="#element"` plaatst de widget in een bestaand element. De iframe past zijn hoogte
automatisch aan. Rechtstreeks kan ook: `/w/bistro-de-borre?kleur=%238b8a69&lettertype=Georgia,serif`.

### Als popup

```html
<script src="https://bistrodeborre.vercel.app/embed.js" data-restaurant="bistro-de-borre"
        data-naam="Bistro de Borre" data-modus="popup" data-knop-tekst="Reserveer een tafel"></script>
```

Dit toont een knop die de widget in een popup opent (sluiten met ×, Escape of klik naast de popup).
Wil je een eigen knop of menu-item gebruiken? Geef het via `data-open=".mijn-knop"` (CSS-selector), of roep
`window.ReservatieWidget.open()` aan. `data-naam` is de titel in de popup-kop.


## Beheer

Log in via `/login`. Superadmins beheren restaurants en beheerders via `/platform`
(een account moet wel al bestaan: Supabase > Authentication > Users). Toegang hangt af van een rij in `memberships` (beheerder van één
restaurant) of in `platform_admins` (superadmin, alle restaurants). Een beheerder aanmaken:
Supabase > Authentication > Users > gebruiker toevoegen en daarna in de SQL-editor:

```sql
insert into memberships (user_id, restaurant_id, rol)
select u.id, r.id, 'eigenaar' from auth.users u, restaurants r
where u.email = 'jij@example.com' and r.slug = 'bistro-de-borre';

-- Superadmin (alle restaurants):
insert into platform_admins (user_id) select id from auth.users where email = 'jij@example.com';
```

## Deployen op Vercel

1. **Supabase**: maak een project, `supabase link --project-ref <ref>` en `supabase db push`
   Voer daarna `supabase/seed.sql` uit in de SQL Editor.
   Zet in Authentication > Settings het aanmaken van nieuwe gebruikers uit.
2. **Beheerder**: maak een gebruiker aan en geef die de rol `admin` (zie "Beheer").
3. **GitHub + Vercel**: push de code, importeer de repo in Vercel (framework Next.js,
   `vercel.json` is aanwezig).
4. **Environment variables** (Vercel > Settings > Environment Variables, Production):

   | Variabele | Waarde |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project-URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key |
   | `SUPABASE_SECRET_KEY` | secret/service_role key (enkel server-side) |
   | `RESEND_API_KEY` | Resend API-key |
   | `EMAIL_FROM_ADRES` | `reservaties@<platformdomein>`: één geverifieerd adres voor alle restaurants. Mails vertrekken als `"<Restaurant> via Tafelvrij" <adres>`, antwoorden gaan naar het contactadres van het restaurant (reply-to). Een oud `EMAIL_FROM="Naam <adres>"` werkt ook. |
   | `CRON_SECRET` | lange willekeurige string; Vercel stuurt die mee als `Authorization: Bearer` |
   | `NEXT_PUBLIC_SITE_URL` | `https://<jouw-domein>` (voor annuleerlinks) |

   Wachtwoorden en keys horen enkel in Vercel/`.env.local`, nooit in de code.
5. **Cron**: `vercel.json` plant `/api/cron/reminders` elk uur. Uurlijkse crons vereisen
   Vercel Pro; op Hobby kan enkel dagelijks.
6. **Resend-domein**: verifieer het platformdomein in Resend en zet `EMAIL_FROM_ADRES`. Zonder
   domein mailt Resend enkel naar het adres van het eigen account.
7. **Controle**: `/bistro-de-borre` en `/w/bistro-de-borre` laden, `/login` laat je inloggen, een
   testreservatie geeft een mail en een melding in de bel.
8. Als een deploy 404 geeft op nieuwe routes: `vercel deploy --prod --force`.

## Status

Alle 7 stappen zijn afgerond.
