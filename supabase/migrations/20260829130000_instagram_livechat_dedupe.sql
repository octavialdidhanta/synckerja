-- Dedupe Instagram livechat rows after reconnect (duplicate business account IDs / customer IGSID drift).

CREATE OR REPLACE FUNCTION public.instagram_conversation_customer_dedupe_key(
  p_customer_ig_id text,
  p_customer_external_id text,
  p_customer_name text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(TRIM(COALESCE(
    NULLIF(TRIM(p_customer_external_id), ''),
    NULLIF(REGEXP_REPLACE(TRIM(COALESCE(p_customer_name, '')), '^@+', ''), ''),
    NULLIF(TRIM(p_customer_ig_id), '')
  )));
$$;

COMMENT ON FUNCTION public.instagram_conversation_customer_dedupe_key(text, text, text) IS
  'Stable customer identity for deduping IG conversations (external id > @username > ig id).';

-- Merge duplicate conversations (same org + inbox + customer key).
WITH ranked AS (
  SELECT
    c.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        c.organization_id,
        c.instagram_business_account_id,
        public.instagram_conversation_customer_dedupe_key(
          c.customer_ig_id,
          c.customer_external_id,
          c.customer_name
        )
      ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC, c.created_at DESC
    ) AS rn,
    FIRST_VALUE(c.id) OVER (
      PARTITION BY
        c.organization_id,
        c.instagram_business_account_id,
        public.instagram_conversation_customer_dedupe_key(
          c.customer_ig_id,
          c.customer_external_id,
          c.customer_name
        )
      ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC, c.created_at DESC
    ) AS keeper_id
  FROM public.instagram_conversations c
  WHERE public.instagram_conversation_customer_dedupe_key(
    c.customer_ig_id,
    c.customer_external_id,
    c.customer_name
  ) <> ''
),
dupes AS (
  SELECT id, keeper_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.instagram_messages m
SET conversation_id = d.keeper_id
FROM dupes d
WHERE m.conversation_id = d.id;

WITH ranked AS (
  SELECT
    c.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        c.organization_id,
        c.instagram_business_account_id,
        public.instagram_conversation_customer_dedupe_key(
          c.customer_ig_id,
          c.customer_external_id,
          c.customer_name
        )
      ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC, c.created_at DESC
    ) AS rn
  FROM public.instagram_conversations c
  WHERE public.instagram_conversation_customer_dedupe_key(
    c.customer_ig_id,
    c.customer_external_id,
    c.customer_name
  ) <> ''
)
DELETE FROM public.instagram_conversations c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- Deactivate duplicate connected IG accounts (same @username, wrong business account id).
WITH ranked_accounts AS (
  SELECT
    a.id,
    a.organization_id,
    a.instagram_business_account_id,
    LOWER(TRIM(REGEXP_REPLACE(COALESCE(a.instagram_username, ''), '^@+', ''))) AS uname,
    ROW_NUMBER() OVER (
      PARTITION BY
        a.organization_id,
        LOWER(TRIM(REGEXP_REPLACE(COALESCE(a.instagram_username, ''), '^@+', '')))
      ORDER BY
        CASE WHEN a.instagram_business_account_id ~ '^178414[0-9]+$' THEN 0 ELSE 1 END,
        a.updated_at DESC,
        a.created_at DESC
    ) AS rn
  FROM public.organization_instagram_accounts a
  WHERE a.is_active = true
    AND COALESCE(TRIM(a.instagram_username), '') <> ''
)
UPDATE public.organization_instagram_accounts a
SET is_active = false, updated_at = NOW()
FROM ranked_accounts r
WHERE a.id = r.id
  AND r.rn > 1
  AND r.uname <> '';

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
  ),
  visible AS (
    SELECT
      c.id,
      c.organization_id,
      c.customer_ig_id,
      c.customer_name,
      c.customer_external_id,
      c.lead_status_id,
      c.instagram_business_account_id,
      c.created_at,
      c.updated_at,
      m.created_at AS last_message_at,
      LEFT(m.body, 200) AS last_message_body,
      m.direction AS last_message_direction,
      m.status AS last_message_status,
      ls.name AS lead_status_name,
      COALESCE(
        CASE
          WHEN a.instagram_username IS NOT NULL AND TRIM(a.instagram_username) <> '' THEN '@' || TRIM(a.instagram_username)
        END,
        NULLIF(TRIM(COALESCE(a.instagram_name, '')), ''),
        a.instagram_business_account_id
      )::TEXT AS instagram_account_display_name,
      ROW_NUMBER() OVER (
        PARTITION BY
          c.organization_id,
          c.instagram_business_account_id,
          public.instagram_conversation_customer_dedupe_key(
            c.customer_ig_id,
            c.customer_external_id,
            c.customer_name
          )
        ORDER BY m.created_at DESC NULLS LAST, c.updated_at DESC, c.created_at DESC
      ) AS dedupe_rn
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
        EXISTS (
          SELECT 1
          FROM public.organizations o
          WHERE o.id = p_organization_id
            AND o.user_id = v.user_id
        )
        OR v.role IN ('owner', 'admin', 'hr')
        OR public.is_omnichannel_survey_settings_admin(p_organization_id)
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
  )
  SELECT
    id,
    organization_id,
    customer_ig_id,
    customer_name,
    last_message_at,
    last_message_body,
    last_message_direction,
    last_message_status,
    lead_status_id,
    lead_status_name,
    instagram_business_account_id,
    instagram_account_display_name,
    created_at,
    updated_at
  FROM visible
  WHERE dedupe_rn = 1
  ORDER BY last_message_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_instagram_conversations_with_preview(uuid) IS
  'Instagram DM preview for Livechat. Dedupes same customer thread per inbox (reconnect / IGSID drift).';

GRANT EXECUTE ON FUNCTION public.get_instagram_conversations_with_preview(uuid) TO authenticated;
