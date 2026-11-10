alter table public.restaurants
  add constraint restaurants_slug_uitnodiging_niet_gereserveerd check (slug <> 'uitnodiging');
