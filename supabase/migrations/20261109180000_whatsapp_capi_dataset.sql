-- Dataset Conversions API milik WhatsApp Business Account, untuk event Click-to-WhatsApp (ctwa_clid).
-- Diisi otomatis oleh meta-ads-upload-conversion (POST /{WABA_ID}/dataset) saat konversi CTWA pertama.
ALTER TABLE public.organization_whatsapp_accounts
  ADD COLUMN IF NOT EXISTS capi_dataset_id text NULL;

COMMENT ON COLUMN public.organization_whatsapp_accounts.capi_dataset_id IS
  'Meta Conversions API dataset id of this WABA (business messaging / ctwa_clid events).';
