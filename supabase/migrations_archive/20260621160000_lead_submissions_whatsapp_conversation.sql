-- Link lead submissions to livechat thread after Public API auto-send.

ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS whatsapp_conversation_id uuid NULL
  REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lead_submissions.whatsapp_conversation_id IS
  'WhatsApp conversation created/updated when POST /api/v1/leads sends confirmation template (livechat thread).';

CREATE INDEX IF NOT EXISTS idx_lead_submissions_whatsapp_conversation_id
  ON public.lead_submissions (whatsapp_conversation_id)
  WHERE whatsapp_conversation_id IS NOT NULL;
