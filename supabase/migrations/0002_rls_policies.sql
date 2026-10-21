-- 0002_rls_policies.sql
-- Beveiligingsmodel:
--   * Publiek (anon) heeft GEEN rechtstreekse tabeltoegang. Beschikbaarheid wordt enkel
--     uitgelezen via de SECURITY DEFINER functie public.get_availability(...) (zie 0003).
--   * Reservaties aanmaken gebeurt enkel via de SECURITY DEFINER functie public.create_reservation(...).
--   * Alle overige schrijf-/leesacties (admin) verlopen via ingelogde Supabase Auth-gebruikers
--     (authenticated) of via de server met de service_role key (API-routes, cron).
--   * Er is geen apart gastenaccount: elke 'authenticated' gebruiker is een beheerder.

alter table public.settings enable row level security;
alter table public.shift_templates enable row level security;
alter table public.date_exceptions enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_logs enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------
create policy "admin kan settings lezen"
  on public.settings for select
  to authenticated
  using (true);

create policy "admin kan settings bewerken"
  on public.settings for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- shift_templates
-- Publiek mag actieve shiften lezen: nodig om de weekkalender van
-- beschikbare dagen/uren te tonen (geen persoonsgegevens in deze tabel).
-- ---------------------------------------------------------------------
create policy "publiek kan actieve shiften lezen"
  on public.shift_templates for select
  to anon
  using (actief = true);

create policy "admin kan shiften lezen"
  on public.shift_templates for select
  to authenticated
  using (true);

create policy "admin kan shiften beheren"
  on public.shift_templates for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- date_exceptions
-- Publiek mag uitzonderingen lezen (sluitingsdagen/capaciteit), geen
-- persoonsgegevens aanwezig in deze tabel.
-- ---------------------------------------------------------------------
create policy "publiek kan uitzonderingen lezen"
  on public.date_exceptions for select
  to anon
  using (true);

create policy "admin kan uitzonderingen lezen"
  on public.date_exceptions for select
  to authenticated
  using (true);

create policy "admin kan uitzonderingen beheren"
  on public.date_exceptions for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- reservations
-- Geen anon select/insert/update-policies op de tabel zelf: publiek kan
-- uitsluitend via de SECURITY DEFINER functies create_reservation() en
-- cancel_reservation() schrijven (zie 0003_functions.sql). Zo blijven
-- persoonsgegevens (naam, e-mail, telefoon) ontoegankelijk voor anon.
-- ---------------------------------------------------------------------
create policy "admin kan reservaties lezen"
  on public.reservations for select
  to authenticated
  using (true);

create policy "admin kan reservaties beheren"
  on public.reservations for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- reservation_logs
-- ---------------------------------------------------------------------
create policy "admin kan logboek lezen"
  on public.reservation_logs for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create policy "admin kan meldingen lezen"
  on public.notifications for select
  to authenticated
  using (true);

create policy "admin kan meldingen bijwerken"
  on public.notifications for update
  to authenticated
  using (true)
  with check (true);
