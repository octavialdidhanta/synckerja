-- Messenger: sync leads.assignee_id ↔ facebook_conversations (mirrors instagram_conv_ticket_id_assignee_sync).

UPDATE public.facebook_conversations fc
SET
  ticket_id = 'FB-' || UPPER(SUBSTRING(REPLACE(fc.id::text, '-', ''), 1, 8)),
  updated_at = NOW()
WHERE fc.ticket_id IS DISTINCT FROM 'FB-' || UPPER(SUBSTRING(REPLACE(fc.id::text, '-', ''), 1, 8));

UPDATE public.facebook_conversations fc
SET
  assignee_id = l.assignee_id,
  updated_at = NOW()
FROM public.leads l
WHERE l.organization_id = fc.organization_id
  AND l.assignee_id IS NOT NULL
  AND fc.assignee_id IS NULL
  AND l.ticket_id IS NOT NULL
  AND TRIM(l.ticket_id) <> ''
  AND (
    UPPER(TRIM(l.ticket_id)) = UPPER(TRIM(fc.ticket_id))
    OR UPPER(TRIM(l.ticket_id)) = 'FB-' || UPPER(SUBSTRING(REPLACE(fc.id::text, '-', ''), 1, 8))
  );

CREATE OR REPLACE FUNCTION public.facebook_conversations_normalize_ticket_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ticket_id := 'FB-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facebook_conversations_normalize_ticket_id ON public.facebook_conversations;
CREATE TRIGGER trg_facebook_conversations_normalize_ticket_id
  BEFORE INSERT OR UPDATE OF ticket_id ON public.facebook_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.facebook_conversations_normalize_ticket_id();

CREATE OR REPLACE FUNCTION public.sync_lead_assignee_to_facebook_conv()
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
  IF v_ticket = '' OR NEW.organization_id IS NULL OR v_ticket NOT LIKE 'FB-%' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id
    AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  SELECT fc.id INTO v_conv_id
  FROM public.facebook_conversations fc
  WHERE fc.organization_id = NEW.organization_id
    AND (
      UPPER(TRIM(COALESCE(fc.ticket_id, ''))) = v_ticket
      OR ('FB-' || UPPER(SUBSTRING(REPLACE(fc.id::text, '-', ''), 1, 8))) = v_ticket
    )
  ORDER BY fc.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.facebook_conversations fc
  SET
    assignee_id = NEW.assignee_id,
    lead_status_id = COALESCE(NEW.status_id, fc.lead_status_id),
    updated_at = NOW()
  WHERE fc.id = v_conv_id
    AND (
      fc.assignee_id IS DISTINCT FROM NEW.assignee_id
      OR fc.lead_status_id IS DISTINCT FROM NEW.status_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_assignee_to_facebook_conv ON public.leads;
CREATE TRIGGER trg_sync_lead_assignee_to_facebook_conv
  AFTER UPDATE OF assignee_id, status_id ON public.leads
  FOR EACH ROW
  WHEN (
    NEW.ticket_id IS NOT NULL
    AND TRIM(NEW.ticket_id) <> ''
    AND UPPER(TRIM(NEW.ticket_id)) LIKE 'FB-%'
  )
  EXECUTE FUNCTION public.sync_lead_assignee_to_facebook_conv();

COMMENT ON FUNCTION public.sync_lead_assignee_to_facebook_conv() IS
  'When assignee/status changes on leads (FB-* ticket), sync to facebook_conversations so Live Chat send gate works.';
