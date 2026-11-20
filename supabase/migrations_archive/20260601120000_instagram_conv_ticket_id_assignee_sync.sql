-- Instagram DM: stable ticket_id + lead assignee sync (no manual SQL for each assign).

-- 1) Normalize existing ticket_id to IG-{first 8 hex of conversation uuid}
UPDATE public.instagram_conversations ic
SET
  ticket_id = 'IG-' || UPPER(SUBSTRING(REPLACE(ic.id::text, '-', ''), 1, 8)),
  updated_at = NOW()
WHERE ic.ticket_id IS DISTINCT FROM 'IG-' || UPPER(SUBSTRING(REPLACE(ic.id::text, '-', ''), 1, 8));

-- 2) Backfill conversation assignee from leads (one-time for rows already assigned in UI)
UPDATE public.instagram_conversations ic
SET
  assignee_id = l.assignee_id,
  updated_at = NOW()
FROM public.leads l
WHERE l.organization_id = ic.organization_id
  AND l.assignee_id IS NOT NULL
  AND (ic.assignee_id IS NULL)
  AND l.ticket_id IS NOT NULL
  AND TRIM(l.ticket_id) <> ''
  AND (
    UPPER(TRIM(l.ticket_id)) = UPPER(TRIM(ic.ticket_id))
    OR UPPER(TRIM(l.ticket_id)) = 'IG-' || UPPER(SUBSTRING(REPLACE(ic.id::text, '-', ''), 1, 8))
  );

-- 3) Always store canonical ticket_id on new/updated Instagram conversations
CREATE OR REPLACE FUNCTION public.instagram_conversations_normalize_ticket_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ticket_id := 'IG-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instagram_conversations_normalize_ticket_id ON public.instagram_conversations;
CREATE TRIGGER trg_instagram_conversations_normalize_ticket_id
  BEFORE INSERT OR UPDATE OF ticket_id ON public.instagram_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.instagram_conversations_normalize_ticket_id();

-- 4) Leads Management assignee/status → instagram_conversations (reverse of sync_instagram_conv_status_to_lead)
CREATE OR REPLACE FUNCTION public.sync_lead_assignee_to_instagram_conv()
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
  IF v_ticket = '' OR NEW.organization_id IS NULL OR v_ticket NOT LIKE 'IG-%' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id
    AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  SELECT ic.id INTO v_conv_id
  FROM public.instagram_conversations ic
  WHERE ic.organization_id = NEW.organization_id
    AND (
      UPPER(TRIM(COALESCE(ic.ticket_id, ''))) = v_ticket
      OR ('IG-' || UPPER(SUBSTRING(REPLACE(ic.id::text, '-', ''), 1, 8))) = v_ticket
    )
  ORDER BY ic.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.instagram_conversations ic
  SET
    assignee_id = NEW.assignee_id,
    lead_status_id = COALESCE(NEW.status_id, ic.lead_status_id),
    updated_at = NOW()
  WHERE ic.id = v_conv_id
    AND (
      ic.assignee_id IS DISTINCT FROM NEW.assignee_id
      OR ic.lead_status_id IS DISTINCT FROM NEW.status_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_assignee_to_instagram_conv ON public.leads;
CREATE TRIGGER trg_sync_lead_assignee_to_instagram_conv
  AFTER UPDATE OF assignee_id, status_id ON public.leads
  FOR EACH ROW
  WHEN (
    NEW.ticket_id IS NOT NULL
    AND TRIM(NEW.ticket_id) <> ''
    AND UPPER(TRIM(NEW.ticket_id)) LIKE 'IG-%'
  )
  EXECUTE FUNCTION public.sync_lead_assignee_to_instagram_conv();

COMMENT ON FUNCTION public.sync_lead_assignee_to_instagram_conv() IS
  'When assignee/status changes on leads (IG-* ticket), sync to instagram_conversations so Live Chat send gate works without manual SQL.';
