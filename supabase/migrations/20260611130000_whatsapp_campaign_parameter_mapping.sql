-- Persist user-defined template variable → recipient list field mapping per campaign.

ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS parameter_mapping jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_campaigns.parameter_mapping IS
  'Slot index (string keys "1","2",…) to mappable field key (import_full_name, fullName, phoneDisplay, …) at campaign create time.';
