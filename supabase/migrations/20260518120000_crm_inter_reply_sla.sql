-- Inter-reply SLA: extend policy resolver + CRM RPC columns (inbound after first_response → next outbound within ir_min working minutes).

-- ---------------------------------------------------------------------------
-- 1) Policy row: include inter_reply_sla_minutes (NULL = N/A in CRM)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_crm_first_response_time_per_room(uuid);
DROP FUNCTION IF EXISTS public.resolve_sla_policy_row(uuid, text);

CREATE OR REPLACE FUNCTION public.resolve_sla_policy_row(
  p_organization_id uuid,
  p_channel text
)
RETURNS TABLE (
  fr_min integer,
  res_min integer,
  ir_min integer,
  prof text,
  ws_tz text,
  ws_rules jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ch AS (
    SELECT public.normalize_sla_channel(p_channel) AS c
  ),
  fallback AS (
    SELECT
      15::integer AS fr_min,
      1440::integer AS res_min,
      NULL::integer AS ir_min,
      '24x7'::text AS prof,
      'UTC'::text AS ws_tz,
      '[]'::jsonb AS ws_rules
  ),
  picked AS (
    SELECT
      p.first_response_sla_minutes,
      p.resolution_sla_minutes,
      p.inter_reply_sla_minutes,
      p.operational_hours_profile,
      coalesce(ws.timezone, 'Asia/Jakarta') AS tz,
      coalesce(ws.weekly_rules, '[]'::jsonb) AS rules
    FROM public.organization_sla_policies p
    LEFT JOIN public.organization_sla_work_schedules ws ON ws.id = p.work_schedule_id
    WHERE p.organization_id = p_organization_id
      AND p.status = 'active'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.organization_sla_policy_conditions c WHERE c.policy_id = p.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.organization_sla_policy_conditions c
          WHERE c.policy_id = p.id
            AND c.field = 'channel'
            AND c.operator = 'eq'
            AND public.normalize_sla_channel(c.value) = (SELECT ch.c FROM ch)
        )
      )
    ORDER BY p.priority ASC NULLS LAST, p.created_at ASC
    LIMIT 1
  )
  SELECT
    coalesce(picked.first_response_sla_minutes, fb.fr_min),
    coalesce(picked.resolution_sla_minutes, fb.res_min),
    picked.inter_reply_sla_minutes,
    coalesce(picked.operational_hours_profile, fb.prof),
    coalesce(picked.tz, fb.ws_tz),
    CASE
      WHEN picked.first_response_sla_minutes IS NULL THEN fb.ws_rules
      WHEN picked.operational_hours_profile = 'business_hours' THEN picked.rules
      ELSE '[]'::jsonb
    END
  FROM fallback fb
  LEFT JOIN picked ON true;
$$;

COMMENT ON FUNCTION public.resolve_sla_policy_row(uuid, text) IS
  'SLA minutes + work calendar per org/channel; lowest priority wins. ir_min is inter_reply_sla_minutes (NULL = no inter-reply SLA).';

GRANT EXECUTE ON FUNCTION public.resolve_sla_policy_row(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Worst inter-reply breach in cycle from ordered message JSON
--    p_msgs: jsonb array of {"at": "<timestamptz ISO>", "dir": "inbound"|"outbound"} ascending by at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sla_inter_reply_worst_in_cycle(
  p_ir_min integer,
  p_prof text,
  p_tz text,
  p_rules jsonb,
  p_first_response_at timestamptz,
  p_resolved_at timestamptz,
  p_msgs jsonb
)
RETURNS TABLE (
  ir_status text,
  ir_late integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eval_at timestamptz;
  arr jsonb;
  i int;
  j int;
  n int;
  at_i timestamptz;
  dir_i text;
  at_j timestamptz;
  dir_j text;
  due_at timestamptz;
  next_out timestamptz;
  reply_at timestamptz;
  gap_late int;
  worst int := 0;
  has_qualifying_inbound boolean := false;
  has_pending boolean := false;
  open_cycle boolean;
BEGIN
  ir_status := 'na';
  ir_late := NULL;

  IF p_ir_min IS NULL OR p_ir_min <= 0 OR p_first_response_at IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  arr := coalesce(p_msgs, '[]'::jsonb);
  IF jsonb_typeof(arr) <> 'array' THEN
    RETURN NEXT;
    RETURN;
  END IF;

  n := coalesce(jsonb_array_length(arr), 0);
  IF n = 0 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  eval_at := coalesce(p_resolved_at, now());
  open_cycle := p_resolved_at IS NULL;

  FOR i IN 0..(n - 1) LOOP
    dir_i := lower(trim(coalesce(arr->i->>'dir', '')));
    IF dir_i <> 'inbound' THEN
      CONTINUE;
    END IF;
    at_i := (arr->i->>'at')::timestamptz;
    IF at_i IS NULL OR at_i <= p_first_response_at THEN
      CONTINUE;
    END IF;

    has_qualifying_inbound := true;
    due_at := public.sla_add_working_minutes(at_i, p_ir_min, p_prof, p_tz, p_rules);

    next_out := NULL;
    FOR j IN (i + 1)..(n - 1) LOOP
      dir_j := lower(trim(coalesce(arr->j->>'dir', '')));
      IF dir_j = 'outbound' THEN
        at_j := (arr->j->>'at')::timestamptz;
        IF at_j IS NOT NULL AND at_j > at_i THEN
          next_out := at_j;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    IF next_out IS NOT NULL THEN
      reply_at := next_out;
    ELSE
      reply_at := eval_at;
    END IF;

    IF reply_at > due_at THEN
      gap_late := greatest(
        0,
        public.sla_working_minutes_between(due_at, reply_at, p_prof, p_tz, p_rules)
      );
    ELSE
      gap_late := 0;
    END IF;

    IF gap_late > worst THEN
      worst := gap_late;
    END IF;

    IF next_out IS NULL AND open_cycle AND eval_at <= due_at THEN
      has_pending := true;
    END IF;
  END LOOP;

  IF NOT has_qualifying_inbound THEN
    ir_status := 'na';
    ir_late := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF worst > 0 THEN
    ir_status := 'late';
    ir_late := worst;
  ELSIF has_pending THEN
    ir_status := 'pending';
    ir_late := NULL;
  ELSE
    ir_status := 'on_time';
    ir_late := NULL;
  END IF;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.sla_inter_reply_worst_in_cycle(integer, text, text, jsonb, timestamptz, timestamptz, jsonb) IS
  'Per cycle: each inbound after first_response_at has due = add_working_minutes(inbound, ir_min). Reply = next outbound after that inbound, else eval_at = coalesce(resolved_at, now()). ir_late = max working minutes past due across gaps. pending = open cycle, unanswered inbound, eval <= due.';

GRANT EXECUTE ON FUNCTION public.sla_inter_reply_worst_in_cycle(integer, text, text, jsonb, timestamptz, timestamptz, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) CRM RPC (same shape as before + inter-reply columns)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_crm_first_response_time_per_room(p_organization_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  customer_display text,
  assignee_name text,
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
  'Latest cycle per WA/IG/email room: first reply + resolution + inter-reply SLA. Inter-reply: each inbound after first_response_at must get an outbound within ir_min working minutes; aggregate = worst breach; eval_at = coalesce(resolved_at, now()) when no outbound yet.';

GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO service_role;

COMMENT ON COLUMN public.organization_sla_policies.inter_reply_sla_minutes IS
  'After first agent reply in a cycle, each subsequent customer inbound must receive the next agent outbound within this many working minutes (CRM inter-reply SLA). NULL disables the metric for matched policy.';
