-- Ordinary lead status changes from MCP. Converted, closed, and resolve stay rejected.
-- History is written by the existing trigger. The session user is recorded only
-- when the browser session is empty and the caller is the service role.

CREATE OR REPLACE FUNCTION public.track_lead_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_name text;
  new_name text;
  v_actor uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status_id IS DISTINCT FROM NEW.status_id) THEN
    SELECT name INTO old_name FROM public.lead_statuses WHERE id = OLD.status_id;
    SELECT name INTO new_name FROM public.lead_statuses WHERE id = NEW.status_id;
    v_actor := auth.uid();
    IF v_actor IS NULL AND auth.role() = 'service_role' THEN
      BEGIN
        v_actor := NULLIF(current_setting('mcp.actor_user_id', true), '')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_actor := NULL;
      END;
    END IF;
    INSERT INTO public.lead_status_history (
      lead_id,
      old_status,
      new_status,
      organization_id,
      changed_by
    ) VALUES (
      NEW.id,
      old_name,
      COALESCE(new_name, ''),
      NEW.organization_id,
      v_actor
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_set_lead_status(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_status text
)
RETURNS TABLE (
  id uuid,
  ticket_id text,
  client text,
  title text,
  source text,
  status text,
  fu_priority text,
  assignee text,
  created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_status_name text;
  v_status_id uuid;
  v_current_status uuid;
  v_ticket text;
  v_prefix text;
  v_conv_id uuid;
  v_conv_table text;
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_status_name := NULLIF(btrim(COALESCE(p_status, '')), '');
  IF v_status_name IS NULL OR char_length(v_status_name) > 80
    OR lower(v_status_name) IN ('converted', 'closed', 'resolve') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT ls.id
  INTO v_status_id
  FROM public.lead_statuses ls
  WHERE ls.is_active = true
    AND lower(btrim(ls.name)) = lower(v_status_name)
    AND (ls.organization_id = p_organization_id OR ls.organization_id IS NULL)
  ORDER BY (ls.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, ls.sort_order ASC NULLS LAST
  LIMIT 1;
  IF v_status_id IS NULL THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT lead.status_id, NULLIF(btrim(lead.ticket_id), '')
  INTO v_current_status, v_ticket
  FROM public.leads lead
  WHERE lead.id = p_id
    AND lead.organization_id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_status IS DISTINCT FROM v_status_id THEN
    PERFORM set_config('mcp.actor_user_id', p_user_id::text, true);

    UPDATE public.leads AS lead
    SET status_id = v_status_id, updated_at = now()
    WHERE lead.id = p_id
      AND lead.organization_id = p_organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    SELECT enrollment.conversation_id, enrollment.conversation_table
    INTO v_conv_id, v_conv_table
    FROM public.lead_magnet_enrollments enrollment
    WHERE enrollment.organization_id = p_organization_id
      AND enrollment.lead_id = p_id
      AND enrollment.conversation_id IS NOT NULL
      AND enrollment.conversation_table IN (
        'whatsapp_conversations',
        'instagram_conversations',
        'facebook_conversations',
        'email_conversations'
      )
    ORDER BY enrollment.updated_at DESC
    LIMIT 1;

    v_count := 0;
    IF v_conv_id IS NOT NULL AND v_conv_table = 'instagram_conversations' THEN
      UPDATE public.instagram_conversations AS conversation
      SET lead_status_id = v_status_id, updated_at = now()
      WHERE conversation.id = v_conv_id
        AND conversation.organization_id = p_organization_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSIF v_conv_id IS NOT NULL AND v_conv_table = 'facebook_conversations' THEN
      UPDATE public.facebook_conversations AS conversation
      SET lead_status_id = v_status_id, updated_at = now()
      WHERE conversation.id = v_conv_id
        AND conversation.organization_id = p_organization_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSIF v_conv_id IS NOT NULL AND v_conv_table = 'email_conversations' THEN
      UPDATE public.email_conversations AS conversation
      SET lead_status_id = v_status_id, updated_at = now()
      WHERE conversation.id = v_conv_id
        AND conversation.organization_id = p_organization_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSIF v_conv_id IS NOT NULL AND v_conv_table = 'whatsapp_conversations' THEN
      UPDATE public.whatsapp_conversations AS conversation
      SET lead_status_id = v_status_id, updated_at = now()
      WHERE conversation.id = v_conv_id
        AND conversation.organization_id = p_organization_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;

    IF v_count = 0 AND v_ticket IS NOT NULL THEN
      v_prefix := upper(v_ticket);
      IF left(v_prefix, 3) = 'IG-' THEN
        UPDATE public.instagram_conversations AS conversation
        SET lead_status_id = v_status_id, updated_at = now()
        WHERE conversation.id = (
          SELECT candidate.id
          FROM public.instagram_conversations candidate
          WHERE candidate.organization_id = p_organization_id
            AND lower(btrim(candidate.ticket_id)) = lower(v_ticket)
          LIMIT 1
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count = 0 THEN
          UPDATE public.whatsapp_conversations AS conversation
          SET lead_status_id = v_status_id, updated_at = now()
          WHERE conversation.id = (
            SELECT candidate.id
            FROM public.whatsapp_conversations candidate
            WHERE candidate.organization_id = p_organization_id
              AND lower(btrim(candidate.ticket_id)) = lower(v_ticket)
            LIMIT 1
          );
        END IF;
      ELSIF left(v_prefix, 3) = 'FB-' THEN
        UPDATE public.facebook_conversations AS conversation
        SET lead_status_id = v_status_id, updated_at = now()
        WHERE conversation.id = (
          SELECT candidate.id
          FROM public.facebook_conversations candidate
          WHERE candidate.organization_id = p_organization_id
            AND lower(btrim(candidate.ticket_id)) = lower(v_ticket)
          LIMIT 1
        );
      ELSIF left(v_prefix, 6) = 'EMAIL-' THEN
        UPDATE public.email_conversations AS conversation
        SET lead_status_id = v_status_id, updated_at = now()
        WHERE conversation.id = (
          SELECT candidate.id
          FROM public.email_conversations candidate
          WHERE candidate.organization_id = p_organization_id
            AND lower(btrim(candidate.ticket_id)) = lower(v_ticket)
          LIMIT 1
        );
      ELSIF left(v_prefix, 3) = 'WA-' THEN
        UPDATE public.whatsapp_conversations AS conversation
        SET lead_status_id = v_status_id, updated_at = now()
        WHERE conversation.id = (
          SELECT candidate.id
          FROM public.whatsapp_conversations candidate
          WHERE candidate.organization_id = p_organization_id
            AND lower(btrim(candidate.ticket_id)) = lower(v_ticket)
          LIMIT 1
        );
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    lead.id,
    lead.ticket_id,
    lead.client,
    lead.title,
    lead.source,
    ls.name,
    lead.fu_priority,
    lead.assignee,
    lead.created_at
  FROM public.leads lead
  LEFT JOIN public.lead_statuses ls ON ls.id = lead.status_id
  WHERE lead.id = p_id
    AND lead.organization_id = p_organization_id;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_set_lead_status(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_set_lead_status(uuid, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_lead_status(uuid, uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
