-- 0003_platform_beheer.sql
-- Fase 3: routing per restaurant en het superadmin-platform.
--   * Slugs die botsen met routes van de app zijn niet toegelaten (/app, /api, /w, ...).
--   * user_id_voor_email(): de server zoekt een bestaand account op om het als beheerder aan
--     een restaurant te koppelen. Enkel voor de service-role (auth.users is niet publiek).

alter table public.restaurants
  add constraint restaurants_slug_niet_gereserveerd check (
    slug not in (
      'admin', 'annuleren', 'api', 'app', 'login', 'logout', 'platform', 'registreren',
      'reserveren', 'static', 'w', 'widget', 'www'
    )
  );

create or replace function public.user_id_voor_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke execute on function public.user_id_voor_email(text) from public, anon, authenticated;
grant execute on function public.user_id_voor_email(text) to service_role;
