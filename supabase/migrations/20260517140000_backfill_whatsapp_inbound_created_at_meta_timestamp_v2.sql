-- v2: broader parsing of raw_metadata.timestamp + sync whenever Meta time differs (no 30s floor).
-- v1 (20260516194500) only matched pure digit strings; Meta / drivers may store decimals or numbers only in JSON.

UPDATE public.whatsapp_messages AS m
SET created_at = src.meta_ts
FROM (
  SELECT
    wm.id,
    CASE
      WHEN epoch_sec IS NULL THEN NULL
      WHEN epoch_sec > 100000000000 THEN to_timestamp(epoch_sec / 1000.0)
      ELSE to_timestamp(epoch_sec)
    END AS meta_ts
  FROM (
    SELECT
      wm.id,
      wm.created_at,
      CASE jsonb_typeof(wm.raw_metadata->'timestamp')
        WHEN 'number' THEN (wm.raw_metadata->>'timestamp')::double precision
        WHEN 'string' THEN
          CASE
            WHEN nullif(btrim(wm.raw_metadata->>'timestamp'), '') IS NULL THEN NULL
            WHEN btrim(wm.raw_metadata->>'timestamp') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (btrim(wm.raw_metadata->>'timestamp'))::double precision
            ELSE NULL
          END
        ELSE NULL
      END AS epoch_sec
    FROM public.whatsapp_messages wm
    WHERE wm.direction = 'inbound'
      AND wm.raw_metadata IS NOT NULL
      AND wm.raw_metadata ? 'timestamp'
  ) wm
) AS src
WHERE m.id = src.id
  AND src.meta_ts IS NOT NULL
  AND m.direction = 'inbound'
  AND m.created_at IS DISTINCT FROM src.meta_ts;
