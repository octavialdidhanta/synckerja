-- Meta Cloud API message status webhooks (sent / delivered / read / failed) for campaign template sends.

ALTER TABLE public.whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS wa_delivery_status text NULL,
  ADD COLUMN IF NOT EXISTS wa_delivery_status_at timestamptz NULL;

COMMENT ON COLUMN public.whatsapp_campaign_recipients.wa_delivery_status IS 'Meta outbound lifecycle from webhooks: sent, delivered, read, failed (after Graph API accept).';
COMMENT ON COLUMN public.whatsapp_campaign_recipients.wa_delivery_status_at IS 'Timestamp from Meta status webhook (Unix → timestamptz).';

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_recipients_wa_message_id
  ON public.whatsapp_campaign_recipients (wa_message_id)
  WHERE wa_message_id IS NOT NULL;
