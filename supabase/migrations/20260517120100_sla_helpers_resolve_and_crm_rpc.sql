-- SLA helpers: channel normalize, working-minute due dates, policy resolution, CRM RPC.

CREATE OR REPLACE FUNCTION public.normalize_sla_channel(ch text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(nullif(trim(ch), ''), 'whatsapp'))
    WHEN 'wa_cloud' THEN 'whatsapp'
    ELSE lower(coalesce(nullif(trim(ch), ''), 'whatsapp'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.sla__time_to_min(t text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT split_part(t, ':', 1)::integer * 60 + split_part(t, ':', 2)::integer;
$$;

CREATE OR REPLACE FUNCTION public.sla__local_minute_is_working(
  p_at timestamptz,
  p_tz text,
  p_rules jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  loc timestamp;
  dow integer;
  mod integer;
  r jsonb;
  open_m integer;
  close_m integer;
BEGIN
  loc := date_trunc('minute', p_at AT TIME ZONE p_tz);
  dow := EXTRACT(ISODOW FROM loc)::integer;
  mod := EXTRACT(HOUR FROM loc)::integer * 60 + EXTRACT(MINUTE FROM loc)::integer;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_rules, '[]'::jsonb))
  LOOP
    IF (r->>'dow')::integer = dow THEN
      open_m := public.sla__time_to_min(coalesce(r->>'open', '00:00'));
      close_m := public.sla__time_to_min(coalesce(r->>'close', '00:00'));
      IF mod >= open_m AND mod < close_m THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sla_add_working_minutes(
  p_start timestamptz,
  p_work_minutes integer,
  p_profile text,
  p_tz text,
  p_rules jsonb
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur timestamptz := p_start;
  rem integer := greatest(p_work_minutes, 0);
  iter integer := 0;
BEGIN
  IF p_profile IS NULL OR p_profile = '24x7' OR p_work_minutes <= 0 THEN
    RETURN p_start + make_interval(mins => greatest(p_work_minutes, 0));
  END IF;
  WHILE rem > 0 LOOP
    iter := iter + 1;
    IF iter > 3000000 THEN
      RETURN p_start + make_interval(mins => p_work_minutes);
    END IF;
    IF public.sla__local_minute_is_working(cur, p_tz, p_rules) THEN
      rem := rem - 1;
    END IF;
    cur := cur + interval '1 minute';
  END LOOP;
  RETURN cur;
END;
$$;

CREATE OR REPLACE FUNCTION public.sla_working_minutes_between(
  p_from timestamptz,
  p_to timestamptz,
  p_profile text,
  p_tz text,
  p_rules jsonb
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur timestamptz := date_trunc('minute', p_from);
  end_m timestamptz := date_trunc('minute', p_to);
  cnt integer := 0;
  iter integer := 0;
BEGIN
  IF p_to <= p_from THEN
    RETURN 0;
  END IF;
  IF p_profile IS NULL OR p_profile = '24x7' THEN
    RETURN ceil(extract(epoch FROM (p_to - p_from)) / 60.0)::integer;
  END IF;
  WHILE cur < end_m LOOP
    iter := iter + 1;
    IF iter > 3000000 THEN
      RETURN ceil(extract(epoch FROM (p_to - p_from)) / 60.0)::integer;
    END IF;
    IF public.sla__local_minute_is_working(cur, p_tz, p_rules) THEN
      cnt := cnt + 1;
    END IF;
    cur := cur + interval '1 minute';
  END LOOP;
  RETURN cnt;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_sla_policy_row(
  p_organization_id uuid,
  p_channel text
)
RETURNS TABLE (
  fr_min integer,
  res_min integer,
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
      '24x7'::text AS prof,
      'UTC'::text AS ws_tz,
      '[]'::jsonb AS ws_rules
  ),
  picked AS (
    SELECT
      p.first_response_sla_minutes,
      p.resolution_sla_minutes,
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
  'Returns SLA minutes and work calendar for one org + conversation channel; lowest priority number wins.';

GRANT EXECUTE ON FUNCTION public.normalize_sla_channel(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sla__time_to_min(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sla__local_minute_is_working(timestamptz, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sla_add_working_minutes(timestamptz, integer, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sla_working_minutes_between(timestamptz, timestamptz, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_sla_policy_row(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- CRM RPC: per-row policy via LATERAL resolve_sla_policy_row
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_crm_first_response_time_per_room(uuid);

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
      pol.prof,
      pol.ws_tz,
      pol.ws_rules
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
      END AS sla_resolution_late_minutes
    FROM wa_calc w
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
      pol.prof,
      pol.ws_tz,
      pol.ws_rules
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
      END AS sla_resolution_late_minutes
    FROM ig_calc g
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
      pol.prof,
      pol.ws_tz,
      pol.ws_rules
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
      END AS sla_resolution_late_minutes
    FROM em_calc m
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
    f.cycle_started_at,
    f.assignment_due_at,
    f.resolution_due_at,
    f.first_response_at,
    f.resolved_at
  FROM em_final f;
$$;

COMMENT ON FUNCTION public.get_crm_first_response_time_per_room(uuid) IS
  'Latest cycle per WA/IG/email room: SLA statuses and dues from resolve_sla_policy_row + 24x7 or business_hours working minutes.';

GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO service_role;
