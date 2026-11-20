-- Merge IG livechat duplicates when customer_ig_id drifts (IGSID vs linked business account id).

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
    NULLIF(TRIM(p_customer_ig_id), ''),
    NULLIF(REGEXP_REPLACE(TRIM(COALESCE(p_customer_name, '')), '^@+', ''), '')
  )));
$$;

COMMENT ON FUNCTION public.instagram_conversation_customer_dedupe_key(text, text, text) IS
  'Stable customer identity: external (webhook sender) > ig id > @username.';

-- Backfill missing external id from sibling rows in the same dedupe bucket.
UPDATE public.instagram_conversations target
SET customer_external_id = src.external_id,
    updated_at = NOW()
FROM (
  SELECT
    c.organization_id,
    c.instagram_business_account_id,
    public.instagram_conversation_customer_dedupe_key(
      c.customer_ig_id,
      c.customer_external_id,
      c.customer_name
    ) AS dedupe_key,
    MAX(NULLIF(TRIM(c.customer_external_id), '')) AS external_id
  FROM public.instagram_conversations c
  GROUP BY 1, 2, 3
  HAVING MAX(NULLIF(TRIM(c.customer_external_id), '')) IS NOT NULL
) src
WHERE target.organization_id = src.organization_id
  AND target.instagram_business_account_id = src.instagram_business_account_id
  AND public.instagram_conversation_customer_dedupe_key(
    target.customer_ig_id,
    target.customer_external_id,
    target.customer_name
  ) = src.dedupe_key
  AND COALESCE(TRIM(target.customer_external_id), '') = ''
  AND src.external_id IS NOT NULL;

-- Merge duplicate conversations (same org + inbox + dedupe key).
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
      ORDER BY
        (CASE WHEN COALESCE(TRIM(c.customer_name), '') <> '' THEN 0 ELSE 1 END),
        (CASE WHEN COALESCE(TRIM(c.customer_external_id), '') <> '' THEN 0 ELSE 1 END),
        c.last_message_at DESC NULLS LAST,
        c.updated_at DESC,
        c.created_at DESC
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
      ORDER BY
        (CASE WHEN COALESCE(TRIM(c.customer_name), '') <> '' THEN 0 ELSE 1 END),
        (CASE WHEN COALESCE(TRIM(c.customer_external_id), '') <> '' THEN 0 ELSE 1 END),
        c.last_message_at DESC NULLS LAST,
        c.updated_at DESC,
        c.created_at DESC
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
      ORDER BY
        (CASE WHEN COALESCE(TRIM(c.customer_name), '') <> '' THEN 0 ELSE 1 END),
        (CASE WHEN COALESCE(TRIM(c.customer_external_id), '') <> '' THEN 0 ELSE 1 END),
        c.last_message_at DESC NULLS LAST,
        c.updated_at DESC,
        c.created_at DESC
    ) AS rn
  FROM public.instagram_conversations c
  WHERE public.instagram_conversation_customer_dedupe_key(
    c.customer_ig_id,
    c.customer_external_id,
    c.customer_name
  ) <> ''
)
DELETE FROM public.instagram_conversation_cycles cyc
USING ranked r
WHERE cyc.conversation_id = r.id
  AND r.rn > 1;

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
      ORDER BY
        (CASE WHEN COALESCE(TRIM(c.customer_name), '') <> '' THEN 0 ELSE 1 END),
        (CASE WHEN COALESCE(TRIM(c.customer_external_id), '') <> '' THEN 0 ELSE 1 END),
        c.last_message_at DESC NULLS LAST,
        c.updated_at DESC,
        c.created_at DESC
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

DROP FUNCTION IF EXISTS public.get_instagram_conversations_with_preview(uuid);

CREATE FUNCTION public.get_instagram_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_ig_id text,
  customer_external_id text,
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
      c.customer_external_id,
      c.customer_name,
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
        ORDER BY
          (CASE WHEN COALESCE(TRIM(c.customer_name), '') <> '' THEN 0 ELSE 1 END),
          m.created_at DESC NULLS LAST,
          c.updated_at DESC,
          c.created_at DESC
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
    customer_external_id,
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
  'Instagram DM preview for Livechat. Dedupes by external sender id / ig id drift.';

GRANT EXECUTE ON FUNCTION public.get_instagram_conversations_with_preview(uuid) TO authenticated;
