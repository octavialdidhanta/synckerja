-- Align whatsapp_messages.created_at with Meta Cloud API inbound message unix time when stored row diverges.
-- Fixes chronological ordering (thread UI, previews, analytics) when created_at drifted from webhook event time.

UPDATE public.whatsapp_messages AS m
SET created_at = src.meta_ts
FROM (
  SELECT
    wm.id,
    CASE
      WHEN jsonb_typeof(wm.raw_metadata->'timestamp') = 'number' THEN
        CASE
          WHEN (wm.raw_metadata->>'timestamp')::double precision > 100000000000
            THEN to_timestamp((wm.raw_metadata->>'timestamp')::double precision / 1000.0)
          ELSE to_timestamp((wm.raw_metadata->>'timestamp')::double precision)
        END
      WHEN jsonb_typeof(wm.raw_metadata->'timestamp') = 'string'
           AND (wm.raw_metadata->>'timestamp') ~ '^[0-9]+$' THEN
        CASE
          WHEN (wm.raw_metadata->>'timestamp')::double precision > 100000000000
            THEN to_timestamp((wm.raw_metadata->>'timestamp')::double precision / 1000.0)
          ELSE to_timestamp((wm.raw_metadata->>'timestamp')::double precision)
        END
      ELSE NULL
    END AS meta_ts
  FROM public.whatsapp_messages wm
  WHERE wm.direction = 'inbound'
    AND wm.raw_metadata IS NOT NULL
) AS src
WHERE m.id = src.id
  AND src.meta_ts IS NOT NULL
  AND m.direction = 'inbound'
  AND ABS(EXTRACT(EPOCH FROM (m.created_at - src.meta_ts))) > 30;
