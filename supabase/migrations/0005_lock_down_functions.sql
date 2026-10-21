-- 0005_lock_down_functions.sql
-- Schrijffuncties mogen enkel via onze server-routes (service_role) worden aangeroepen.
-- Anders kan iedereen met de publieke key create_reservation() rechtstreeks aanroepen
-- met een zelfgekozen capaciteit en zo de server-side validatie omzeilen.

revoke execute on function public.create_reservation(
  date, time, int, text, text, text, text, text, boolean, uuid, int, text
) from public, anon, authenticated;
grant execute on function public.create_reservation(
  date, time, int, text, text, text, text, text, boolean, uuid, int, text
) to service_role;

revoke execute on function public.cancel_reservation(uuid) from public, anon, authenticated;
grant execute on function public.cancel_reservation(uuid) to service_role;

revoke execute on function public.log_and_notify(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.log_and_notify(uuid, text, jsonb, text) to service_role;

revoke execute on function public.record_reservation_change() from public, anon, authenticated;

-- Bezetting wordt enkel server-side gelezen.
revoke execute on function public.get_bezetting(date, date) from public, anon, authenticated;
grant execute on function public.get_bezetting(date, date) to service_role;
