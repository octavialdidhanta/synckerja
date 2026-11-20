-- Block WA leads/conversations from resolving without lead_submissions.email (non-empty).

CREATE OR REPLACE FUNCTION public.lead_submission_email_ok(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT s.email, s.status, s.submitted_at, s.updated_at
      FROM public.lead_submissions s
      WHERE s.lead_id = p_lead_id
        AND COALESCE(s.is_active, true) = true
        AND s.email IS NOT NULL
        AND btrim(s.email::text) <> ''
      ORDER BY
        CASE
          WHEN s.status = 'submitted' THEN 0
          WHEN s.status = 'draft' THEN 1
          ELSE 2
        END,
        s.submitted_at DESC NULLS LAST,
        s.updated_at DESC
      LIMIT 1
    ) picked
  );
$$;

CREATE OR REPLACE FUNCTION public.is_resolved_lead_status_id(p_status_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_statuses ls
    WHERE ls.id = p_status_id
      AND lower(btrim(ls.name)) IN ('closed', 'resolve')
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_wa_resolve_submission_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_ticket text;
BEGIN
  IF TG_TABLE_NAME = 'leads' THEN
    IF NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_resolved_lead_status_id(NEW.status_id) THEN
      RETURN NEW;
    END IF;
    v_ticket := COALESCE(NEW.ticket_id, '');
    IF upper(btrim(v_ticket)) NOT LIKE 'WA-%' THEN
      RETURN NEW;
    END IF;
    v_lead_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'whatsapp_conversations' THEN
    IF NEW.lead_status_id IS NOT DISTINCT FROM OLD.lead_status_id THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_resolved_lead_status_id(NEW.lead_status_id) THEN
      RETURN NEW;
    END IF;
    v_ticket := COALESCE(NEW.ticket_id, '');
    IF upper(btrim(v_ticket)) NOT LIKE 'WA-%' THEN
      RETURN NEW;
    END IF;
    SELECT l.id
    INTO v_lead_id
    FROM public.leads l
    WHERE l.organization_id = NEW.organization_id
      AND l.ticket_id ILIKE v_ticket
    ORDER BY l.updated_at DESC NULLS LAST
    LIMIT 1;
    IF v_lead_id IS NULL THEN
      RAISE EXCEPTION 'resolve_email_required' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NOT public.lead_submission_email_ok(v_lead_id) THEN
    RAISE EXCEPTION 'resolve_email_required' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_wa_resolve_submission_email ON public.leads;
CREATE TRIGGER trg_leads_wa_resolve_submission_email
  BEFORE UPDATE OF status_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_wa_resolve_submission_email();

DROP TRIGGER IF EXISTS trg_whatsapp_conversations_wa_resolve_submission_email ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_wa_resolve_submission_email
  BEFORE UPDATE OF lead_status_id ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_wa_resolve_submission_email();
