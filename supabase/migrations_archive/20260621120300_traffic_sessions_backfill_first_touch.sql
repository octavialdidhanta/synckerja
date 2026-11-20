-- Restore corrupted first-touch attribution on analytics_sessions after SPA last-touch overwrites.

UPDATE public.analytics_sessions
SET utm_source = first_utm_source
WHERE utm_source IS NULL AND first_utm_source IS NOT NULL;

UPDATE public.analytics_sessions
SET utm_medium = first_utm_medium
WHERE utm_medium IS NULL AND first_utm_medium IS NOT NULL;

UPDATE public.analytics_sessions
SET utm_campaign = first_utm_campaign
WHERE utm_campaign IS NULL AND first_utm_campaign IS NOT NULL;

UPDATE public.analytics_sessions
SET utm_content = first_utm_content
WHERE utm_content IS NULL AND first_utm_content IS NOT NULL;

UPDATE public.analytics_sessions
SET utm_term = first_utm_term
WHERE utm_term IS NULL AND first_utm_term IS NOT NULL;

UPDATE public.analytics_sessions
SET last_utm_source = coalesce(last_utm_source, first_utm_source, utm_source)
WHERE last_utm_source IS NULL
  AND coalesce(first_utm_source, utm_source) IS NOT NULL;

UPDATE public.analytics_sessions
SET last_utm_medium = coalesce(last_utm_medium, first_utm_medium, utm_medium)
WHERE last_utm_medium IS NULL
  AND coalesce(first_utm_medium, utm_medium) IS NOT NULL;

UPDATE public.analytics_sessions
SET last_utm_campaign = coalesce(last_utm_campaign, first_utm_campaign, utm_campaign)
WHERE last_utm_campaign IS NULL
  AND coalesce(first_utm_campaign, utm_campaign) IS NOT NULL;

UPDATE public.analytics_sessions
SET last_utm_content = coalesce(last_utm_content, first_utm_content, utm_content)
WHERE last_utm_content IS NULL
  AND coalesce(first_utm_content, utm_content) IS NOT NULL;

UPDATE public.analytics_sessions
SET last_utm_term = coalesce(last_utm_term, first_utm_term, utm_term)
WHERE last_utm_term IS NULL
  AND coalesce(first_utm_term, utm_term) IS NOT NULL;

UPDATE public.analytics_sessions
SET has_gclid = true
WHERE coalesce(has_gclid, false) = false
  AND (coalesce(first_has_gclid, false) OR coalesce(last_has_gclid, false) OR gclid IS NOT NULL);

UPDATE public.analytics_sessions
SET first_has_gclid = true
WHERE coalesce(first_has_gclid, false) = false
  AND (coalesce(has_gclid, false) OR coalesce(last_has_gclid, false) OR gclid IS NOT NULL);

UPDATE public.analytics_sessions
SET last_has_gclid = true
WHERE coalesce(last_has_gclid, false) = false
  AND (coalesce(has_gclid, false) OR coalesce(first_has_gclid, false) OR gclid IS NOT NULL);

UPDATE public.analytics_sessions
SET has_fbclid = true
WHERE coalesce(has_fbclid, false) = false
  AND (coalesce(first_has_fbclid, false) OR coalesce(last_has_fbclid, false) OR fbclid IS NOT NULL);

UPDATE public.analytics_sessions
SET first_has_fbclid = true
WHERE coalesce(first_has_fbclid, false) = false
  AND (coalesce(has_fbclid, false) OR coalesce(last_has_fbclid, false) OR fbclid IS NOT NULL);

UPDATE public.analytics_sessions
SET last_has_fbclid = true
WHERE coalesce(last_has_fbclid, false) = false
  AND (coalesce(has_fbclid, false) OR coalesce(first_has_fbclid, false) OR fbclid IS NOT NULL);
