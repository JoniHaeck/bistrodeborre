alter table public.memberships add column geblokkeerd boolean not null default false;

create or replace function public.is_lid(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.memberships
        where user_id = auth.uid() and restaurant_id = p_restaurant_id and not geblokkeerd
      );
$$;
