-- 0001_init_schema.sql
-- Bistro de Borre: basisschema voor reservaties
-- Tijdzone: alle datums/tijden worden als 'date' / 'time' opgeslagen (geen tijdzone-conversie nodig,
-- de applicatie werkt in Europe/Brussels en toont/interpreteert alles in die zone).

create extension if not exists "pgcrypto"; -- voor gen_random_uuid()

-- =========================================================================
-- settings: één rij met algemene instellingen van het restaurant
-- =========================================================================
create table if not exists public.settings (
  id int primary key default 1 check (id = 1), -- singleton rij
  restaurant_naam text not null default 'Bistro de Borre',
  slot_minuten int not null default 15 check (slot_minuten > 0),
  standaard_capaciteit int not null default 8 check (standaard_capaciteit >= 0),
  max_groepsgrootte int not null default 10 check (max_groepsgrootte > 0),
  boekingshorizon_dagen int not null default 60 check (boekingshorizon_dagen > 0),
  min_voorboekingsuren int not null default 0 check (min_voorboekingsuren >= 0), -- minimaal x uur op voorhand boeken
  herinnering_uren_vooraf int not null default 24 check (herinnering_uren_vooraf >= 0),
  herinneringen_actief boolean not null default true,
  notificatie_email text not null default 'info@bistrodeborre.be',
  widget_primaire_kleur text not null default '#7a1f2b',
  widget_lettertype text not null default 'system-ui, sans-serif',
  menu_link text, -- link naar het menu op de publieke website
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1)
on conflict (id) do nothing;

-- =========================================================================
-- shift_templates: vaste weekkalender met shiften per weekdag
-- weekdag: 0 = zondag ... 6 = zaterdag (zoals extract(dow from date))
-- =========================================================================
create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  weekdag int not null check (weekdag between 0 and 6),
  naam text not null, -- bv. 'Middag', 'Avond'
  start_tijd time not null,
  eind_tijd time not null check (eind_tijd > start_tijd),
  actief boolean not null default true,
  capaciteit_per_slot int, -- null = gebruik settings.standaard_capaciteit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shift_templates_weekdag on public.shift_templates (weekdag);

-- =========================================================================
-- date_exceptions: sluitingsdagen, afwijkende capaciteit, geblokkeerde slots
-- =========================================================================
create table if not exists public.date_exceptions (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  gesloten boolean not null default false, -- hele dag gesloten (vakantie, enz.)
  shift_template_id uuid references public.shift_templates (id) on delete cascade, -- null = geldt voor hele dag
  geblokkeerd boolean not null default false, -- shift/slot tijdelijk blokkeren
  geblokkeerde_tijdsloten time[] default '{}', -- specifieke kwartiertjes blokkeren binnen de shift
  afwijkende_capaciteit int, -- overschrijft capaciteit voor deze datum/shift
  opmerking text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_date_exceptions_datum on public.date_exceptions (datum);

-- =========================================================================
-- reservations
-- =========================================================================
create type public.reservation_status as enum ('bevestigd', 'aangekomen', 'no_show', 'geannuleerd');

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  tijdslot time not null,
  aantal_personen int not null check (aantal_personen > 0),
  voornaam text not null,
  naam text not null,
  email text not null,
  telefoon text,
  opmerking text,
  menu boolean not null default false,
  status public.reservation_status not null default 'bevestigd',
  shift_template_id uuid references public.shift_templates (id),
  cancel_token uuid not null default gen_random_uuid(),
  reminder_sent_at timestamptz,
  bron text not null default 'online' check (bron in ('online', 'telefonisch', 'widget')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reservations_datum_tijdslot on public.reservations (datum, tijdslot);
create index if not exists idx_reservations_cancel_token on public.reservations (cancel_token);
create index if not exists idx_reservations_email on public.reservations (email);
create index if not exists idx_reservations_status on public.reservations (status);

-- Alleen actieve (niet-geannuleerde) reservaties tellen mee voor capaciteit;
-- deze gedeeltelijke index versnelt de capaciteitscontrole in create_reservation().
create index if not exists idx_reservations_actief
  on public.reservations (datum, tijdslot)
  where status <> 'geannuleerd';

-- =========================================================================
-- reservation_logs: logboek per reservatie
-- =========================================================================
create table if not exists public.reservation_logs (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  actie text not null, -- bv. 'aangemaakt', 'gewijzigd', 'geannuleerd', 'mail_bevestiging', 'mail_herinnering'
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservation_logs_reservation_id on public.reservation_logs (reservation_id);

-- =========================================================================
-- notifications: live meldingen voor het admin-dashboard
-- =========================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('nieuwe_reservatie', 'wijziging', 'annulering')),
  reservation_id uuid references public.reservations (id) on delete cascade,
  gelezen boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_gelezen on public.notifications (gelezen);

-- =========================================================================
-- updated_at triggers
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

create trigger trg_shift_templates_updated_at
  before update on public.shift_templates
  for each row execute function public.set_updated_at();

create trigger trg_date_exceptions_updated_at
  before update on public.date_exceptions
  for each row execute function public.set_updated_at();

create trigger trg_reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();
