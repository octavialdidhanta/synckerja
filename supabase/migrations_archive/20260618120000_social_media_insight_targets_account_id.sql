-- Per-account KPI targets (open_id / channel_id / page_id).

ALTER TABLE public.social_media_insight_targets
  ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.social_media_insight_targets.account_id IS
  'Platform account id (TikTok open_id, YouTube channel_id, LinkedIn page_id).';

DROP INDEX IF EXISTS public.social_media_insight_targets_unique_monthly;
DROP INDEX IF EXISTS public.social_media_insight_targets_unique_quarterly;

CREATE UNIQUE INDEX social_media_insight_targets_unique_monthly
  ON public.social_media_insight_targets (organization_id, platform, account_id, metric, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX social_media_insight_targets_unique_quarterly
  ON public.social_media_insight_targets (organization_id, platform, account_id, metric, year, quarter)
  WHERE period_type = 'quarterly';

CREATE INDEX social_media_insight_targets_org_account_idx
  ON public.social_media_insight_targets (organization_id, platform, account_id);
