-- Username-first dedupe key + merge IG livechat duplicates (IGSID vs business account id drift).

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
    CASE
      WHEN TRIM(COALESCE(p_customer_name, '')) ~ '^@'
      THEN NULLIF(REGEXP_REPLACE(TRIM(p_customer_name), '^@+', ''), '')
      ELSE NULL
    END,
    NULLIF(TRIM(p_customer_external_id), ''),
    NULLIF(TRIM(p_customer_ig_id), '')
  )));
$$;

COMMENT ON FUNCTION public.instagram_conversation_customer_dedupe_key(text, text, text) IS
  'Stable customer identity: @username > external (webhook sender) > ig id.';

-- Merge conversations that share the same platform_message_id (definite duplicate threads).
WITH shared_messages AS (
  SELECT
    m1.conversation_id AS conv_a,
    m2.conversation_id AS conv_b
  FROM public.instagram_messages m1
  JOIN public.instagram_messages m2
    ON m1.platform_message_id = m2.platform_message_id
   AND m1.conversation_id <> m2.conversation_id
  WHERE COALESCE(TRIM(m1.platform_message_id), '') <> ''
),
merge_pairs AS (
  SELECT
    LEAST(conv_a, conv_b) AS id_a,
    GREATEST(conv_a, conv_b) AS id_b
  FROM shared_messages
),
ranked_pairs AS (
  SELECT
    mp.id_a,
    mp.id_b,
    ca.organization_id,
    ca.instagram_business_account_id,
    ROW_NUMBER() OVER (
      PARTITION BY mp.id_a, mp.id_b
      ORDER BY
        (CASE WHEN COALESCE(TRIM(ca.customer_name), '') <> '' THEN 0 ELSE 1 END),
        ca.last_message_at DESC NULLS LAST
    ) AS rn,
    CASE
      WHEN (CASE WHEN COALESCE(TRIM(ca.customer_name), '') <> '' THEN 0 ELSE 1 END)
         <= (CASE WHEN COALESCE(TRIM(cb.customer_name), '') <> '' THEN 0 ELSE 1 END)
      THEN ca.id
      ELSE cb.id
    END AS keeper_id,
    CASE
      WHEN (CASE WHEN COALESCE(TRIM(ca.customer_name), '') <> '' THEN 0 ELSE 1 END)
         <= (CASE WHEN COALESCE(TRIM(cb.customer_name), '') <> '' THEN 0 ELSE 1 END)
      THEN cb.id
      ELSE ca.id
    END AS dupe_id
  FROM merge_pairs mp
  JOIN public.instagram_conversations ca ON ca.id = mp.id_a
  JOIN public.instagram_conversations cb ON cb.id = mp.id_b
  WHERE ca.organization_id = cb.organization_id
    AND ca.instagram_business_account_id = cb.instagram_business_account_id
)
UPDATE public.instagram_messages m
SET conversation_id = rp.keeper_id
FROM ranked_pairs rp
WHERE rp.rn = 1
  AND m.conversation_id = rp.dupe_id;

WITH shared_messages AS (
  SELECT
    m1.conversation_id AS conv_a,
    m2.conversation_id AS conv_b
  FROM public.instagram_messages m1
  JOIN public.instagram_messages m2
    ON m1.platform_message_id = m2.platform_message_id
   AND m1.conversation_id <> m2.conversation_id
  WHERE COALESCE(TRIM(m1.platform_message_id), '') <> ''
),
merge_pairs AS (
  SELECT LEAST(conv_a, conv_b) AS id_a, GREATEST(conv_a, conv_b) AS id_b
  FROM shared_messages
),
ranked_pairs AS (
  SELECT
    CASE
      WHEN (CASE WHEN COALESCE(TRIM(ca.customer_name), '') <> '' THEN 0 ELSE 1 END)
         <= (CASE WHEN COALESCE(TRIM(cb.customer_name), '') <> '' THEN 0 ELSE 1 END)
      THEN cb.id
      ELSE ca.id
    END AS dupe_id
  FROM merge_pairs mp
  JOIN public.instagram_conversations ca ON ca.id = mp.id_a
  JOIN public.instagram_conversations cb ON cb.id = mp.id_b
  WHERE ca.organization_id = cb.organization_id
    AND ca.instagram_business_account_id = cb.instagram_business_account_id
)
DELETE FROM public.instagram_conversation_cycles cyc
USING ranked_pairs rp
WHERE cyc.conversation_id = rp.dupe_id;

WITH shared_messages AS (
  SELECT
    m1.conversation_id AS conv_a,
    m2.conversation_id AS conv_b
  FROM public.instagram_messages m1
  JOIN public.instagram_messages m2
    ON m1.platform_message_id = m2.platform_message_id
   AND m1.conversation_id <> m2.conversation_id
  WHERE COALESCE(TRIM(m1.platform_message_id), '') <> ''
),
merge_pairs AS (
  SELECT LEAST(conv_a, conv_b) AS id_a, GREATEST(conv_a, conv_b) AS id_b
  FROM shared_messages
),
ranked_pairs AS (
  SELECT
    CASE
      WHEN (CASE WHEN COALESCE(TRIM(ca.customer_name), '') <> '' THEN 0 ELSE 1 END)
         <= (CASE WHEN COALESCE(TRIM(cb.customer_name), '') <> '' THEN 0 ELSE 1 END)
      THEN cb.id
      ELSE ca.id
    END AS dupe_id
  FROM merge_pairs mp
  JOIN public.instagram_conversations ca ON ca.id = mp.id_a
  JOIN public.instagram_conversations cb ON cb.id = mp.id_b
  WHERE ca.organization_id = cb.organization_id
    AND ca.instagram_business_account_id = cb.instagram_business_account_id
)
DELETE FROM public.instagram_conversations c
USING ranked_pairs rp
WHERE c.id = rp.dupe_id;

-- Merge duplicate conversations (same org + inbox + username-first dedupe key).
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

-- Merge generic "Instagram Contact" rows into named @username sibling with overlapping ids.
WITH named AS (
  SELECT
    c.id,
    c.organization_id,
    c.instagram_business_account_id,
    LOWER(REGEXP_REPLACE(TRIM(c.customer_name), '^@+', '')) AS uname,
    c.customer_ig_id,
    c.customer_external_id,
    c.last_message_at
  FROM public.instagram_conversations c
  WHERE TRIM(COALESCE(c.customer_name, '')) ~ '^@'
),
generic AS (
  SELECT
    c.id,
    c.organization_id,
    c.instagram_business_account_id,
    c.customer_ig_id,
    c.customer_external_id
  FROM public.instagram_conversations c
  WHERE COALESCE(TRIM(c.customer_name), '') = ''
     OR LOWER(TRIM(c.customer_name)) IN ('instagram contact', 'instagram')
),
overlap_pairs AS (
  SELECT
    g.id AS dupe_id,
    n.id AS keeper_id
  FROM generic g
  JOIN named n
    ON n.organization_id = g.organization_id
   AND n.instagram_business_account_id = g.instagram_business_account_id
   AND (
     g.customer_ig_id IN (n.customer_ig_id, n.customer_external_id)
     OR g.customer_external_id IN (n.customer_ig_id, n.customer_external_id)
     OR n.customer_ig_id IN (g.customer_ig_id, g.customer_external_id)
     OR n.customer_external_id IN (g.customer_ig_id, g.customer_external_id)
   )
)
UPDATE public.instagram_messages m
SET conversation_id = op.keeper_id
FROM overlap_pairs op
WHERE m.conversation_id = op.dupe_id;

WITH named AS (
  SELECT
    c.id,
    c.organization_id,
    c.instagram_business_account_id,
    c.customer_ig_id,
    c.customer_external_id
  FROM public.instagram_conversations c
  WHERE TRIM(COALESCE(c.customer_name, '')) ~ '^@'
),
generic AS (
  SELECT
    c.id,
    c.organization_id,
    c.instagram_business_account_id,
    c.customer_ig_id,
    c.customer_external_id
  FROM public.instagram_conversations c
  WHERE COALESCE(TRIM(c.customer_name), '') = ''
     OR LOWER(TRIM(c.customer_name)) IN ('instagram contact', 'instagram')
),
overlap_pairs AS (
  SELECT
    g.id AS dupe_id,
    n.id AS keeper_id
  FROM generic g
  JOIN named n
    ON n.organization_id = g.organization_id
   AND n.instagram_business_account_id = g.instagram_business_account_id
   AND (
     g.customer_ig_id IN (n.customer_ig_id, n.customer_external_id)
     OR g.customer_external_id IN (n.customer_ig_id, n.customer_external_id)
     OR n.customer_ig_id IN (g.customer_ig_id, g.customer_external_id)
     OR n.customer_external_id IN (g.customer_ig_id, g.customer_external_id)
   )
)
DELETE FROM public.instagram_conversation_cycles cyc
USING overlap_pairs op
WHERE cyc.conversation_id = op.dupe_id;

WITH named AS (
  SELECT
    c.id,
    c.organization_id,
    c.instagram_business_account_id,
    c.customer_ig_id,
    c.customer_external_id
  FROM public.instagram_conversations c
  WHERE TRIM(COALESCE(c.customer_name, '')) ~ '^@'
),
generic AS (
  SELECT
    c.id,
    c.organization_id,
    c.instagram_business_account_id,
    c.customer_ig_id,
    c.customer_external_id
  FROM public.instagram_conversations c
  WHERE COALESCE(TRIM(c.customer_name), '') = ''
     OR LOWER(TRIM(c.customer_name)) IN ('instagram contact', 'instagram')
),
overlap_pairs AS (
  SELECT
    g.id AS dupe_id,
    n.id AS keeper_id
  FROM generic g
  JOIN named n
    ON n.organization_id = g.organization_id
   AND n.instagram_business_account_id = g.instagram_business_account_id
   AND (
     g.customer_ig_id IN (n.customer_ig_id, n.customer_external_id)
     OR g.customer_external_id IN (n.customer_ig_id, n.customer_external_id)
     OR n.customer_ig_id IN (g.customer_ig_id, g.customer_external_id)
     OR n.customer_external_id IN (g.customer_ig_id, g.customer_external_id)
   )
)
DELETE FROM public.instagram_conversations c
USING overlap_pairs op
WHERE c.id = op.dupe_id;

COMMENT ON FUNCTION public.get_instagram_conversations_with_preview(uuid) IS
  'Instagram DM preview for Livechat. Dedupes by @username / external sender id / ig id drift.';
