-- Extend get_whatsapp_cycle_metrics with conversation channel for org-wide CRM filters (WhatsApp vs Instagram).
-- Postgres does not allow CREATE OR REPLACE when RETURNS TABLE shape changes; drop then create.
DROP FUNCTION IF EXISTS public.get_whatsapp_cycle_metrics(uuid);

CREATE FUNCTION public.get_whatsapp_cycle_metrics(p_organization_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  assignee_id UUID,
  cycle_started_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  channel TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cy.conversation_id,
    c.assignee_id,
    cy.cycle_started_at,
    cy.first_response_at,
    cy.resolved_at,
    COALESCE(NULLIF(lower(trim(c.channel)), ''), 'whatsapp') AS channel
  FROM whatsapp_conversation_cycles cy
  JOIN whatsapp_conversations c ON c.id = cy.conversation_id
  WHERE c.organization_id = p_organization_id
  ORDER BY cy.cycle_started_at DESC;
$$;

COMMENT ON FUNCTION public.get_whatsapp_cycle_metrics(UUID) IS 'WhatsApp/Instagram conversation cycles for response and resolution metrics; includes channel for filtering.';

GRANT EXECUTE ON FUNCTION public.get_whatsapp_cycle_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_cycle_metrics(uuid) TO service_role;
