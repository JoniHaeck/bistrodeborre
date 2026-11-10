-- Fase 4: per-restaurant gedrag. Logo's in Supabase Storage, tijdzone-controle, beschermde velden.
-- Publieke bucket `logos`; elk bestand staat onder `<restaurant_id>/...`. Uploaden en verwijderen
-- gebeurt enkel server-side (service-role, na controle van het lidmaatschap via RLS), daarom
-- geen schrijf-policies voor authenticated.
-- Additief: veilig om toe te passen terwijl de huidige productiecode draait.

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('logos', 'logos', true, 819200, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;

-- Enkel geldige tijdzones (een ongeldige zone laat create_reservation falen).
create or replace function public.is_geldige_tijdzone(p_tijdzone text)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select exists (select 1 from pg_timezone_names where name = p_tijdzone)
$$;

create or replace function public.controleer_tijdzone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_geldige_tijdzone(new.tijdzone) then
    raise exception 'Ongeldige tijdzone: %', new.tijdzone using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restaurants_tijdzone on public.restaurants;
create trigger trg_restaurants_tijdzone
  before insert or update of tijdzone on public.restaurants
  for each row execute function public.controleer_tijdzone();

-- Abonnement en slug zijn platformzaken: een beheerder mag naam, contact, adres en tijdzone
-- van zijn restaurant aanpassen, maar niet de status, proefperiode of slug. Superadmins en
-- server-side code (service-role, geen auth.uid()) wel.
create or replace function public.bescherm_restaurant_velden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;
  if new.slug is distinct from old.slug
     or new.status is distinct from old.status
     or new.proef_tot is distinct from old.proef_tot then
    raise exception 'Enkel het platform kan slug, status of proefperiode wijzigen' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.bescherm_restaurant_velden() from public, anon, authenticated;

drop trigger if exists trg_restaurants_bescherm on public.restaurants;
create trigger trg_restaurants_bescherm
  before update on public.restaurants
  for each row execute function public.bescherm_restaurant_velden();
