-- Alleen gebruikers met app_metadata.role = 'admin' zijn beheerders. app_metadata kan enkel met de
-- service-key aangepast worden, dus een zelf aangemaakt account (open signup) krijgt nooit toegang.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

grant execute on function public.is_admin() to authenticated, anon;

drop policy "admin kan settings lezen" on public.settings;
drop policy "admin kan settings bewerken" on public.settings;
drop policy "admin kan shiften lezen" on public.shift_templates;
drop policy "admin kan shiften beheren" on public.shift_templates;
drop policy "admin kan uitzonderingen lezen" on public.date_exceptions;
drop policy "admin kan uitzonderingen beheren" on public.date_exceptions;
drop policy "admin kan reservaties lezen" on public.reservations;
drop policy "admin kan reservaties beheren" on public.reservations;
drop policy "admin kan logboek lezen" on public.reservation_logs;
drop policy "admin kan meldingen lezen" on public.notifications;
drop policy "admin kan meldingen bijwerken" on public.notifications;

create policy "admin settings" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin shiften" on public.shift_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin uitzonderingen" on public.date_exceptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin reservaties" on public.reservations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin logboek" on public.reservation_logs for select to authenticated
  using (public.is_admin());
create policy "admin meldingen lezen" on public.notifications for select to authenticated
  using (public.is_admin());
create policy "admin meldingen bijwerken" on public.notifications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
