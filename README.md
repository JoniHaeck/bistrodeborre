# Bistro de Borre — Reservatie-app

Lichtgewicht reservatiesysteem voor Bistro de Borre. Gasten reserveren een
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
  `cancel_reservation()`. Een advisory lock per restaurant + slot laat gelijktijdige
  aanvragen na elkaar lopen, zodat de capaciteit nooit overschreden wordt.
- Ingelogde gebruikers zien via RLS enkel de restaurants waarvan ze lid zijn
  (`memberships`, functie `is_lid()`). Superadmins (`platform_admins`) hebben toegang tot
  alle restaurants.
- Het beheer gebruikt altijd de sessie-client van de gebruiker, nooit de service-role key
  (afgedwongen met een ESLint-regel).
- Elke insert/update op `reservations` triggert automatisch een
  `reservation_logs`-rij en een `notifications`-rij (voor het live
  meldingensysteem in de admin-backend).

## Widget insluiten

Plaats op de publieke website:

```html
<script src="https://bistrodeborre.vercel.app/embed.js"
        data-kleur="#8b8a69" data-lettertype="Georgia, serif"></script>
```

`data-kleur` en `data-lettertype` zijn optioneel (standaard komen ze uit de instellingen);
`data-target="#element"` plaatst de widget in een bestaand element. De iframe past zijn hoogte
automatisch aan. Rechtstreeks kan ook: `/widget?kleur=%238b8a69&lettertype=Georgia,serif`.

### Als popup

```html
<script src="https://bistrodeborre.vercel.app/embed.js" data-modus="popup"
        data-knop-tekst="Reserveer een tafel"></script>
```

Dit toont een knop die de widget in een popup opent (sluiten met ×, Escape of klik naast de popup).
Wil je een eigen knop of menu-item gebruiken? Geef het via `data-open=".mijn-knop"` (CSS-selector), of roep
`window.BistroDeBorre.open()` aan.


## Beheer

Log in via `/admin/login`. Toegang hangt af van een rij in `memberships` (beheerder van één
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
   | `EMAIL_FROM` | `Bistro de Borre <reservaties@jouwdomein.be>` |
   | `STANDAARD_RESTAURANT_SLUG` | tijdelijk: `bistro-de-borre` (tot de routing per restaurant er is) |
   | `CRON_SECRET` | lange willekeurige string; Vercel stuurt die mee als `Authorization: Bearer` |
   | `NEXT_PUBLIC_SITE_URL` | `https://<jouw-domein>` (voor annuleerlinks) |

   Wachtwoorden en keys horen enkel in Vercel/`.env.local`, nooit in de code.
5. **Cron**: `vercel.json` plant `/api/cron/reminders` elk uur. Uurlijkse crons vereisen
   Vercel Pro; op Hobby kan enkel dagelijks.
6. **Resend-domein**: verifieer een domein in Resend en pas `EMAIL_FROM` aan. Zonder
   domein mailt Resend enkel naar het adres van het eigen account.
7. **Controle**: `/reserveren` en `/widget` laden, `/admin/login` laat je inloggen, een
   testreservatie geeft een mail en een melding in de bel.
8. Als een deploy 404 geeft op nieuwe routes: `vercel deploy --prod --force`.

## Status

Alle 7 stappen zijn afgerond.
