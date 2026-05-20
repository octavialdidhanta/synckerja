-- Active livechat threads may lack whatsapp_conversation_cycles rows (pre-feature convos,
-- outbound-first, or inbound that did not match reopen logic). SLA RPC returned empty while
-- messages + assignee exist. Ensure an open cycle before computing SLA snapshot.

CREATE OR REPLACE FUNCTION public.ensure_open_whatsapp_conversation_cycle(
  p_organization_id uuid,
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_open_cycle_id uuid;
  v_cycle_started timestamptz;
  v_last_resolved timestamptz;
  v_first_out timestamptz;
BEGIN
  SELECT c.id, c.first_inbound_at, c.created_at
  INTO v_conv
  FROM public.whatsapp_conversations c
  WHERE c.id = p_conversation_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT cy.id
  INTO v_open_cycle_id
  FROM public.whatsapp_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id
    AND cy.resolved_at IS NULL
  ORDER BY cy.cycle_started_at DESC
  LIMIT 1;

  IF v_open_cycle_id IS NOT NULL THEN
    SELECT MIN(m.created_at)
    INTO v_first_out
    FROM public.whatsapp_messages m
    INNER JOIN public.whatsapp_conversation_cycles cy ON cy.id = v_open_cycle_id
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'outbound'
      AND m.created_at >= cy.cycle_started_at;

    IF v_first_out IS NOT NULL THEN
      UPDATE public.whatsapp_conversation_cycles
      SET
        first_response_at = coalesce(first_response_at, v_first_out),
        updated_at = now()
      WHERE id = v_open_cycle_id
        AND first_response_at IS NULL;
    END IF;
    RETURN;
  END IF;

  SELECT MAX(cy.resolved_at)
  INTO v_last_resolved
  FROM public.whatsapp_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id;

  SELECT coalesce(
    (
      SELECT MIN(m.created_at)
      FROM public.whatsapp_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
        AND (v_last_resolved IS NULL OR m.created_at > v_last_resolved)
    ),
    (
      SELECT MIN(m.created_at)
      FROM public.whatsapp_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
    ),
    v_conv.first_inbound_at,
    v_conv.created_at,
    now()
  )
  INTO v_cycle_started;

  SELECT MIN(m.created_at)
  INTO v_first_out
  FROM public.whatsapp_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.direction = 'outbound'
    AND m.created_at >= v_cycle_started;

  INSERT INTO public.whatsapp_conversation_cycles (
    conversation_id,
    cycle_started_at,
    first_response_at
  )
  VALUES (
    p_conversation_id,
    v_cycle_started,
    v_first_out
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_open_instagram_conversation_cycle(
  p_organization_id uuid,
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_open_cycle_id uuid;
  v_cycle_started timestamptz;
  v_last_resolved timestamptz;
  v_first_out timestamptz;
BEGIN
  SELECT c.id, c.created_at
  INTO v_conv
  FROM public.instagram_conversations c
  WHERE c.id = p_conversation_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT cy.id
  INTO v_open_cycle_id
  FROM public.instagram_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id
    AND cy.resolved_at IS NULL
  ORDER BY cy.cycle_started_at DESC
  LIMIT 1;

  IF v_open_cycle_id IS NOT NULL THEN
    SELECT MIN(m.created_at)
    INTO v_first_out
    FROM public.instagram_messages m
    INNER JOIN public.instagram_conversation_cycles cy ON cy.id = v_open_cycle_id
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'outbound'
      AND m.created_at >= cy.cycle_started_at;

    IF v_first_out IS NOT NULL THEN
      UPDATE public.instagram_conversation_cycles
      SET
        first_response_at = coalesce(first_response_at, v_first_out),
        updated_at = now()
      WHERE id = v_open_cycle_id
        AND first_response_at IS NULL;
    END IF;
    RETURN;
  END IF;

  SELECT MAX(cy.resolved_at)
  INTO v_last_resolved
  FROM public.instagram_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id;

  SELECT coalesce(
    (
      SELECT MIN(m.created_at)
      FROM public.instagram_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
        AND (v_last_resolved IS NULL OR m.created_at > v_last_resolved)
    ),
    (
      SELECT MIN(m.created_at)
      FROM public.instagram_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
    ),
    v_conv.created_at,
    now()
  )
  INTO v_cycle_started;

  SELECT MIN(m.created_at)
  INTO v_first_out
  FROM public.instagram_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.direction = 'outbound'
    AND m.created_at >= v_cycle_started;

  INSERT INTO public.instagram_conversation_cycles (
    conversation_id,
    cycle_started_at,
    first_response_at
  )
  VALUES (
    p_conversation_id,
    v_cycle_started,
    v_first_out
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_open_email_conversation_cycle(
  p_organization_id uuid,
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_open_cycle_id uuid;
  v_cycle_started timestamptz;
  v_last_resolved timestamptz;
  v_first_out timestamptz;
BEGIN
  SELECT c.id, c.created_at
  INTO v_conv
  FROM public.email_conversations c
  WHERE c.id = p_conversation_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT cy.id
  INTO v_open_cycle_id
  FROM public.email_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id
    AND cy.resolved_at IS NULL
  ORDER BY cy.cycle_started_at DESC
  LIMIT 1;

  IF v_open_cycle_id IS NOT NULL THEN
    SELECT MIN(m.created_at)
    INTO v_first_out
    FROM public.email_messages m
    INNER JOIN public.email_conversation_cycles cy ON cy.id = v_open_cycle_id
    WHERE m.conversation_id = p_conversation_id
      AND m.direction = 'outbound'
      AND m.created_at >= cy.cycle_started_at;

    IF v_first_out IS NOT NULL THEN
      UPDATE public.email_conversation_cycles
      SET
        first_response_at = coalesce(first_response_at, v_first_out),
        updated_at = now()
      WHERE id = v_open_cycle_id
        AND first_response_at IS NULL;
    END IF;
    RETURN;
  END IF;

  SELECT MAX(cy.resolved_at)
  INTO v_last_resolved
  FROM public.email_conversation_cycles cy
  WHERE cy.conversation_id = p_conversation_id;

  SELECT coalesce(
    (
      SELECT MIN(m.created_at)
      FROM public.email_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
        AND (v_last_resolved IS NULL OR m.created_at > v_last_resolved)
    ),
    (
      SELECT MIN(m.created_at)
      FROM public.email_messages m
      WHERE m.conversation_id = p_conversation_id
        AND m.direction = 'inbound'
    ),
    v_conv.created_at,
    now()
  )
  INTO v_cycle_started;

  SELECT MIN(m.created_at)
  INTO v_first_out
  FROM public.email_messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.direction = 'outbound'
    AND m.created_at >= v_cycle_started;

  INSERT INTO public.email_conversation_cycles (
    conversation_id,
    cycle_started_at,
    first_response_at
  )
  VALUES (
    p_conversation_id,
    v_cycle_started,
    v_first_out
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_open_omnichannel_conversation_cycle(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_channel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch text := public.normalize_sla_channel(p_channel);
BEGIN
  IF v_ch = 'whatsapp' THEN
    PERFORM public.ensure_open_whatsapp_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'instagram' THEN
    PERFORM public.ensure_open_instagram_conversation_cycle(p_organization_id, p_conversation_id);
  ELSIF v_ch = 'email' THEN
    PERFORM public.ensure_open_email_conversation_cycle(p_organization_id, p_conversation_id);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.ensure_open_omnichannel_conversation_cycle(uuid, uuid, text) IS
  'Creates or backfills an open conversation cycle for SLA when missing (livechat quick action).';

REVOKE ALL ON FUNCTION public.ensure_open_whatsapp_conversation_cycle(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_open_instagram_conversation_cycle(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_open_email_conversation_cycle(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_open_omnichannel_conversation_cycle(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_open_whatsapp_conversation_cycle(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_open_instagram_conversation_cycle(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_open_email_conversation_cycle(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_open_omnichannel_conversation_cycle(uuid, uuid, text) TO authenticated, service_role;

-- Patch get_crm_sla_for_conversation to ensure cycle exists before read.
CREATE OR REPLACE FUNCTION public.get_crm_sla_for_conversation(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_channel text
)
RETURNS TABLE (
  conversation_id uuid,
  assignment_due_at timestamptz,
  resolution_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  sla_first_reply_status text,
  sla_first_reply_late_minutes integer,
  sla_resolution_status text,
  sla_resolution_late_minutes integer,
  sla_inter_reply_status text,
  sla_inter_reply_late_minutes integer,
  first_response_sla_minutes integer,
  resolution_sla_minutes integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch text := public.normalize_sla_channel(p_channel);
BEGIN
  PERFORM public.ensure_open_omnichannel_conversation_cycle(
    p_organization_id,
    p_conversation_id,
    v_ch
  );

  IF v_ch = 'whatsapp' THEN
    RETURN QUERY
    WITH wa_rows AS (
      SELECT
        c.id AS conversation_id,
        cy.cycle_started_at,
        cy.first_assignee_in_cycle_at,
        cy.first_response_at,
        cy.resolved_at,
        pol.fr_min,
        pol.res_min,
        pol.ir_min,
        pol.prof,
        pol.ws_tz,
        pol.ws_rules,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'at', to_jsonb(m.created_at),
              'dir', to_jsonb(m.direction)
            )
            ORDER BY m.created_at
          )
          FROM public.whatsapp_messages m
          WHERE m.conversation_id = c.id
            AND m.created_at >= cy.cycle_started_at
            AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
        ) AS msg_json
      FROM public.whatsapp_conversation_cycles cy
      INNER JOIN public.whatsapp_conversations c
        ON c.id = cy.conversation_id
       AND c.organization_id = p_organization_id
       AND c.id = p_conversation_id
      CROSS JOIN LATERAL public.resolve_sla_policy_row(
        p_organization_id,
        coalesce(nullif(lower(trim(c.channel)), ''), 'whatsapp')
      ) pol
      ORDER BY cy.cycle_started_at DESC
      LIMIT 1
    ),
    wa_calc AS (
      SELECT
        w.*,
        CASE
          WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
          WHEN w.prof = '24x7' OR w.prof IS NULL THEN
            w.first_assignee_in_cycle_at + make_interval(mins => w.fr_min)
          ELSE public.sla_add_working_minutes(
            w.first_assignee_in_cycle_at, w.fr_min, w.prof, w.ws_tz, w.ws_rules
          )
        END AS fr_due,
        CASE
          WHEN w.first_response_at IS NULL THEN NULL::timestamptz
          WHEN w.prof = '24x7' OR w.prof IS NULL THEN
            w.first_response_at + make_interval(mins => w.res_min)
          ELSE public.sla_add_working_minutes(
            w.first_response_at, w.res_min, w.prof, w.ws_tz, w.ws_rules
          )
        END AS res_due
      FROM wa_rows w
    ),
    wa_ir AS (
      SELECT
        c.*,
        ir.ir_status AS ir_status,
        ir.ir_late AS ir_late
      FROM wa_calc c
      LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
        c.ir_min,
        c.prof,
        c.ws_tz,
        c.ws_rules,
        c.first_response_at,
        c.resolved_at,
        c.msg_json
      ) ir ON true
    ),
    wa_final AS (
      SELECT
        w.conversation_id,
        w.first_response_at,
        w.resolved_at,
        CASE WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE w.fr_due END AS assignment_due_at,
        w.res_due AS resolution_due_at,
        CASE
          WHEN w.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
          WHEN w.first_response_at IS NOT NULL AND w.first_response_at <= w.fr_due THEN 'on_time'::text
          WHEN w.first_response_at IS NOT NULL AND w.first_response_at > w.fr_due THEN 'late'::text
          WHEN w.first_response_at IS NULL AND now() <= w.fr_due THEN 'pending'::text
          WHEN w.first_response_at IS NULL AND now() > w.fr_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_first_reply_status,
        CASE
          WHEN w.first_assignee_in_cycle_at IS NULL THEN NULL::integer
          WHEN w.first_response_at IS NOT NULL AND w.first_response_at > w.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                w.fr_due, w.first_response_at, w.prof, w.ws_tz, w.ws_rules
              )
            )
          WHEN w.first_response_at IS NULL AND now() > w.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(w.fr_due, now(), w.prof, w.ws_tz, w.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_first_reply_late_minutes,
        CASE
          WHEN w.first_response_at IS NULL THEN 'pending'::text
          WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at <= w.res_due THEN 'on_time'::text
          WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at > w.res_due THEN 'late'::text
          WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() <= w.res_due THEN 'pending'::text
          WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() > w.res_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_resolution_status,
        CASE
          WHEN w.first_response_at IS NULL THEN NULL::integer
          WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at > w.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                w.res_due, w.resolved_at, w.prof, w.ws_tz, w.ws_rules
              )
            )
          WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() > w.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(w.res_due, now(), w.prof, w.ws_tz, w.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_resolution_late_minutes,
        coalesce(w.ir_status, 'na'::text) AS sla_inter_reply_status,
        w.ir_late AS sla_inter_reply_late_minutes,
        w.fr_min AS first_response_sla_minutes,
        w.res_min AS resolution_sla_minutes
      FROM wa_ir w
    )
    SELECT
      wf.conversation_id,
      wf.assignment_due_at,
      wf.resolution_due_at,
      wf.first_response_at,
      wf.resolved_at,
      wf.sla_first_reply_status,
      wf.sla_first_reply_late_minutes,
      wf.sla_resolution_status,
      wf.sla_resolution_late_minutes,
      wf.sla_inter_reply_status,
      wf.sla_inter_reply_late_minutes,
      wf.first_response_sla_minutes,
      wf.resolution_sla_minutes
    FROM wa_final wf;

  ELSIF v_ch = 'instagram' THEN
    RETURN QUERY
    WITH ig_rows AS (
      SELECT
        c.id AS conversation_id,
        cy.cycle_started_at,
        cy.first_assignee_in_cycle_at,
        cy.first_response_at,
        cy.resolved_at,
        pol.fr_min,
        pol.res_min,
        pol.ir_min,
        pol.prof,
        pol.ws_tz,
        pol.ws_rules,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'at', to_jsonb(m.created_at),
              'dir', to_jsonb(m.direction)
            )
            ORDER BY m.created_at
          )
          FROM public.instagram_messages m
          WHERE m.conversation_id = c.id
            AND m.created_at >= cy.cycle_started_at
            AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
        ) AS msg_json
      FROM public.instagram_conversation_cycles cy
      INNER JOIN public.instagram_conversations c
        ON c.id = cy.conversation_id
       AND c.organization_id = p_organization_id
       AND c.id = p_conversation_id
      CROSS JOIN LATERAL public.resolve_sla_policy_row(
        p_organization_id,
        'instagram'
      ) pol
      ORDER BY cy.cycle_started_at DESC
      LIMIT 1
    ),
    ig_calc AS (
      SELECT
        g.*,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
          WHEN g.prof = '24x7' OR g.prof IS NULL THEN
            g.first_assignee_in_cycle_at + make_interval(mins => g.fr_min)
          ELSE public.sla_add_working_minutes(
            g.first_assignee_in_cycle_at, g.fr_min, g.prof, g.ws_tz, g.ws_rules
          )
        END AS fr_due,
        CASE
          WHEN g.first_response_at IS NULL THEN NULL::timestamptz
          WHEN g.prof = '24x7' OR g.prof IS NULL THEN
            g.first_response_at + make_interval(mins => g.res_min)
          ELSE public.sla_add_working_minutes(
            g.first_response_at, g.res_min, g.prof, g.ws_tz, g.ws_rules
          )
        END AS res_due
      FROM ig_rows g
    ),
    ig_ir AS (
      SELECT
        c.*,
        ir.ir_status AS ir_status,
        ir.ir_late AS ir_late
      FROM ig_calc c
      LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
        c.ir_min,
        c.prof,
        c.ws_tz,
        c.ws_rules,
        c.first_response_at,
        c.resolved_at,
        c.msg_json
      ) ir ON true
    ),
    ig_final AS (
      SELECT
        g.conversation_id,
        g.first_response_at,
        g.resolved_at,
        CASE WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE g.fr_due END AS assignment_due_at,
        g.res_due AS resolution_due_at,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at <= g.fr_due THEN 'on_time'::text
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN 'late'::text
          WHEN g.first_response_at IS NULL AND now() <= g.fr_due THEN 'pending'::text
          WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_first_reply_status,
        CASE
          WHEN g.first_assignee_in_cycle_at IS NULL THEN NULL::integer
          WHEN g.first_response_at IS NOT NULL AND g.first_response_at > g.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                g.fr_due, g.first_response_at, g.prof, g.ws_tz, g.ws_rules
              )
            )
          WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(g.fr_due, now(), g.prof, g.ws_tz, g.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_first_reply_late_minutes,
        CASE
          WHEN g.first_response_at IS NULL THEN 'pending'::text
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at <= g.res_due THEN 'on_time'::text
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN 'late'::text
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() <= g.res_due THEN 'pending'::text
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_resolution_status,
        CASE
          WHEN g.first_response_at IS NULL THEN NULL::integer
          WHEN g.resolved_at IS NOT NULL AND g.res_due IS NOT NULL AND g.resolved_at > g.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                g.res_due, g.resolved_at, g.prof, g.ws_tz, g.ws_rules
              )
            )
          WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(g.res_due, now(), g.prof, g.ws_tz, g.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_resolution_late_minutes,
        coalesce(g.ir_status, 'na'::text) AS sla_inter_reply_status,
        g.ir_late AS sla_inter_reply_late_minutes,
        g.fr_min AS first_response_sla_minutes,
        g.res_min AS resolution_sla_minutes
      FROM ig_ir g
    )
    SELECT
      wf.conversation_id,
      wf.assignment_due_at,
      wf.resolution_due_at,
      wf.first_response_at,
      wf.resolved_at,
      wf.sla_first_reply_status,
      wf.sla_first_reply_late_minutes,
      wf.sla_resolution_status,
      wf.sla_resolution_late_minutes,
      wf.sla_inter_reply_status,
      wf.sla_inter_reply_late_minutes,
      wf.first_response_sla_minutes,
      wf.resolution_sla_minutes
    FROM ig_final wf;

  ELSIF v_ch = 'email' THEN
    RETURN QUERY
    WITH em_rows AS (
      SELECT
        c.id AS conversation_id,
        cy.cycle_started_at,
        cy.first_assignee_in_cycle_at,
        cy.first_response_at,
        cy.resolved_at,
        pol.fr_min,
        pol.res_min,
        pol.ir_min,
        pol.prof,
        pol.ws_tz,
        pol.ws_rules,
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'at', to_jsonb(m.created_at),
              'dir', to_jsonb(m.direction)
            )
            ORDER BY m.created_at
          )
          FROM public.email_messages m
          WHERE m.conversation_id = c.id
            AND m.created_at >= cy.cycle_started_at
            AND (cy.resolved_at IS NULL OR m.created_at <= cy.resolved_at)
        ) AS msg_json
      FROM public.email_conversation_cycles cy
      INNER JOIN public.email_conversations c
        ON c.id = cy.conversation_id
       AND c.organization_id = p_organization_id
       AND c.id = p_conversation_id
      CROSS JOIN LATERAL public.resolve_sla_policy_row(p_organization_id, 'email') pol
      ORDER BY cy.cycle_started_at DESC
      LIMIT 1
    ),
    em_calc AS (
      SELECT
        m.*,
        CASE
          WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz
          WHEN m.prof = '24x7' OR m.prof IS NULL THEN
            m.first_assignee_in_cycle_at + make_interval(mins => m.fr_min)
          ELSE public.sla_add_working_minutes(
            m.first_assignee_in_cycle_at, m.fr_min, m.prof, m.ws_tz, m.ws_rules
          )
        END AS fr_due,
        CASE
          WHEN m.first_response_at IS NULL THEN NULL::timestamptz
          WHEN m.prof = '24x7' OR m.prof IS NULL THEN
            m.first_response_at + make_interval(mins => m.res_min)
          ELSE public.sla_add_working_minutes(
            m.first_response_at, m.res_min, m.prof, m.ws_tz, m.ws_rules
          )
        END AS res_due
      FROM em_rows m
    ),
    em_ir AS (
      SELECT
        c.*,
        ir.ir_status AS ir_status,
        ir.ir_late AS ir_late
      FROM em_calc c
      LEFT JOIN LATERAL public.sla_inter_reply_worst_in_cycle(
        c.ir_min,
        c.prof,
        c.ws_tz,
        c.ws_rules,
        c.first_response_at,
        c.resolved_at,
        c.msg_json
      ) ir ON true
    ),
    em_final AS (
      SELECT
        m.conversation_id,
        m.first_response_at,
        m.resolved_at,
        CASE WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::timestamptz ELSE m.fr_due END AS assignment_due_at,
        m.res_due AS resolution_due_at,
        CASE
          WHEN m.first_assignee_in_cycle_at IS NULL THEN 'pending'::text
          WHEN m.first_response_at IS NOT NULL AND m.first_response_at <= m.fr_due THEN 'on_time'::text
          WHEN m.first_response_at IS NOT NULL AND m.first_response_at > m.fr_due THEN 'late'::text
          WHEN m.first_response_at IS NULL AND now() <= m.fr_due THEN 'pending'::text
          WHEN m.first_response_at IS NULL AND now() > m.fr_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_first_reply_status,
        CASE
          WHEN m.first_assignee_in_cycle_at IS NULL THEN NULL::integer
          WHEN m.first_response_at IS NOT NULL AND m.first_response_at > m.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                m.fr_due, m.first_response_at, m.prof, m.ws_tz, m.ws_rules
              )
            )
          WHEN m.first_response_at IS NULL AND now() > m.fr_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(m.fr_due, now(), m.prof, m.ws_tz, m.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_first_reply_late_minutes,
        CASE
          WHEN m.first_response_at IS NULL THEN 'pending'::text
          WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at <= m.res_due THEN 'on_time'::text
          WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at > m.res_due THEN 'late'::text
          WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() <= m.res_due THEN 'pending'::text
          WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() > m.res_due THEN 'late'::text
          ELSE 'na'::text
        END AS sla_resolution_status,
        CASE
          WHEN m.first_response_at IS NULL THEN NULL::integer
          WHEN m.resolved_at IS NOT NULL AND m.res_due IS NOT NULL AND m.resolved_at > m.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(
                m.res_due, m.resolved_at, m.prof, m.ws_tz, m.ws_rules
              )
            )
          WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() > m.res_due THEN
            greatest(
              0,
              public.sla_working_minutes_between(m.res_due, now(), m.prof, m.ws_tz, m.ws_rules)
            )
          ELSE NULL::integer
        END AS sla_resolution_late_minutes,
        coalesce(m.ir_status, 'na'::text) AS sla_inter_reply_status,
        m.ir_late AS sla_inter_reply_late_minutes,
        m.fr_min AS first_response_sla_minutes,
        m.res_min AS resolution_sla_minutes
      FROM em_ir m
    )
    SELECT
      wf.conversation_id,
      wf.assignment_due_at,
      wf.resolution_due_at,
      wf.first_response_at,
      wf.resolved_at,
      wf.sla_first_reply_status,
      wf.sla_first_reply_late_minutes,
      wf.sla_resolution_status,
      wf.sla_resolution_late_minutes,
      wf.sla_inter_reply_status,
      wf.sla_inter_reply_late_minutes,
      wf.first_response_sla_minutes,
      wf.resolution_sla_minutes
    FROM em_final wf;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_crm_sla_for_conversation(uuid, uuid, text) IS
  'Latest cycle SLA snapshot for one omnichannel conversation. Ensures open cycle row exists before read.';
