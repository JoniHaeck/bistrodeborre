-- 0004_realtime.sql
-- Zet 'reservations' en 'notifications' in de Supabase Realtime publicatie
-- zodat het admin-dashboard live meldingen kan ontvangen bij nieuwe,
-- gewijzigde of geannuleerde reservaties.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'reservations'
  ) then
    alter publication supabase_realtime add table public.reservations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
