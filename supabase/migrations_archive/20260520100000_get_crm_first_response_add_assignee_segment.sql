-- CRM per-room RPC: add assignee_id + crm_assignee_segment for Performance metric role filters.
-- Segment = mutually exclusive bucket from user_roles (highest precedence role per ORGANIZATION_ROLE_PRECEDENCE),
-- mapped to admin | supervisor | agent; missing assignee or employee.user_id → unassigned; no user_roles → agent.

CREATE OR REPLACE FUNCTION public.crm_assignee_segment_for_org(
  p_organization_id uuid,
  p_assignee_employee_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_assignee_employee_id IS NULL THEN 'unassigned'::text
    WHEN (
      SELECT e.user_id
      FROM public.employees e
      WHERE e.id = p_assignee_employee_id
      LIMIT 1
    ) IS NULL THEN 'unassigned'::text
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.employees e ON e.id = p_assignee_employee_id AND e.user_id = ur.user_id
      WHERE ur.organization_id = p_organization_id
    ) THEN 'agent'::text
    ELSE (
      SELECT CASE
        WHEN lower(trim(cr.role)) IN ('owner', 'admin') THEN 'admin'::text
        WHEN lower(trim(cr.role)) IN ('hr', 'manager') THEN 'supervisor'::text
        WHEN lower(trim(cr.role)) IN ('employee', 'member') THEN 'agent'::text
        ELSE 'agent'::text
      END
      FROM (
        SELECT ur.role
        FROM public.user_roles ur
        JOIN public.employees e ON e.id = p_assignee_employee_id AND e.user_id = ur.user_id
        WHERE ur.organization_id = p_organization_id
        ORDER BY CASE lower(trim(ur.role))
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'hr' THEN 3
          WHEN 'manager' THEN 4
          WHEN 'employee' THEN 5
          WHEN 'member' THEN 6
          ELSE 99
        END
        LIMIT 1
      ) cr
    )
  END;
$$;

COMMENT ON FUNCTION public.crm_assignee_segment_for_org(uuid, uuid) IS
  'CRM metric bucket for conversation assignee: admin (owner/admin), supervisor (hr/manager), agent (employee/member/none); unassigned if no assignee or employee has no user_id.';

REVOKE ALL ON FUNCTION public.crm_assignee_segment_for_org(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_assignee_segment_for_org(uuid, uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_crm_first_response_time_per_room(uuid);

CREATE OR REPLACE FUNCTION public.get_crm_first_response_time_per_room(p_organization_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  customer_display text,
  assignee_name text,
  assignee_id uuid,
  crm_assignee_segment text,
  channel text,
  sla_first_reply_status text,
  sla_first_reply_late_minutes integer,
  sla_resolution_status text,
  sla_resolution_late_minutes integer,
  sla_inter_reply_status text,
  sla_inter_reply_late_minutes integer,
  cycle_started_at timestamptz,
  assignment_due_at timestamptz,
  resolution_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wa_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      coalesce(nullif(trim(c.customer_name), ''), nullif(trim(c.customer_wa_id), ''), '—')::text AS customer_display,
      coalesce(nullif(trim(e.full_name), ''), nullif(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      c.assignee_id AS assignee_id,
      coalesce(nullif(lower(trim(c.channel)), ''), 'whatsapp')::text AS channel,
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
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    CROSS JOIN LATERAL public.resolve_sla_policy_row(
      p_organization_id,
      coalesce(nullif(lower(trim(c.channel)), ''), 'whatsapp')
    ) pol
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
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
      w.customer_display,
      w.assignee_name,
      w.assignee_id,
      public.crm_assignee_segment_for_org(p_organization_id, w.assignee_id) AS crm_assignee_segment,
      w.channel,
      w.cycle_started_at,
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
      w.ir_late AS sla_inter_reply_late_minutes
    FROM wa_ir w
  ),
  ig_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      coalesce(nullif(trim(c.customer_name), ''), nullif(trim(c.customer_ig_id), ''), '—')::text AS customer_display,
      coalesce(nullif(trim(e.full_name), ''), nullif(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      c.assignee_id AS assignee_id,
      'instagram'::text AS channel,
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
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    CROSS JOIN LATERAL public.resolve_sla_policy_row(p_organization_id, 'instagram') pol
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
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
      g.customer_display,
      g.assignee_name,
      g.assignee_id,
      public.crm_assignee_segment_for_org(p_organization_id, g.assignee_id) AS crm_assignee_segment,
      g.channel,
      g.cycle_started_at,
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
      g.ir_late AS sla_inter_reply_late_minutes
    FROM ig_ir g
  ),
  em_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      coalesce(nullif(trim(c.from_email), ''), '—')::text AS customer_display,
      coalesce(nullif(trim(e.full_name), ''), nullif(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      c.assignee_id AS assignee_id,
      'email'::text AS channel,
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
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    CROSS JOIN LATERAL public.resolve_sla_policy_row(p_organization_id, 'email') pol
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
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
      m.customer_display,
      m.assignee_name,
      m.assignee_id,
      public.crm_assignee_segment_for_org(p_organization_id, m.assignee_id) AS crm_assignee_segment,
      m.channel,
      m.cycle_started_at,
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
      m.ir_late AS sla_inter_reply_late_minutes
    FROM em_ir m
  )
  SELECT
    f.conversation_id,
    f.customer_display,
    f.assignee_name,
    f.assignee_id,
    f.crm_assignee_segment,
    f.channel,
    f.sla_first_reply_status,
    f.sla_first_reply_late_minutes,
    f.sla_resolution_status,
    f.sla_resolution_late_minutes,
    f.sla_inter_reply_status,
    f.sla_inter_reply_late_minutes,
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM wa_final f
  UNION ALL
  SELECT
    f.conversation_id,
    f.customer_display,
    f.assignee_name,
    f.assignee_id,
    f.crm_assignee_segment,
    f.channel,
    f.sla_first_reply_status,
    f.sla_first_reply_late_minutes,
    f.sla_resolution_status,
    f.sla_resolution_late_minutes,
    f.sla_inter_reply_status,
    f.sla_inter_reply_late_minutes,
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM ig_final f
  UNION ALL
  SELECT
    f.conversation_id,
    f.customer_display,
    f.assignee_name,
    f.assignee_id,
    f.crm_assignee_segment,
    f.channel,
    f.sla_first_reply_status,
    f.sla_first_reply_late_minutes,
    f.sla_resolution_status,
    f.sla_resolution_late_minutes,
    f.sla_inter_reply_status,
    f.sla_inter_reply_late_minutes,
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM em_final f;
$$;

COMMENT ON FUNCTION public.get_crm_first_response_time_per_room(uuid) IS
  'Latest cycle per WA/IG/email room: SLA columns + assignee_id + crm_assignee_segment (admin|supervisor|agent|unassigned) from user_roles.';

GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO service_role;
