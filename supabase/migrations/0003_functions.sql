-- 0003_functions.sql
-- SECURITY DEFINER functies: dit zijn de enige schrijfpaden voor anon-gebruikers
-- en de enige manier waarop anon niet-gevoelige, geaggregeerde data leest.

-- =========================================================================
-- get_public_settings: enkel de instellingen die de publieke site/widget nodig heeft
-- (geen notificatie_email of interne instellingen).
-- =========================================================================
create or replace function public.get_public_settings()
returns table (
  restaurant_naam text,
  slot_minuten int,
  max_groepsgrootte int,
  boekingshorizon_dagen int,
  widget_primaire_kleur text,
  widget_lettertype text,
  menu_link text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    restaurant_naam,
    slot_minuten,
    max_groepsgrootte,
    boekingshorizon_dagen,
    widget_primaire_kleur,
    widget_lettertype,
    menu_link
  from public.settings
  where id = 1;
$$;

grant execute on function public.get_public_settings() to anon, authenticated;

-- =========================================================================
-- get_bezetting: geaggregeerde bezetting per datum/tijdslot, zonder
-- persoonsgegevens. Dit is de bouwsteen voor de beschikbaarheidslogica
-- in de applicatie (lib/availability.ts).
-- =========================================================================
create or replace function public.get_bezetting(p_van date, p_tot date)
returns table (
  datum date,
  tijdslot time,
  aantal_bezet bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select datum, tijdslot, sum(aantal_personen)::bigint as aantal_bezet
  from public.reservations
  where datum between p_van and p_tot
    and status <> 'geannuleerd'
  group by datum, tijdslot;
$$;

grant execute on function public.get_bezetting(date, date) to anon, authenticated;

-- =========================================================================
-- log_and_notify: interne helper, schrijft een reservation_log en
-- (voor nieuwe/gewijzigde/geannuleerde reservaties) een notification.
-- Wordt zowel door de onderstaande trigger als rechtstreeks door de
-- server (bv. bij het versturen van een herinneringsmail) gebruikt.
-- =========================================================================
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
begin
  insert into public.reservation_logs (reservation_id, actie, details)
  values (p_reservation_id, p_actie, p_details);

  if p_notification_type is not null then
    insert into public.notifications (type, reservation_id)
    values (p_notification_type, p_reservation_id);
  end if;
end;
$$;

grant execute on function public.log_and_notify(uuid, text, jsonb, text) to authenticated;

-- =========================================================================
-- record_reservation_change: trigger die bij elke insert/update automatisch
-- logt en een melding genereert. Dit dekt zowel het publieke boekingspad
-- (create_reservation/cancel_reservation) als admin-wijzigingen (manuele
-- boeking, bewerken, status wijzigen via de admin-UI) met één mechanisme.
-- =========================================================================
create or replace function public.record_reservation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_and_notify(
      new.id,
      'aangemaakt',
      jsonb_build_object('bron', new.bron),
      'nieuwe_reservatie'
    );
  elsif tg_op = 'UPDATE' then
    if new.status = 'geannuleerd' and old.status <> 'geannuleerd' then
      perform public.log_and_notify(
        new.id,
        'geannuleerd',
        jsonb_build_object('vorige_status', old.status),
        'annulering'
      );
    elsif new is distinct from old then
      perform public.log_and_notify(
        new.id,
        'gewijzigd',
        to_jsonb(new) - 'updated_at',
        'wijziging'
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_reservations_log_and_notify
  after insert or update on public.reservations
  for each row execute function public.record_reservation_change();

-- =========================================================================
-- create_reservation: atomair een reservatie aanmaken met herverificatie
-- van capaciteit binnen de transactie (voorkomt overboeking bij gelijktijdige
-- aanvragen). Retourneert de aangemaakte rij.
-- =========================================================================
create or replace function public.create_reservation(
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
  p_capaciteit int, -- de capaciteit die gold op het moment van tonen (door app berekend)
  p_bron text default 'online'
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bezet int;
  v_reservation public.reservations;
begin
  if p_aantal_personen is null or p_aantal_personen <= 0 then
    raise exception 'aantal_personen moet groter zijn dan 0' using errcode = 'P0001';
  end if;

  if p_datum < current_date then
    raise exception 'datum ligt in het verleden' using errcode = 'P0001';
  end if;

  -- Lock bestaande rijen voor dit slot zodat gelijktijdige aanvragen na elkaar worden afgehandeld.
  perform 1
  from public.reservations
  where datum = p_datum and tijdslot = p_tijdslot and status <> 'geannuleerd'
  for update;

  select coalesce(sum(aantal_personen), 0)
  into v_bezet
  from public.reservations
  where datum = p_datum and tijdslot = p_tijdslot and status <> 'geannuleerd';

  if v_bezet + p_aantal_personen > p_capaciteit then
    raise exception 'slot is volzet' using errcode = 'P0002';
  end if;

  insert into public.reservations (
    datum, tijdslot, aantal_personen, voornaam, naam, email, telefoon,
    opmerking, menu, shift_template_id, bron
  ) values (
    p_datum, p_tijdslot, p_aantal_personen, p_voornaam, p_naam, p_email, p_telefoon,
    p_opmerking, coalesce(p_menu, false), p_shift_template_id, coalesce(p_bron, 'online')
  )
  returning * into v_reservation;

  -- Logboek + melding worden automatisch aangemaakt door trg_reservations_log_and_notify.

  return v_reservation;
end;
$$;

grant execute on function public.create_reservation(
  date, time, int, text, text, text, text, text, boolean, uuid, int, text
) to anon, authenticated;

-- =========================================================================
-- cancel_reservation: annuleren via de unieke cancel_token (publieke annuleerlink).
-- =========================================================================
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
  where cancel_token = p_token
    and status <> 'geannuleerd'
  returning * into v_reservation;

  if v_reservation.id is null then
    raise exception 'reservatie niet gevonden of al geannuleerd' using errcode = 'P0003';
  end if;

  -- Logboek + melding worden automatisch aangemaakt door trg_reservations_log_and_notify.

  return v_reservation;
end;
$$;

grant execute on function public.cancel_reservation(uuid) to anon, authenticated;
