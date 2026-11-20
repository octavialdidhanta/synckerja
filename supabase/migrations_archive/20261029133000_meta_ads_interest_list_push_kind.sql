ALTER TABLE public.meta_ads_interest_lists
  ADD COLUMN IF NOT EXISTS meta_push_kind text NULL,
  ADD COLUMN IF NOT EXISTS meta_campaign_id text NULL,
  ADD COLUMN IF NOT EXISTS meta_adset_id text NULL;

COMMENT ON COLUMN public.meta_ads_interest_lists.meta_push_kind IS
  'saved_audience or adset_draft — Meta object used for Ads Manager open/sync.';
