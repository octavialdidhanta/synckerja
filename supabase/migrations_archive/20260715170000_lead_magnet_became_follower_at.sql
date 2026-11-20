-- Track when a non-follower at comment time confirmed follow via follow gate.
ALTER TABLE public.lead_magnet_enrollments
  ADD COLUMN IF NOT EXISTS became_follower_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_lead_magnet_enrollments_campaign_became_follower
  ON public.lead_magnet_enrollments (campaign_id)
  WHERE became_follower_at IS NOT NULL;

-- Backfill from historical follow_validated funnel events.
UPDATE public.lead_magnet_enrollments e
SET became_follower_at = sub.first_validated_at
FROM (
  SELECT enrollment_id, MIN(created_at) AS first_validated_at
  FROM public.lead_magnet_funnel_events
  WHERE event_type = 'follow_validated'
  GROUP BY enrollment_id
) sub
WHERE e.id = sub.enrollment_id
  AND e.is_follower_at_start = false
  AND e.became_follower_at IS NULL;
