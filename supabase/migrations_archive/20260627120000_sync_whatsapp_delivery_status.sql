-- Sync Meta webhook delivery status into lead_submissions + sales_invoices.

-- 1) lead_submissions: allow delivered
ALTER TABLE public.lead_submissions
  DROP CONSTRAINT IF EXISTS lead_submissions_whatsapp_status_check;

ALTER TABLE public.lead_submissions
  ADD CONSTRAINT lead_submissions_whatsapp_status_check
  CHECK (
    whatsapp_status IS NULL
    OR whatsapp_status = ANY (
      ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'skipped'::text]
    )
  );

COMMENT ON COLUMN public.lead_submissions.whatsapp_status IS
  'WhatsApp lead confirmation: pending/sent/delivered/failed/skipped. sent=Meta accepted; delivered/failed updated async via webhook.';

-- 2) sales_invoices: skip reason for delivery failures
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS whatsapp_skip_reason text NULL;

COMMENT ON COLUMN public.sales_invoices.whatsapp_skip_reason IS
  'Why invoice WA failed: meta: (Graph reject) or meta_delivery: (webhook delivery failure).';

-- 3) Indexes for webhook lookup by wamid
CREATE INDEX IF NOT EXISTS idx_lead_submissions_whatsapp_message_id
  ON public.lead_submissions (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_whatsapp_message_id
  ON public.sales_invoices (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- 4) Backfill from whatsapp_messages (historical drift)
UPDATE public.lead_submissions ls
SET
  whatsapp_status = 'failed',
  whatsapp_skip_reason = LEFT(
    COALESCE(
      'meta_delivery:#'
        || NULLIF(TRIM(wm.raw_metadata #>> '{whatsapp_webhook,last_status,errors,0,code}'), '')
        || ':'
        || COALESCE(
          NULLIF(TRIM(wm.raw_metadata #>> '{whatsapp_webhook,last_status,errors,0,message}'), ''),
          NULLIF(TRIM(wm.raw_metadata #>> '{whatsapp_webhook,last_status,errors,0,title}'), ''),
          'delivery_failed'
        ),
      'meta_delivery:delivery_failed'
    ),
    500
  ),
  updated_at = now()
FROM public.whatsapp_messages wm
WHERE ls.whatsapp_message_id = wm.wa_message_id
  AND ls.whatsapp_status = 'sent'
  AND lower(wm.status) = 'failed';

UPDATE public.lead_submissions ls
SET
  whatsapp_status = 'delivered',
  updated_at = now()
FROM public.whatsapp_messages wm
WHERE ls.whatsapp_message_id = wm.wa_message_id
  AND ls.whatsapp_status = 'sent'
  AND lower(wm.status) IN ('delivered', 'read');

UPDATE public.sales_invoices si
SET
  whatsapp_status = 'failed',
  whatsapp_skip_reason = LEFT(
    COALESCE(
      'meta_delivery:#'
        || NULLIF(TRIM(wm.raw_metadata #>> '{whatsapp_webhook,last_status,errors,0,code}'), '')
        || ':'
        || COALESCE(
          NULLIF(TRIM(wm.raw_metadata #>> '{whatsapp_webhook,last_status,errors,0,message}'), ''),
          NULLIF(TRIM(wm.raw_metadata #>> '{whatsapp_webhook,last_status,errors,0,title}'), ''),
          'delivery_failed'
        ),
      'meta_delivery:delivery_failed'
    ),
    500
  ),
  updated_at = now()
FROM public.whatsapp_messages wm
WHERE si.whatsapp_message_id = wm.wa_message_id
  AND si.whatsapp_status IN ('sent', 'pending')
  AND lower(wm.status) = 'failed';

UPDATE public.sales_invoices si
SET
  whatsapp_status = 'delivered',
  updated_at = now()
FROM public.whatsapp_messages wm
WHERE si.whatsapp_message_id = wm.wa_message_id
  AND si.whatsapp_status IN ('sent', 'pending')
  AND lower(wm.status) IN ('delivered', 'read');
