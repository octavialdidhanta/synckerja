-- When resolve clears live assignee on whatsapp_conversations, still attribute surveys to the
-- agent who handled the chat (OLD.assignee_id) at resolve time.

CREATE OR REPLACE FUNCTION public.enqueue_customer_survey_on_wa_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_assignee_id uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_status_id IS NOT DISTINCT FROM OLD.lead_status_id THEN
    RETURN NEW;
  END IF;

  IF coalesce(lower(trim(NEW.channel::text)), 'whatsapp') <> 'whatsapp' THEN
    RETURN NEW;
  END IF;

  v_assignee_id := COALESCE(NEW.assignee_id, OLD.assignee_id);

  IF v_assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.lead_status_is_resolved_survey(NEW.lead_status_id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.is_enabled, false)
  INTO v_enabled
  FROM public.organization_customer_survey_settings s
  WHERE s.organization_id = NEW.organization_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customer_survey_invitations (
    organization_id,
    whatsapp_conversation_id,
    phone_number_id,
    assignee_id,
    status,
    resolve_marked_at
  )
  VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.phone_number_id,
    v_assignee_id,
    'pending_send',
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_customer_survey_on_wa_resolve() IS
  'Enqueue CES survey on WA resolve; assignee_id snapshot uses NEW or OLD assignee so live assignee can be cleared on same UPDATE.';
