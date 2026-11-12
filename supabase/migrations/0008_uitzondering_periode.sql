alter table public.date_exceptions add column periode_id uuid;

create index idx_date_exceptions_periode
  on public.date_exceptions (restaurant_id, periode_id)
  where periode_id is not null;
