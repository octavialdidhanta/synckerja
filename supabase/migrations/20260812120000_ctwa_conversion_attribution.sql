-- Click-to-WhatsApp (CTWA) attribution + offline conversion log extensions.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ctwa_clid text NULL,
  ADD COLUMN IF NOT EXISTS ctwa_referral jsonb NULL,
  ADD COLUMN IF NOT EXISTS ctwa_captured_at timestamptz NULL;

COMMENT ON COLUMN public.whatsapp_conversations.ctwa_clid IS
  'Click-to-WhatsApp click ID from first inbound message referral (Meta ads).';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ctwa_clid text NULL;

COMMENT ON COLUMN public.leads.ctwa_clid IS
  'Click-to-WhatsApp click ID synced from WhatsApp conversation or attribution.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_org_ctwa_clid
  ON public.whatsapp_conversations (organization_id, ctwa_clid)
  WHERE ctwa_clid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_ctwa_clid
  ON public.leads (organization_id, ctwa_clid)
  WHERE ctwa_clid IS NOT NULL;

ALTER TABLE public.meta_ads_conversion_uploads
  ADD COLUMN IF NOT EXISTS ctwa_clid text NULL,
  ADD COLUMN IF NOT EXISTS upload_kind text NULL;

COMMENT ON COLUMN public.meta_ads_conversion_uploads.upload_kind IS
  'Attribution channel uploaded: fbclid, ctwa, or both.';

ALTER TABLE public.meta_ads_conversion_uploads
  DROP CONSTRAINT IF EXISTS meta_ads_conversion_uploads_upload_kind_check;

ALTER TABLE public.meta_ads_conversion_uploads
  ADD CONSTRAINT meta_ads_conversion_uploads_upload_kind_check
  CHECK (upload_kind IS NULL OR upload_kind IN ('fbclid', 'ctwa', 'both'));
