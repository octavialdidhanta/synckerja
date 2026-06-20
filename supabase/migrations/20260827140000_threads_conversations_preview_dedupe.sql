-- Fix duplicate rows when multiple IG accounts share the same threads_user_id.
DROP FUNCTION IF EXISTS public.get_threads_conversations_with_preview(uuid);

CREATE FUNCTION public.get_threads_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_threads_id text,
  customer_name text,
  root_media_id text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  threads_user_id text,
  threads_account_display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_threads_id,
    c.customer_name,
    c.root_media_id,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.threads_user_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(a.threads_username, '')), ''),
      NULLIF(TRIM(COALESCE(a.instagram_username, '')), ''),
      NULLIF(TRIM(COALESCE(a.instagram_name, '')), ''),
      c.threads_user_id
    )::TEXT AS threads_account_display_name,
    c.created_at,
    c.updated_at
  FROM public.threads_conversations c
  LEFT JOIN public.lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN LATERAL (
    SELECT threads_username, instagram_username, instagram_name
    FROM public.organization_instagram_accounts a
    WHERE a.organization_id = c.organization_id
      AND a.threads_user_id = c.threads_user_id
      AND a.is_active = true
      AND a.has_threads = true
    ORDER BY a.created_at ASC
    LIMIT 1
  ) a ON true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM public.threads_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
    AND (
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = p_organization_id
        LIMIT 1
      ) IN ('owner', 'admin')
      OR (
        (
          SELECT e.id
          FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = p_organization_id
          LIMIT 1
        ) IS NOT NULL
        AND (
          c.assignee_id = (
            SELECT e.id
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.organization_id = p_organization_id
            LIMIT 1
          )
          OR (
            c.assignee_id IS NULL
            AND NOT public.lead_status_is_resolved_or_expired_visibility(c.lead_status_id)
          )
          OR public.omnichannel_employee_sees_conversation(
            c.assignee_id,
            c.last_handling_assignee_id,
            c.lead_status_id,
            (
              SELECT e.id
              FROM public.employees e
              WHERE e.user_id = auth.uid()
                AND e.organization_id = p_organization_id
              LIMIT 1
            )
          )
        )
      )
    )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_threads_conversations_with_preview(uuid) IS
  'Threads livechat preview. One row per conversation (deduped IG account join).';

GRANT EXECUTE ON FUNCTION public.get_threads_conversations_with_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_threads_conversations_with_preview(uuid) TO service_role;
