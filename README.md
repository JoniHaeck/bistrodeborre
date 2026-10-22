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
- Beheerders (Supabase Auth met `app_metadata.role = "admin"`, zie `is_admin()`) hebben volledige lees-/
  schrijftoegang tot alle tabellen.
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

## Beheer

Log in via `/admin/login`. Alleen gebruikers met `app_metadata.role = "admin"`
krijgen toegang (zowel in de app als via RLS, zie migratie 0007). Een
beheerder aanmaken: Supabase > Authentication > Users > gebruiker toevoegen en
daarna in de SQL-editor:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'jij@example.com';
```

## Deployen op Vercel

1. **Supabase**: maak een project, `supabase link --project-ref <ref>` en `supabase db push`
   (migraties 0001–0007). Voer daarna `supabase/seed.sql` uit in de SQL Editor.
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
   | `NOTIFICATION_EMAIL` | fallback restaurant-adres |
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
