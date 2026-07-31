-- Treat bare Instagram usernames (e.g. fiqri_fox) like @fiqri_fox for dedupe.
-- Lead Magnet historically stored bare usernames, causing duplicate livechat threads.

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
      WHEN LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_customer_name, '')), '^@+', '')) ~ '^[a-z0-9._]{1,30}$'
       AND LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_customer_name, '')), '^@+', '')) ~ '[a-z]'
      THEN NULLIF(LOWER(REGEXP_REPLACE(TRIM(p_customer_name), '^@+', '')), '')
      ELSE NULL
    END,
    NULLIF(TRIM(p_customer_external_id), ''),
    NULLIF(TRIM(p_customer_ig_id), '')
  )));
$$;

COMMENT ON FUNCTION public.instagram_conversation_customer_dedupe_key(text, text, text) IS
  'Stable customer identity: IG handle (@ or bare) > external (webhook sender) > ig id.';

-- Normalize bare IG-looking customer_name values to @username.
UPDATE public.instagram_conversations c
SET
  customer_name = '@' || LOWER(REGEXP_REPLACE(TRIM(c.customer_name), '^@+', '')),
  updated_at = NOW()
WHERE TRIM(COALESCE(c.customer_name, '')) <> ''
  AND TRIM(c.customer_name) !~ '^@'
  AND LOWER(TRIM(c.customer_name)) ~ '^[a-z0-9._]{1,30}$'
  AND LOWER(TRIM(c.customer_name)) ~ '[a-z]'
  AND LOWER(TRIM(c.customer_name)) NOT IN ('instagram contact', 'instagram');

-- Prefer @-prefixed names when choosing merge keeper.
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
        (CASE WHEN TRIM(COALESCE(c.customer_name, '')) ~ '^@' THEN 0 ELSE 1 END),
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
        (CASE WHEN TRIM(COALESCE(c.customer_name, '')) ~ '^@' THEN 0 ELSE 1 END),
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
        (CASE WHEN TRIM(COALESCE(c.customer_name, '')) ~ '^@' THEN 0 ELSE 1 END),
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
        (CASE WHEN TRIM(COALESCE(c.customer_name, '')) ~ '^@' THEN 0 ELSE 1 END),
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
