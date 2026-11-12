-- De bestaande annuleertoken wordt ook gebruikt voor de beheerpagina.
-- Enkel serverroutes met de service-role mogen deze functie aanroepen.
create function public.beheer_reservatie(
  p_token uuid, p_actie text, p_datum date, p_tijdslot time,
  p_aantal integer, p_voornaam text, p_naam text, p_email text,
  p_telefoon text, p_opmerking text, p_menu boolean, p_shift_id uuid
) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  r public.reservations;
  s public.settings;
  sh public.shift_templates;
  tz text;
  cap integer;
  bezet integer;
  behoudt_slot boolean;
begin
  select * into r from public.reservations where cancel_token = p_token for update;
  if not found then raise exception 'ongeldige_link'; end if;
  select * into s from public.settings where restaurant_id = r.restaurant_id;
  select tijdzone into tz from public.restaurants where id = r.restaurant_id;
  if r.status <> 'bevestigd' then raise exception 'niet_bevestigd'; end if;
  if ((r.datum + r.tijdslot) at time zone tz) <= now() + interval '24 hours' then
    raise exception 'termijn_verstreken';
  end if;
  if p_actie = 'annuleer' then
    update public.reservations set status = 'geannuleerd' where id = r.id returning * into r;
    return r;
  end if;
  behoudt_slot := p_datum = r.datum and p_tijdslot = r.tijdslot and p_aantal <= r.aantal_personen;
  if p_actie <> 'wijzig' or p_aantal is null or p_aantal < 1
    or (p_aantal > s.max_groepsgrootte and not coalesce(behoudt_slot, false)) then
    raise exception 'ongeldige_groep';
  end if;
  if p_datum is null or p_tijdslot is null or p_voornaam is null or p_naam is null
    or p_email is null or p_telefoon is null or p_menu is null then raise exception 'ongeldige_gegevens'; end if;
  if not behoudt_slot then
    select * into sh from public.shift_templates where id = p_shift_id and restaurant_id = r.restaurant_id and actief;
    if sh.id is null or sh.weekdag <> extract(dow from p_datum)
     or p_tijdslot < sh.start_tijd or p_tijdslot > sh.eind_tijd
     or mod(extract(epoch from (p_tijdslot - sh.start_tijd))::integer, s.slot_minuten * 60) <> 0
     or p_datum > (now() at time zone tz)::date + s.boekingshorizon_dagen
     or ((p_datum + p_tijdslot) at time zone tz) < now() + make_interval(hours => s.min_voorboekingsuren)
     or exists (select 1 from public.date_exceptions e where e.restaurant_id = r.restaurant_id
       and e.datum = p_datum and (e.shift_template_id is null or e.shift_template_id = sh.id)
       and (e.gesloten or e.geblokkeerd or p_tijdslot = any(e.geblokkeerde_tijdsloten))) then
      raise exception 'niet_beschikbaar';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(r.restaurant_id::text || '|' || p_datum || '|' || p_tijdslot, 0));
  if not behoudt_slot then
    select coalesce(sum(aantal_personen), 0)::integer into bezet from public.reservations
    where restaurant_id = r.restaurant_id and datum = p_datum and tijdslot = p_tijdslot
      and status <> 'geannuleerd' and id <> r.id;
  select coalesce(
    (select afwijkende_capaciteit from public.date_exceptions
      where restaurant_id = r.restaurant_id and datum = p_datum
        and (shift_template_id is null or shift_template_id = sh.id) and afwijkende_capaciteit is not null
      order by (shift_template_id is not null) desc, created_at, id limit 1),
    sh.capaciteit_per_slot, s.standaard_capaciteit
  ) into cap;
    if bezet + p_aantal > cap then raise exception 'volzet'; end if;
  end if;
  update public.reservations set datum = p_datum, tijdslot = p_tijdslot,
    aantal_personen = p_aantal, voornaam = p_voornaam, naam = p_naam,
    email = p_email, telefoon = p_telefoon, opmerking = p_opmerking, menu = p_menu,
    shift_template_id = case when behoudt_slot then r.shift_template_id else sh.id end,
    reminder_sent_at = case when datum <> p_datum or tijdslot <> p_tijdslot then null else reminder_sent_at end
    where id = r.id returning * into r;
  return r;
end;
$$;
revoke execute on function public.beheer_reservatie(uuid,text,date,time,integer,text,text,text,text,text,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.beheer_reservatie(uuid,text,date,time,integer,text,text,text,text,text,boolean,uuid)
  to service_role;
