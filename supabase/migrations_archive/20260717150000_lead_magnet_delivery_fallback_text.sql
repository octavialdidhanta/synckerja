-- Lead Magnet: optional IG fallback copy when WhatsApp/email delivery fails.

ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS delivery_fallback_text text NULL;

COMMENT ON COLUMN public.lead_magnet_campaigns.delivery_fallback_text IS
  'Instagram DM text when async WhatsApp/email delivery fails after contact gate (Contact Gate ON).';
