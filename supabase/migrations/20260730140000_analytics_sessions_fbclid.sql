-- Store fbclid string on analytics_sessions (parity with gclid).
ALTER TABLE public.analytics_sessions
  ADD COLUMN IF NOT EXISTS fbclid text;

COMMENT ON COLUMN public.analytics_sessions.fbclid IS
  'Facebook click ID from landing URL (first-touch when set on session create).';

-- Backfill from landing_url where we only had has_fbclid flag.
UPDATE public.analytics_sessions
SET fbclid = substring(
  COALESCE(first_landing_url, landing_url, last_landing_url)
  FROM 'fbclid=([^&]+)'
)
WHERE fbclid IS NULL
  AND has_fbclid = true
  AND COALESCE(first_landing_url, landing_url, last_landing_url) LIKE '%fbclid=%';
