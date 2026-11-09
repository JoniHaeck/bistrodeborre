-- 0002_platform_admins.sql
-- Fase 2: superadmins en beheer via de sessie van de gebruiker.
--   * platform_admins: gebruikers die elk restaurant mogen beheren (Joni). Rijen worden enkel
--     server-side (service-role / SQL-editor) toegevoegd.
--   * is_lid() geldt voortaan ook voor superadmins, zodat alle bestaande RLS-policies hen
--     automatisch toegang geven.
--   * get_bezetting() en create_reservation() mogen ook door ingelogde gebruikers aangeroepen
--     worden (beheerscherm), maar enkel voor een restaurant waar ze toegang toe hebben.
--     De service-role (publieke boekingspagina, cron) heeft geen auth.uid() en blijft toegelaten.

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy "eigen superadmin-rij" on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_lid(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.memberships
        where user_id = auth.uid() and restaurant_id = p_restaurant_id
      );
$$;

-- Superadmins zien alle lidmaatschappen (bv. om te zien wie een restaurant beheert).
create policy "superadmin lidmaatschappen" on public.memberships for select to authenticated
  using (public.is_platform_admin());

-- Weigert een ingelogde gebruiker zonder toegang tot het restaurant. Aanroepen zonder
-- auth.uid() (service-role) worden toegelaten: anon heeft geen execute-recht.
create or replace function public.controleer_toegang(p_restaurant_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_lid(p_restaurant_id) then
    raise exception 'geen toegang tot dit restaurant' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.get_bezetting(p_restaurant_id uuid, p_van date, p_tot date)
returns table (datum date, tijdslot time, aantal_bezet bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.controleer_toegang(p_restaurant_id);
  return query
    select r.datum, r.tijdslot, sum(r.aantal_personen)::bigint
    from public.reservations r
    where r.restaurant_id = p_restaurant_id
      and r.datum between p_van and p_tot
      and r.status <> 'geannuleerd'
    group by r.datum, r.tijdslot;
end;
$$;

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
  p_capaciteit int,
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
  perform public.controleer_toegang(p_restaurant_id);

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

revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.controleer_toegang(uuid) from public, anon, authenticated;
revoke execute on function public.get_bezetting(uuid, date, date) from public, anon;
revoke execute on function public.create_reservation(
  uuid, date, time, int, text, text, text, text, text, boolean, uuid, int, text, text
) from public, anon;

grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.get_bezetting(uuid, date, date) to authenticated, service_role;
grant execute on function public.create_reservation(
  uuid, date, time, int, text, text, text, text, text, boolean, uuid, int, text, text
) to authenticated, service_role;
