-- CRM dashboard: one row per conversation (latest cycle) with customer, assignee, channel, and timestamps for audit.
DROP FUNCTION IF EXISTS public.get_crm_first_response_time_per_room(uuid);

CREATE FUNCTION public.get_crm_first_response_time_per_room(p_organization_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  customer_display text,
  assignee_name text,
  channel text,
  sla_time_indicator text,
  cycle_started_at timestamptz,
  assignment_due_at timestamptz,
  first_response_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (cy.conversation_id)
    c.id AS conversation_id,
    COALESCE(NULLIF(trim(c.customer_name), ''), NULLIF(trim(c.customer_wa_id), ''), '—')::text AS customer_display,
    COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'Unassigned')::text AS assignee_name,
    COALESCE(NULLIF(lower(trim(c.channel)), ''), 'whatsapp')::text AS channel,
    NULL::text AS sla_time_indicator,
    cy.cycle_started_at,
    NULL::timestamptz AS assignment_due_at,
    cy.first_response_at
  FROM public.whatsapp_conversation_cycles cy
  INNER JOIN public.whatsapp_conversations c
    ON c.id = cy.conversation_id
   AND c.organization_id = p_organization_id
  LEFT JOIN public.employees e
    ON e.id = c.assignee_id
  ORDER BY cy.conversation_id ASC, cy.cycle_started_at DESC;
$$;

COMMENT ON FUNCTION public.get_crm_first_response_time_per_room(uuid) IS
  'Latest conversation cycle per room: cycle start, first agent reply, customer and current assignee (assignee is current on conversation row). SLA columns reserved (null).';

GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_first_response_time_per_room(uuid) TO service_role;
