-- Het markeren van reminder_sent_at is geen inhoudelijke wijziging: geen logregel of melding.
create or replace function public.record_reservation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_and_notify(
      new.id,
      'aangemaakt',
      jsonb_build_object('bron', new.bron),
      'nieuwe_reservatie'
    );
  elsif tg_op = 'UPDATE' then
    if new.status = 'geannuleerd' and old.status <> 'geannuleerd' then
      perform public.log_and_notify(
        new.id,
        'geannuleerd',
        jsonb_build_object('vorige_status', old.status),
        'annulering'
      );
    elsif (to_jsonb(new) - 'updated_at' - 'reminder_sent_at')
          is distinct from (to_jsonb(old) - 'updated_at' - 'reminder_sent_at') then
      perform public.log_and_notify(
        new.id,
        'gewijzigd',
        to_jsonb(new) - 'updated_at' - 'reminder_sent_at',
        'wijziging'
      );
    end if;
  end if;

  return new;
end;
$$;
