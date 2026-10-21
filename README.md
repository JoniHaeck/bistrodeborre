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
  migrations/        -- SQL-migraties (schema, RLS, functies, realtime)
  seed.sql           -- standaard instellingen + weekshiften (idempotent)
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
4. `npm test` — unit tests (vitest).

## Supabase

Het project is gelinkt via de Supabase CLI. Migraties toepassen:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Types opnieuw genereren na een schemawijziging:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

De seed-data (`supabase/seed.sql`) is idempotent en kan veilig opnieuw
uitgevoerd worden (bv. via de Supabase SQL Editor).

### Beveiligingsmodel (RLS)

- Publiek (`anon`) kan **enkel** lezen: actieve shiften, datumuitzonderingen
  en geaggregeerde bezetting per slot (géén persoonsgegevens).
- Reservaties aanmaken/annuleren gebeurt uitsluitend via de
  `SECURITY DEFINER`-functies `create_reservation()` en
  `cancel_reservation()`, die binnen één transactie de capaciteit
  herverifiëren (voorkomt overboeking bij gelijktijdige aanvragen).
- Beheerders (Supabase Auth, `authenticated`) hebben volledige lees-/
  schrijftoegang tot alle tabellen.
- Elke insert/update op `reservations` triggert automatisch een
  `reservation_logs`-rij en een `notifications`-rij (voor het live
  meldingensysteem in de admin-backend).

## Status

Stap 1 (projectopzet + Supabase-schema) is afgerond. Volgende stappen:
beschikbaarheidslogica, publiek formulier, e-mails, widget, admin-backend en
deploy-instructies.

Deploy-instructies voor Vercel volgen in de laatste stap van dit project.
