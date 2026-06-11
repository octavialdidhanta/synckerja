-- Multi-channel KPI targets: Google Ads + Meta Ads + TikTok Ads (Digital Marketing Report).

-- Rename tables
ALTER TABLE public.google_ads_report_targets RENAME TO digital_marketing_report_targets;
ALTER TABLE public.google_ads_report_target_assignments RENAME TO digital_marketing_report_target_assignments;
ALTER TABLE public.google_ads_report_target_period_settings RENAME TO digital_marketing_report_target_period_settings;

-- Rename account column
ALTER TABLE public.digital_marketing_report_targets
  RENAME COLUMN google_customer_id TO account_id;
ALTER TABLE public.digital_marketing_report_target_assignments
  RENAME COLUMN google_customer_id TO account_id;

-- Channel dimension
ALTER TABLE public.digital_marketing_report_targets
  ADD COLUMN channel text NOT NULL DEFAULT 'google'
  CHECK (channel IN ('google', 'meta', 'tiktok'));

ALTER TABLE public.digital_marketing_report_target_assignments
  ADD COLUMN channel text NOT NULL DEFAULT 'google'
  CHECK (channel IN ('google', 'meta', 'tiktok'));

-- Drop old unique indexes
DROP INDEX IF EXISTS public.google_ads_report_targets_unique_monthly;
DROP INDEX IF EXISTS public.google_ads_report_targets_unique_quarterly;
DROP INDEX IF EXISTS public.google_ads_report_target_assignments_unique_monthly;
DROP INDEX IF EXISTS public.google_ads_report_target_assignments_unique_quarterly;

-- Migrate Google catalog metric keys to Report keys
UPDATE public.digital_marketing_report_targets SET metric_key = 'cost' WHERE metric_key = 'spent';
UPDATE public.digital_marketing_report_targets SET metric_key = 'cpc' WHERE metric_key = 'avg_cpc';
UPDATE public.digital_marketing_report_targets SET metric_key = 'cpa' WHERE metric_key = 'cost_per_conv';
UPDATE public.digital_marketing_report_targets SET metric_key = 'converted_leads' WHERE metric_key = 'conversions';

-- Remove targets outside the Report metric set
DELETE FROM public.digital_marketing_report_targets
WHERE metric_key NOT IN ('cost', 'cpc', 'cpa', 'converted_leads', 'impressions', 'ctr', 'clicks');

-- Migrate selected_metrics arrays in period settings
UPDATE public.digital_marketing_report_target_period_settings ps
SET selected_metrics = sub.mapped
FROM (
  SELECT
    id,
    COALESCE(
      array_agg(
        CASE m
          WHEN 'spent' THEN 'cost'
          WHEN 'avg_cpc' THEN 'cpc'
          WHEN 'cost_per_conv' THEN 'cpa'
          WHEN 'conversions' THEN 'converted_leads'
          WHEN 'cost' THEN 'cost'
          WHEN 'cpc' THEN 'cpc'
          WHEN 'cpa' THEN 'cpa'
          WHEN 'converted_leads' THEN 'converted_leads'
          WHEN 'impressions' THEN 'impressions'
          WHEN 'ctr' THEN 'ctr'
          WHEN 'clicks' THEN 'clicks'
          ELSE NULL
        END
        ORDER BY ord
      ) FILTER (WHERE m IS NOT NULL),
      '{}'::text[]
    ) AS mapped
  FROM public.digital_marketing_report_target_period_settings,
    unnest(selected_metrics) WITH ORDINALITY AS t(m, ord)
  GROUP BY id
) sub
WHERE ps.id = sub.id;

-- Rebuild unique indexes (channel + account_id)
CREATE UNIQUE INDEX digital_marketing_report_targets_unique_monthly
  ON public.digital_marketing_report_targets (organization_id, channel, account_id, metric_key, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX digital_marketing_report_targets_unique_quarterly
  ON public.digital_marketing_report_targets (organization_id, channel, account_id, metric_key, year, quarter)
  WHERE period_type = 'quarterly';

CREATE UNIQUE INDEX digital_marketing_report_target_assignments_unique_monthly
  ON public.digital_marketing_report_target_assignments (organization_id, channel, account_id, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX digital_marketing_report_target_assignments_unique_quarterly
  ON public.digital_marketing_report_target_assignments (organization_id, channel, account_id, year, quarter)
  WHERE period_type = 'quarterly';

COMMENT ON TABLE public.digital_marketing_report_targets IS
  'Paid ads KPI targets per channel/account/metric for Digital Marketing Report (Google, Meta, TikTok).';

COMMENT ON TABLE public.digital_marketing_report_target_assignments IS
  'Per-channel account PIC for Digital Marketing Report KPI targets.';

COMMENT ON TABLE public.digital_marketing_report_target_period_settings IS
  'Per-period Company Objective, selected Report metric keys, and synced department objective for DM Report KPI targets.';
