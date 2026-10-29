ALTER TABLE public.meta_ads_interest_lists
  ADD COLUMN IF NOT EXISTS meta_saved_audience_id text NULL,
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text NULL,
  ADD COLUMN IF NOT EXISTS meta_saved_audience_pushed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS meta_saved_audience_filters jsonb NULL;

COMMENT ON COLUMN public.meta_ads_interest_lists.meta_saved_audience_id IS
  'Meta Saved Audience id last pushed from this list.';
COMMENT ON COLUMN public.meta_ads_interest_lists.meta_ad_account_id IS
  'Ad account id used for the last Saved Audience push.';
COMMENT ON COLUMN public.meta_ads_interest_lists.meta_saved_audience_filters IS
  'Snapshot of location/gender/age/placement used on last push, for Meta sync.';
