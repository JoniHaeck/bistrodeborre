create table public.groepsaanvragen (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  datum date not null,
  tijdslot time not null,
  shift_template_id uuid not null,
  aantal_personen int not null check (aantal_personen between 2 and 100),
  voornaam text not null,
  naam text not null,
  email text not null,
  telefoon text not null,
  opmerking text,
  menu boolean not null default false,
  status text not null default 'in_afwachting' check (status in ('in_afwachting', 'bevestigd')),
  reservation_id uuid,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, shift_template_id) references public.shift_templates(restaurant_id, id),
  foreign key (restaurant_id, reservation_id) references public.reservations(restaurant_id, id),
  check ((status = 'in_afwachting' and reservation_id is null) or (status = 'bevestigd' and reservation_id is not null))
);

create index idx_groepsaanvragen_restaurant on public.groepsaanvragen (restaurant_id, status, datum);
alter table public.groepsaanvragen enable row level security;
create policy groepsaanvragen_lezen on public.groepsaanvragen for select to authenticated
  using (public.is_lid(restaurant_id));
revoke all on public.groepsaanvragen from public, anon, authenticated;
grant select on public.groepsaanvragen to authenticated;
grant select, insert on public.groepsaanvragen to service_role;

-- De aanvraag en de reservatie worden in één transactie gekoppeld; dezelfde
-- slotlock als bij gewone reservaties voorkomt dubbele bevestiging en overboekingen.
create function public.bevestig_groepsaanvraag(p_restaurant_id uuid, p_id uuid, p_overcapaciteit boolean)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  aanvraag public.groepsaanvragen;
  shift public.shift_templates;
  instelling public.settings;
  result public.reservations;
  capaciteit int;
  bezet int;
  zone text;
begin
  if auth.uid() is null or not public.is_lid(p_restaurant_id) then
    raise exception 'geen toegang';
  end if;
  select * into aanvraag from public.groepsaanvragen
    where id = p_id and restaurant_id = p_restaurant_id for update;
  if not found or aanvraag.status <> 'in_afwachting' then
    raise exception 'aanvraag niet gevonden of al behandeld';
  end if;
  select * into shift from public.shift_templates where restaurant_id = p_restaurant_id
    and id = aanvraag.shift_template_id and actief;
  select * into instelling from public.settings where restaurant_id = p_restaurant_id;
  select tijdzone into zone from public.restaurants where id = p_restaurant_id;
  if shift.id is null or instelling.restaurant_id is null or zone is null
    or shift.weekdag <> extract(dow from aanvraag.datum)
    or aanvraag.tijdslot < shift.start_tijd or aanvraag.tijdslot > shift.eind_tijd
    or ((aanvraag.datum + aanvraag.tijdslot) at time zone zone) <= now()
    or exists (
      select 1 from public.date_exceptions e where e.restaurant_id = p_restaurant_id
        and e.datum = aanvraag.datum and (e.shift_template_id is null or e.shift_template_id = shift.id)
        and (e.gesloten or e.geblokkeerd or aanvraag.tijdslot = any(e.geblokkeerde_tijdsloten))
    ) then
    raise exception 'tijdstip niet meer beschikbaar';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || '|' || aanvraag.datum || '|' || aanvraag.tijdslot, 0));
  select coalesce(sum(aantal_personen), 0)::int into bezet from public.reservations
    where restaurant_id = p_restaurant_id and datum = aanvraag.datum
      and tijdslot = aanvraag.tijdslot and status <> 'geannuleerd';
  select coalesce(
    (select afwijkende_capaciteit from public.date_exceptions
      where restaurant_id = p_restaurant_id and datum = aanvraag.datum
        and (shift_template_id is null or shift_template_id = shift.id) and afwijkende_capaciteit is not null
      order by (shift_template_id is not null) desc, created_at, id limit 1),
    shift.capaciteit_per_slot, instelling.standaard_capaciteit
  ) into capaciteit;
  if bezet + aanvraag.aantal_personen > capaciteit and not coalesce(p_overcapaciteit, false) then
    raise exception 'overcapaciteit: % bezet + % personen > capaciteit %', bezet, aanvraag.aantal_personen, capaciteit;
  end if;

  result := public.create_reservation(p_restaurant_id, aanvraag.datum, aanvraag.tijdslot,
    aanvraag.aantal_personen, aanvraag.voornaam, aanvraag.naam, aanvraag.email,
    aanvraag.telefoon, aanvraag.opmerking, aanvraag.menu, shift.id, 2147483647, 'online', null);
  update public.groepsaanvragen set status = 'bevestigd', reservation_id = result.id where id = aanvraag.id;
  return result;
end;
$$;
revoke execute on function public.bevestig_groepsaanvraag(uuid, uuid, boolean) from public, anon;
grant execute on function public.bevestig_groepsaanvraag(uuid, uuid, boolean) to authenticated;
