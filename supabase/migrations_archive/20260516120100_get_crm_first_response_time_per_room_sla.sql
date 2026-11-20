-- CRM room-cycle RPC: SLA columns (stable status codes + late minutes), dues, UNION WA / IG / Email.

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
  WITH defaults AS (
    SELECT 15::integer AS fr_min, 1440::integer AS res_min
  ),
  cfg AS (
    SELECT
      COALESCE(s.first_response_sla_minutes, d.fr_min) AS fr_min,
      COALESCE(s.resolution_sla_minutes, d.res_min) AS res_min
    FROM defaults d
    LEFT JOIN public.organization_omnichannel_sla s
      ON s.organization_id = p_organization_id
  ),
  wa_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      COALESCE(NULLIF(trim(c.customer_name), ''), NULLIF(trim(c.customer_wa_id), ''), '—')::text AS customer_display,
      COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      COALESCE(NULLIF(lower(trim(c.channel)), ''), 'whatsapp')::text AS channel,
      cy.cycle_started_at,
      cy.first_assignee_in_cycle_at,
      cy.first_response_at,
      cy.resolved_at,
      (SELECT fr_min FROM cfg) AS fr_min,
      (SELECT res_min FROM cfg) AS res_min
    FROM public.whatsapp_conversation_cycles cy
    INNER JOIN public.whatsapp_conversations c
      ON c.id = cy.conversation_id
     AND c.organization_id = p_organization_id
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
  ),
  wa_calc AS (
    SELECT
      w.*,
      (w.first_assignee_in_cycle_at + make_interval(mins => w.fr_min)) AS fr_due,
      CASE
        WHEN w.first_response_at IS NULL THEN NULL::timestamptz
        ELSE w.first_response_at + make_interval(mins => w.res_min)
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
          CEIL(EXTRACT(EPOCH FROM (w.first_response_at - w.fr_due)) / 60.0)::integer
        WHEN w.first_response_at IS NULL AND now() > w.fr_due THEN
          CEIL(EXTRACT(EPOCH FROM (now() - w.fr_due)) / 60.0)::integer
        ELSE NULL::integer
      END AS sla_first_reply_late_minutes,
      CASE
        WHEN w.first_response_at IS NULL THEN 'pending'::text
        WHEN w.resolved_at IS NOT NULL AND w.resolved_at <= w.res_due THEN 'on_time'::text
        WHEN w.resolved_at IS NOT NULL AND w.resolved_at > w.res_due THEN 'late'::text
        WHEN w.resolved_at IS NULL AND now() <= w.res_due THEN 'pending'::text
        WHEN w.resolved_at IS NULL AND now() > w.res_due THEN 'late'::text
        ELSE 'na'::text
      END AS sla_resolution_status,
      CASE
        WHEN w.first_response_at IS NULL THEN NULL::integer
        WHEN w.resolved_at IS NOT NULL AND w.res_due IS NOT NULL AND w.resolved_at > w.res_due THEN
          CEIL(EXTRACT(EPOCH FROM (w.resolved_at - w.res_due)) / 60.0)::integer
        WHEN w.resolved_at IS NULL AND w.res_due IS NOT NULL AND now() > w.res_due THEN
          CEIL(EXTRACT(EPOCH FROM (now() - w.res_due)) / 60.0)::integer
        ELSE NULL::integer
      END AS sla_resolution_late_minutes
    FROM wa_calc w
  ),
  ig_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      COALESCE(NULLIF(trim(c.customer_name), ''), NULLIF(trim(c.customer_ig_id), ''), '—')::text AS customer_display,
      COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      'instagram'::text AS channel,
      cy.cycle_started_at,
      cy.first_assignee_in_cycle_at,
      cy.first_response_at,
      cy.resolved_at,
      (SELECT fr_min FROM cfg) AS fr_min,
      (SELECT res_min FROM cfg) AS res_min
    FROM public.instagram_conversation_cycles cy
    INNER JOIN public.instagram_conversations c
      ON c.id = cy.conversation_id
     AND c.organization_id = p_organization_id
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
  ),
  ig_calc AS (
    SELECT
      g.*,
      (g.first_assignee_in_cycle_at + make_interval(mins => g.fr_min)) AS fr_due,
      CASE
        WHEN g.first_response_at IS NULL THEN NULL::timestamptz
        ELSE g.first_response_at + make_interval(mins => g.res_min)
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
          CEIL(EXTRACT(EPOCH FROM (g.first_response_at - g.fr_due)) / 60.0)::integer
        WHEN g.first_response_at IS NULL AND now() > g.fr_due THEN
          CEIL(EXTRACT(EPOCH FROM (now() - g.fr_due)) / 60.0)::integer
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
          CEIL(EXTRACT(EPOCH FROM (g.resolved_at - g.res_due)) / 60.0)::integer
        WHEN g.resolved_at IS NULL AND g.res_due IS NOT NULL AND now() > g.res_due THEN
          CEIL(EXTRACT(EPOCH FROM (now() - g.res_due)) / 60.0)::integer
        ELSE NULL::integer
      END AS sla_resolution_late_minutes
    FROM ig_calc g
  ),
  em_rows AS (
    SELECT DISTINCT ON (cy.conversation_id)
      c.id AS conversation_id,
      COALESCE(NULLIF(trim(c.from_email), ''), '—')::text AS customer_display,
      COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
      'email'::text AS channel,
      cy.cycle_started_at,
      cy.first_assignee_in_cycle_at,
      cy.first_response_at,
      cy.resolved_at,
      (SELECT fr_min FROM cfg) AS fr_min,
      (SELECT res_min FROM cfg) AS res_min
    FROM public.email_conversation_cycles cy
    INNER JOIN public.email_conversations c
      ON c.id = cy.conversation_id
     AND c.organization_id = p_organization_id
    LEFT JOIN public.employees e
      ON e.id = c.assignee_id
    ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC
  ),
  em_calc AS (
    SELECT
      m.*,
      (m.first_assignee_in_cycle_at + make_interval(mins => m.fr_min)) AS fr_due,
      CASE
        WHEN m.first_response_at IS NULL THEN NULL::timestamptz
        ELSE m.first_response_at + make_interval(mins => m.res_min)
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
          CEIL(EXTRACT(EPOCH FROM (m.first_response_at - m.fr_due)) / 60.0)::integer
        WHEN m.first_response_at IS NULL AND now() > m.fr_due THEN
          CEIL(EXTRACT(EPOCH FROM (now() - m.fr_due)) / 60.0)::integer
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
          CEIL(EXTRACT(EPOCH FROM (m.resolved_at - m.res_due)) / 60.0)::integer
        WHEN m.resolved_at IS NULL AND m.res_due IS NOT NULL AND now() > m.res_due THEN
          CEIL(EXTRACT(EPOCH FROM (now() - m.res_due)) / 60.0)::integer
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
  'Latest open/closed cycle per WA, IG, and email conversation: SLA status codes (pending|on_time|late|na), late minutes, first-response and resolution due timestamps. Uses organization_omnichannel_sla; VOLATILE because of now() for open cycles.';

GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO service_role;
