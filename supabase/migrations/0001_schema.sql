-- 0001_schema.sql
-- Multi-tenant schema voor het reservatieplatform. Vervangt de vroegere single-tenant
-- migraties 0001-0007 (Bistro de Borre). Elk restaurant is een tenant; alle data hangt
-- via restaurant_id aan één restaurant.
--
-- Beveiligingsmodel:
--   * Beheerders zijn ingelogde gebruikers met een rij in `memberships`. RLS laat hen enkel
--     data van hun eigen restaurant(s) zien en wijzigen (`is_lid`).
--   * Publiek (anon) heeft geen enkele rechtstreekse tabeltoegang. De publieke boekingspagina,
--     widget en cron lopen server-side met de service-role key en geven altijd expliciet een
--     restaurant_id mee aan de functies hieronder.
--   * Datums/uren worden als lokale `date` / `time` bewaard in de tijdzone van het restaurant
--     (`restaurants.tijdzone`).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- =========================================================================
-- Hulpfunctie: updated_at bijhouden
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- restaurants: de tenants
-- =========================================================================
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  naam text not null check (length(trim(naam)) between 1 and 100),
  tijdzone text not null default 'Europe/Brussels',
  -- Contact en locatie (ook nodig voor een latere Google merchant-feed)
  email text,
  telefoon text,
  website text,
  straat text,
  postcode text,
  gemeente text,
  land text not null default 'BE' check (land ~ '^[A-Z]{2}$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  google_place_id text,
  -- Abonnement (in v1 manueel beheerd)
  status text not null default 'proef' check (status in ('proef', 'actief', 'achterstallig', 'opgezegd')),
  proef_tot date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

-- =========================================================================
-- memberships: welke gebruiker beheert welk restaurant
-- =========================================================================
create type public.lid_rol as enum ('eigenaar', 'beheerder');

create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  rol public.lid_rol not null default 'beheerder',
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create index idx_memberships_restaurant on public.memberships (restaurant_id);

-- =========================================================================
-- settings: één rij per restaurant (wordt automatisch aangemaakt)
-- =========================================================================
create table public.settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  slot_minuten int not null default 15 check (slot_minuten > 0),
  standaard_capaciteit int not null default 8 check (standaard_capaciteit >= 0),
  max_groepsgrootte int not null default 10 check (max_groepsgrootte > 0),
  boekingshorizon_dagen int not null default 60 check (boekingshorizon_dagen > 0),
  min_voorboekingsuren int not null default 0 check (min_voorboekingsuren >= 0),
  standaard_duur_minuten int not null default 120 check (standaard_duur_minuten > 0),
  herinnering_uren_vooraf int not null default 24 check (herinnering_uren_vooraf >= 0),
  herinneringen_actief boolean not null default true,
  notificatie_email text, -- null = geen meldingsmail naar het restaurant
  widget_primaire_kleur text not null default '#8b8a69',
  widget_lettertype text not null default 'system-ui, sans-serif',
  logo_url text,
  menu_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

create or replace function public.maak_standaard_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (restaurant_id, notificatie_email)
  values (new.id, new.email)
  on conflict (restaurant_id) do nothing;
  return new;
end;
$$;

create trigger trg_restaurants_settings
  after insert on public.restaurants
  for each row execute function public.maak_standaard_settings();

-- =========================================================================
-- shift_templates: vaste weekkalender per restaurant
-- weekdag: 0 = zondag ... 6 = zaterdag (zoals extract(dow from date))
-- =========================================================================
create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  weekdag int not null check (weekdag between 0 and 6),
  naam text not null,
  start_tijd time not null,
  eind_tijd time not null check (eind_tijd > start_tijd),
  actief boolean not null default true,
  capaciteit_per_slot int check (capaciteit_per_slot >= 0), -- null = settings.standaard_capaciteit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nodig voor samengestelde foreign keys: een verwijzing naar een shift moet
  -- altijd binnen hetzelfde restaurant blijven.
  unique (restaurant_id, id)
);

create index idx_shift_templates_restaurant_weekdag on public.shift_templates (restaurant_id, weekdag);

create trigger trg_shift_templates_updated_at
  before update on public.shift_templates
  for each row execute function public.set_updated_at();

-- =========================================================================
-- date_exceptions: sluitingsdagen, afwijkende capaciteit, geblokkeerde slots
-- =========================================================================
create table public.date_exceptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  datum date not null,
  gesloten boolean not null default false,
  shift_template_id uuid, -- null = geldt voor de hele dag
  geblokkeerd boolean not null default false,
  geblokkeerde_tijdsloten time[] default '{}',
  afwijkende_capaciteit int check (afwijkende_capaciteit >= 0),
  opmerking text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, shift_template_id)
    references public.shift_templates (restaurant_id, id) on delete cascade
);

create index idx_date_exceptions_restaurant_datum on public.date_exceptions (restaurant_id, datum);

create trigger trg_date_exceptions_updated_at
  before update on public.date_exceptions
  for each row execute function public.set_updated_at();

-- =========================================================================
-- reservations
-- =========================================================================
create type public.reservation_status as enum ('bevestigd', 'aangekomen', 'no_show', 'geannuleerd');

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  datum date not null,
  tijdslot time not null,
  duur_minuten int check (duur_minuten > 0), -- null = settings.standaard_duur_minuten
  aantal_personen int not null check (aantal_personen > 0),
  voornaam text not null,
  naam text not null,
  email text not null,
  telefoon text,
  opmerking text,
  menu boolean not null default false,
  status public.reservation_status not null default 'bevestigd',
  shift_template_id uuid,
  cancel_token uuid not null default gen_random_uuid() unique,
  reminder_sent_at timestamptz,
  bron text not null default 'online' check (bron in ('online', 'telefonisch', 'widget', 'google')),
  externe_id text, -- id bij een externe bron (bv. Google), voor idempotente aanmaak
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, shift_template_id)
    references public.shift_templates (restaurant_id, id)
);

create index idx_reservations_restaurant_datum_tijdslot on public.reservations (restaurant_id, datum, tijdslot);
create index idx_reservations_restaurant_email on public.reservations (restaurant_id, email);
create index idx_reservations_restaurant_status on public.reservations (restaurant_id, status);
create index idx_reservations_shift on public.reservations (shift_template_id);
-- Alleen actieve reservaties tellen mee voor capaciteit.
create index idx_reservations_actief
  on public.reservations (restaurant_id, datum, tijdslot)
  where status <> 'geannuleerd';
create unique index uq_reservations_externe_id
  on public.reservations (restaurant_id, bron, externe_id)
  where externe_id is not null;

create trigger trg_reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- =========================================================================
-- reservation_logs: logboek per reservatie
-- =========================================================================
create table public.reservation_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  reservation_id uuid not null,
  actie text not null,
  details jsonb,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, reservation_id)
    references public.reservations (restaurant_id, id) on delete cascade
);

create index idx_reservation_logs_reservation on public.reservation_logs (reservation_id);
create index idx_reservation_logs_restaurant on public.reservation_logs (restaurant_id);

-- =========================================================================
-- notifications: live meldingen voor het beheerscherm
-- =========================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  type text not null check (type in ('nieuwe_reservatie', 'wijziging', 'annulering')),
  reservation_id uuid,
  gelezen boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, reservation_id)
    references public.reservations (restaurant_id, id) on delete cascade
);

create index idx_notifications_restaurant_gelezen on public.notifications (restaurant_id, gelezen, created_at desc);

-- =========================================================================
-- Row Level Security
-- =========================================================================
create or replace function public.is_lid(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and restaurant_id = p_restaurant_id
  );
$$;

alter table public.restaurants enable row level security;
alter table public.memberships enable row level security;
alter table public.settings enable row level security;
alter table public.shift_templates enable row level security;
alter table public.date_exceptions enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_logs enable row level security;
alter table public.notifications enable row level security;

-- Restaurants aanmaken/verwijderen gebeurt enkel server-side (service-role).
create policy "leden lezen restaurant" on public.restaurants for select to authenticated
  using (public.is_lid(id));
create policy "leden bewerken restaurant" on public.restaurants for update to authenticated
  using (public.is_lid(id)) with check (public.is_lid(id));

create policy "eigen lidmaatschappen" on public.memberships for select to authenticated
  using (user_id = auth.uid());

create policy "leden settings" on public.settings for all to authenticated
  using (public.is_lid(restaurant_id)) with check (public.is_lid(restaurant_id));
create policy "leden shiften" on public.shift_templates for all to authenticated
  using (public.is_lid(restaurant_id)) with check (public.is_lid(restaurant_id));
create policy "leden uitzonderingen" on public.date_exceptions for all to authenticated
  using (public.is_lid(restaurant_id)) with check (public.is_lid(restaurant_id));
create policy "leden reservaties" on public.reservations for all to authenticated
  using (public.is_lid(restaurant_id)) with check (public.is_lid(restaurant_id));
create policy "leden logboek" on public.reservation_logs for select to authenticated
  using (public.is_lid(restaurant_id));
create policy "leden meldingen lezen" on public.notifications for select to authenticated
  using (public.is_lid(restaurant_id));
create policy "leden meldingen bijwerken" on public.notifications for update to authenticated
  using (public.is_lid(restaurant_id)) with check (public.is_lid(restaurant_id));

-- =========================================================================
-- Functies
-- =========================================================================

-- Publieke instellingen van één restaurant (geen interne velden zoals notificatie_email).
create or replace function public.get_public_settings(p_restaurant_id uuid)
returns table (
  restaurant_naam text,
  slot_minuten int,
  max_groepsgrootte int,
  boekingshorizon_dagen int,
  widget_primaire_kleur text,
  widget_lettertype text,
  logo_url text,
  menu_link text
)
language sql
security definer
set search_path = public
stable
as $$
  select r.naam, s.slot_minuten, s.max_groepsgrootte, s.boekingshorizon_dagen,
         s.widget_primaire_kleur, s.widget_lettertype, s.logo_url, s.menu_link
  from public.restaurants r
  join public.settings s on s.restaurant_id = r.id
  where r.id = p_restaurant_id;
$$;

-- Geaggregeerde bezetting per datum/tijdslot van één restaurant, zonder persoonsgegevens.
create or replace function public.get_bezetting(p_restaurant_id uuid, p_van date, p_tot date)
returns table (datum date, tijdslot time, aantal_bezet bigint)
language sql
security definer
set search_path = public
stable
as $$
  select datum, tijdslot, sum(aantal_personen)::bigint
  from public.reservations
  where restaurant_id = p_restaurant_id
    and datum between p_van and p_tot
    and status <> 'geannuleerd'
  group by datum, tijdslot;
$$;

-- Logregel + (optioneel) melding voor een reservatie.
create or replace function public.log_and_notify(
  p_reservation_id uuid,
  p_actie text,
  p_details jsonb,
  p_notification_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  select restaurant_id into v_restaurant_id from public.reservations where id = p_reservation_id;
  if v_restaurant_id is null then
    raise exception 'reservatie % niet gevonden', p_reservation_id;
  end if;

  insert into public.reservation_logs (restaurant_id, reservation_id, actie, details)
  values (v_restaurant_id, p_reservation_id, p_actie, p_details);

  if p_notification_type is not null then
    insert into public.notifications (restaurant_id, type, reservation_id)
    values (v_restaurant_id, p_notification_type, p_reservation_id);
  end if;
end;
$$;

-- Trigger: elke aanmaak/wijziging/annulering automatisch loggen en melden.
-- Het markeren van reminder_sent_at is geen inhoudelijke wijziging.
create or replace function public.record_reservation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_and_notify(new.id, 'aangemaakt', jsonb_build_object('bron', new.bron), 'nieuwe_reservatie');
  elsif tg_op = 'UPDATE' then
    if new.restaurant_id <> old.restaurant_id then
      raise exception 'een reservatie kan niet naar een ander restaurant verhuizen';
    end if;
    if new.status = 'geannuleerd' and old.status <> 'geannuleerd' then
      perform public.log_and_notify(new.id, 'geannuleerd', jsonb_build_object('vorige_status', old.status), 'annulering');
    elsif (to_jsonb(new) - 'updated_at' - 'reminder_sent_at')
          is distinct from (to_jsonb(old) - 'updated_at' - 'reminder_sent_at') then
      perform public.log_and_notify(new.id, 'gewijzigd', to_jsonb(new) - 'updated_at' - 'reminder_sent_at', 'wijziging');
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_reservations_log_and_notify
  after insert or update on public.reservations
  for each row execute function public.record_reservation_change();

-- Atomair een reservatie aanmaken met herverificatie van de capaciteit. Een advisory lock per
-- restaurant + slot zorgt dat gelijktijdige aanvragen na elkaar lopen, ook als het slot nog leeg is.
-- Met p_externe_id is de aanroep idempotent: bestaat die al, dan komt de bestaande reservatie terug.
create or replace function public.create_reservation(
  p_restaurant_id uuid,
  p_datum date,
  p_tijdslot time,
  p_aantal_personen int,
  p_voornaam text,
  p_naam text,
  p_email text,
  p_telefoon text,
  p_opmerking text,
  p_menu boolean,
  p_shift_template_id uuid,
  p_capaciteit int, -- capaciteit zoals de applicatie die berekende
  p_bron text default 'online',
  p_externe_id text default null
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tijdzone text;
  v_bezet int;
  v_reservation public.reservations;
begin
  select tijdzone into v_tijdzone from public.restaurants where id = p_restaurant_id;
  if v_tijdzone is null then
    raise exception 'restaurant niet gevonden' using errcode = 'P0001';
  end if;

  if p_aantal_personen is null or p_aantal_personen <= 0 then
    raise exception 'aantal_personen moet groter zijn dan 0' using errcode = 'P0001';
  end if;

  if p_datum < (now() at time zone v_tijdzone)::date then
    raise exception 'datum ligt in het verleden' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || '|' || p_datum || '|' || p_tijdslot, 0));

  if p_externe_id is not null then
    select * into v_reservation
    from public.reservations
    where restaurant_id = p_restaurant_id and bron = coalesce(p_bron, 'online') and externe_id = p_externe_id;
    if found then
      return v_reservation;
    end if;
  end if;

  select coalesce(sum(aantal_personen), 0) into v_bezet
  from public.reservations
  where restaurant_id = p_restaurant_id
    and datum = p_datum and tijdslot = p_tijdslot and status <> 'geannuleerd';

  if v_bezet + p_aantal_personen > p_capaciteit then
    raise exception 'slot is volzet' using errcode = 'P0002';
  end if;

  insert into public.reservations (
    restaurant_id, datum, tijdslot, aantal_personen, voornaam, naam, email, telefoon,
    opmerking, menu, shift_template_id, bron, externe_id
  ) values (
    p_restaurant_id, p_datum, p_tijdslot, p_aantal_personen, p_voornaam, p_naam, p_email, p_telefoon,
    p_opmerking, coalesce(p_menu, false), p_shift_template_id, coalesce(p_bron, 'online'), p_externe_id
  )
  returning * into v_reservation;

  return v_reservation;
end;
$$;

-- Annuleren via de unieke cancel_token (publieke annuleerlink). De token is globaal uniek,
-- het restaurant volgt uit de reservatie zelf.
create or replace function public.cancel_reservation(p_token uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations;
begin
  update public.reservations
  set status = 'geannuleerd'
  where cancel_token = p_token and status <> 'geannuleerd'
  returning * into v_reservation;

  if v_reservation.id is null then
    raise exception 'reservatie niet gevonden of al geannuleerd' using errcode = 'P0003';
  end if;
  return v_reservation;
end;
$$;

-- =========================================================================
-- Rechten op functies
-- Supabase geeft nieuwe functies standaard execute aan anon/authenticated: expliciet intrekken.
-- =========================================================================
revoke execute on function public.get_public_settings(uuid) from public, anon, authenticated;
revoke execute on function public.get_bezetting(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.log_and_notify(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.record_reservation_change() from public, anon, authenticated;
revoke execute on function public.maak_standaard_settings() from public, anon, authenticated;
revoke execute on function public.create_reservation(
  uuid, date, time, int, text, text, text, text, text, boolean, uuid, int, text, text
) from public, anon, authenticated;
revoke execute on function public.cancel_reservation(uuid) from public, anon, authenticated;
revoke execute on function public.is_lid(uuid) from public, anon;

grant execute on function public.get_public_settings(uuid) to service_role;
grant execute on function public.get_bezetting(uuid, date, date) to service_role;
grant execute on function public.log_and_notify(uuid, text, jsonb, text) to service_role;
grant execute on function public.create_reservation(
  uuid, date, time, int, text, text, text, text, text, boolean, uuid, int, text, text
) to service_role;
grant execute on function public.cancel_reservation(uuid) to service_role;
grant execute on function public.is_lid(uuid) to authenticated, service_role;

-- =========================================================================
-- Realtime: live meldingen in het beheerscherm (RLS geldt ook hier)
-- =========================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.reservations, public.notifications;
  end if;
end;
$$;
