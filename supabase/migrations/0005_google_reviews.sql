-- De reviewlink hoort bij de instellingen van één restaurant.
alter table public.settings add column google_review_url text;
