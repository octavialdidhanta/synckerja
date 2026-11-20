-- Include (match_group = 0, OR within group) + Narrow AND rows (match_group >= 1).
-- Unique (list_id, meta_targeting_id) stays: one targeting ID cannot sit in Include and Narrow.

alter table public.meta_ads_interest_list_items
  add column if not exists match_group integer not null default 0;

alter table public.meta_ads_interest_list_items
  drop constraint if exists meta_ads_interest_list_items_match_group_check;

alter table public.meta_ads_interest_list_items
  add constraint meta_ads_interest_list_items_match_group_check
  check (match_group >= 0);

create index if not exists meta_ads_interest_list_items_list_group_sort_idx
  on public.meta_ads_interest_list_items (list_id, match_group, sort_order);
