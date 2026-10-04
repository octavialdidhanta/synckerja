-- Optional CTR baseline ("before") on the same percent scale as target_value.
ALTER TABLE public.digital_marketing_report_targets
  ADD COLUMN IF NOT EXISTS baseline_value numeric;
