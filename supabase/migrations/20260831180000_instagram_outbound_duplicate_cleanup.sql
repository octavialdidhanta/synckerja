-- Cleanup IG threads created when outbound webhook was misrouted as inbound (sender = inbox id).

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
keepers AS (
  SELECT
    mp.id_a,
    mp.id_b,
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
SET conversation_id = k.keeper_id
FROM keepers k
WHERE m.conversation_id = k.dupe_id;

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
keepers AS (
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
USING keepers k
WHERE cyc.conversation_id = k.dupe_id;

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
keepers AS (
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
USING keepers k
WHERE c.id = k.dupe_id;
