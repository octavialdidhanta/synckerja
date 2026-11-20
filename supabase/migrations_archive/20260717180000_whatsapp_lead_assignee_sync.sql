-- WhatsApp: sync leads.assignee_id/status_id → whatsapp_conversations (mirrors instagram).

UPDATE public.whatsapp_conversations wc
SET
  assignee_id = l.assignee_id,
  updated_at = NOW()
FROM public.leads l
WHERE l.organization_id = wc.organization_id
  AND l.assignee_id IS NOT NULL
  AND wc.assignee_id IS NULL
  AND l.ticket_id IS NOT NULL
  AND TRIM(l.ticket_id) <> ''
  AND (
    UPPER(TRIM(l.ticket_id)) = UPPER(TRIM(wc.ticket_id))
    OR UPPER(TRIM(l.ticket_id)) = 'WA-' || UPPER(SUBSTRING(REPLACE(wc.id::text, '-', ''), 1, 8))
  );

CREATE OR REPLACE FUNCTION public.sync_lead_assignee_to_whatsapp_conv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket text;
  v_conv_id uuid;
BEGIN
  v_ticket := UPPER(TRIM(COALESCE(NEW.ticket_id, '')));
  IF v_ticket = '' OR NEW.organization_id IS NULL OR v_ticket NOT LIKE 'WA-%' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id
    AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  SELECT wc.id INTO v_conv_id
  FROM public.whatsapp_conversations wc
  WHERE wc.organization_id = NEW.organization_id
    AND wc.channel = 'whatsapp'
    AND (
      UPPER(TRIM(COALESCE(wc.ticket_id, ''))) = v_ticket
      OR ('WA-' || UPPER(SUBSTRING(REPLACE(wc.id::text, '-', ''), 1, 8))) = v_ticket
    )
  ORDER BY wc.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.whatsapp_conversations wc
  SET
    assignee_id = NEW.assignee_id,
    lead_status_id = COALESCE(NEW.status_id, wc.lead_status_id),
    updated_at = NOW()
  WHERE wc.id = v_conv_id
    AND (
      wc.assignee_id IS DISTINCT FROM NEW.assignee_id
      OR wc.lead_status_id IS DISTINCT FROM NEW.status_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_assignee_to_whatsapp_conv ON public.leads;
CREATE TRIGGER trg_sync_lead_assignee_to_whatsapp_conv
  AFTER UPDATE OF assignee_id, status_id ON public.leads
  FOR EACH ROW
  WHEN (
    NEW.ticket_id IS NOT NULL
    AND TRIM(NEW.ticket_id) <> ''
    AND UPPER(TRIM(NEW.ticket_id)) LIKE 'WA-%'
  )
  EXECUTE FUNCTION public.sync_lead_assignee_to_whatsapp_conv();

COMMENT ON FUNCTION public.sync_lead_assignee_to_whatsapp_conv() IS
  'When assignee/status changes on leads (WA-* ticket), sync to whatsapp_conversations so Live Chat send gate works.';
