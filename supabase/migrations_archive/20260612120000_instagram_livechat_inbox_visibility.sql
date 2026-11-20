-- Fix Instagram Livechat inbox: conversations exist in DB but RPC returns empty for many users.
-- Causes: org founder without user_roles.owner, omnichannel admin, or users without employees row.

DROP FUNCTION IF EXISTS public.get_instagram_conversations_with_preview(uuid);

CREATE FUNCTION public.get_instagram_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_ig_id text,
  customer_name text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  instagram_business_account_id text,
  instagram_account_display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT
      auth.uid() AS user_id,
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = p_organization_id
        LIMIT 1
      ) AS role,
      (
        SELECT e.id
        FROM public.employees e
        WHERE e.user_id = auth.uid()
          AND e.organization_id = p_organization_id
        LIMIT 1
      ) AS employee_id
  )
  SELECT
    c.id,
    c.organization_id,
    c.customer_ig_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.instagram_business_account_id,
    COALESCE(
      CASE
        WHEN a.instagram_username IS NOT NULL AND TRIM(a.instagram_username) <> '' THEN '@' || TRIM(a.instagram_username)
      END,
      NULLIF(TRIM(COALESCE(a.instagram_name, '')), ''),
      a.instagram_business_account_id
    )::TEXT AS instagram_account_display_name,
    c.created_at,
    c.updated_at
  FROM public.instagram_conversations c
  CROSS JOIN viewer v
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN public.organization_instagram_accounts a
    ON a.organization_id = c.organization_id
   AND a.instagram_business_account_id = c.instagram_business_account_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM public.instagram_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
    AND v.user_id IS NOT NULL
    AND (
      -- Org founder (organizations.user_id), even if user_roles row is missing/wrong
      EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = p_organization_id
          AND o.user_id = v.user_id
      )
      -- user_roles owner/admin/hr
      OR v.role IN ('owner', 'admin', 'hr')
      -- Omnichannel settings admin (org owner or roster admin)
      OR public.is_omnichannel_survey_settings_admin(p_organization_id)
      -- Any omnichannel roster agent: unassigned queue + own assignee + resolved they closed
      OR (
        EXISTS (
          SELECT 1
          FROM public.organization_omnichannel_staff s
          WHERE s.organization_id = p_organization_id
            AND s.employee_id = v.employee_id
        )
        AND (
          c.assignee_id IS NULL
          OR c.assignee_id = v.employee_id
          OR public.omnichannel_employee_sees_conversation(
            c.assignee_id,
            c.last_handling_assignee_id,
            c.lead_status_id,
            v.employee_id
          )
        )
      )
      -- Employee (not necessarily on omnichannel roster): queue + assignee rules
      OR (
        v.employee_id IS NOT NULL
        AND (
          c.assignee_id = v.employee_id
          OR (
            c.assignee_id IS NULL
            AND NOT public.lead_status_is_resolved_or_expired_visibility(c.lead_status_id)
          )
          OR public.omnichannel_employee_sees_conversation(
            c.assignee_id,
            c.last_handling_assignee_id,
            c.lead_status_id,
            v.employee_id
          )
        )
      )
      -- Active org profile (livechat page) without employee row: unassigned open queue only
      OR (
        v.employee_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = v.user_id
            AND p.active_organization_id = p_organization_id
        )
        AND c.assignee_id IS NULL
        AND NOT public.lead_status_is_resolved_or_expired_visibility(c.lead_status_id)
      )
    )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_instagram_conversations_with_preview(uuid) IS
  'Instagram DM preview for Livechat. Founder/owner/admin/hr/omnichannel admin see all; agents see queue + assigned; active-org users without employee row see unassigned open queue.';

GRANT EXECUTE ON FUNCTION public.get_instagram_conversations_with_preview(uuid) TO authenticated;
