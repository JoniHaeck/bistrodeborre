-- seed.sql
-- Seed data voor lokale ontwikkeling en de eerste opzet.
--   * bistro-de-borre: het eerste echte restaurant.
--   * demo-brasserie:  een tweede restaurant met andere uren, om multi-tenancy te testen
--                      (en als demo voor prospecten).
-- Settings worden automatisch aangemaakt bij een nieuw restaurant (trigger) en hier aangevuld.
-- Beheerders koppelen gebeurt apart (zie docs/multi-tenant-plan.md, fase 4b).

insert into public.restaurants (id, slug, naam, email, website, gemeente, land, status)
values
  ('00000000-0000-4000-8000-000000000001', 'bistro-de-borre', 'Bistro de Borre',
   'info@bistrodeborre.be', 'https://bistrodeborre.be', null, 'BE', 'actief'),
  ('00000000-0000-4000-8000-000000000002', 'demo-brasserie', 'Demo Brasserie',
   null, null, 'Gent', 'BE', 'proef')
on conflict (id) do nothing;

update public.settings set
  slot_minuten = 15,
  standaard_capaciteit = 8,
  max_groepsgrootte = 8,
  boekingshorizon_dagen = 60,
  min_voorboekingsuren = 2,
  herinnering_uren_vooraf = 24,
  herinneringen_actief = true,
  notificatie_email = 'info@bistrodeborre.be',
  widget_primaire_kleur = '#8b8a69',
  widget_lettertype = '"Open Sans", sans-serif'
where restaurant_id = '00000000-0000-4000-8000-000000000001';

update public.settings set
  standaard_capaciteit = 12,
  max_groepsgrootte = 12,
  herinneringen_actief = false,
  widget_primaire_kleur = '#1f4e79'
where restaurant_id = '00000000-0000-4000-8000-000000000002';

-- Bistro de Borre: middag 12:00-14:00 en avond 18:00-20:00, elke dag.
insert into public.shift_templates (restaurant_id, weekdag, naam, start_tijd, eind_tijd)
select '00000000-0000-4000-8000-000000000001', d, s.naam, s.start_tijd, s.eind_tijd
from generate_series(0, 6) as d
cross join (values ('Middag', time '12:00', time '14:00'), ('Avond', time '18:00', time '20:00')) as s(naam, start_tijd, eind_tijd)
where not exists (
  select 1 from public.shift_templates st
  where st.restaurant_id = '00000000-0000-4000-8000-000000000001' and st.weekdag = d and st.naam = s.naam
);

-- Demo Brasserie: enkel avond 18:30-21:30, dinsdag t.e.m. zaterdag.
insert into public.shift_templates (restaurant_id, weekdag, naam, start_tijd, eind_tijd)
select '00000000-0000-4000-8000-000000000002', d, 'Avond', '18:30', '21:30'
from generate_series(2, 6) as d
where not exists (
  select 1 from public.shift_templates st
  where st.restaurant_id = '00000000-0000-4000-8000-000000000002' and st.weekdag = d and st.naam = 'Avond'
);
