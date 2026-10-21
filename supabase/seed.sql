-- seed.sql
-- Seed data voor lokale ontwikkeling / eerste opzet van Bistro de Borre.
-- Standaard: middag 12:00-14:00 en avond 18:00-20:00, elke dag van de week actief.
-- De beheerder kan dit nadien per weekdag aan-/uitzetten en aanpassen in de admin-UI.

insert into public.settings (
  id, restaurant_naam, slot_minuten, standaard_capaciteit, max_groepsgrootte,
  boekingshorizon_dagen, min_voorboekingsuren, herinnering_uren_vooraf,
  herinneringen_actief, notificatie_email, widget_primaire_kleur, widget_lettertype, menu_link
) values (
  1, 'Bistro de Borre', 15, 8, 10,
  60, 2, 24,
  true, 'info@bistrodeborre.be', '#7a1f2b', 'system-ui, sans-serif', null
)
on conflict (id) do update set
  restaurant_naam = excluded.restaurant_naam;

-- Middag- en avondshift voor elke dag van de week (0 = zondag ... 6 = zaterdag).
insert into public.shift_templates (weekdag, naam, start_tijd, eind_tijd, actief, capaciteit_per_slot)
select gs.weekdag, 'Middag', '12:00', '14:00', true, null
from generate_series(0, 6) as gs(weekdag)
where not exists (
  select 1 from public.shift_templates st
  where st.weekdag = gs.weekdag and st.naam = 'Middag'
);

insert into public.shift_templates (weekdag, naam, start_tijd, eind_tijd, actief, capaciteit_per_slot)
select gs.weekdag, 'Avond', '18:00', '20:00', true, null
from generate_series(0, 6) as gs(weekdag)
where not exists (
  select 1 from public.shift_templates st
  where st.weekdag = gs.weekdag and st.naam = 'Avond'
);

-- Voorbeeld van een sluitingsdag (maandag eerstvolgende, als illustratie) -- optioneel, gecommentarieerd:
-- insert into public.date_exceptions (datum, gesloten, opmerking)
-- values (current_date + interval '7 days', true, 'Wekelijkse sluitingsdag (voorbeeld)');
