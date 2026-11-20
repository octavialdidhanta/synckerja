-- One completed matched visit per lead per calendar day.
-- Cancel extras first (keep sales_activity_id, else earliest created_at), then unique index.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lead_id, visit_date
      ORDER BY
        (sales_activity_id IS NOT NULL) DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.customer_visits
  WHERE match_status = 'matched'
    AND lead_id IS NOT NULL
    AND lower(status) = 'completed'
)
UPDATE public.customer_visits AS v
SET status = 'cancelled'
FROM ranked AS r
WHERE v.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS customer_visits_one_matched_lead_per_day
  ON public.customer_visits (organization_id, lead_id, visit_date)
  WHERE match_status = 'matched'
    AND lead_id IS NOT NULL
    AND lower(status) = 'completed';

COMMENT ON INDEX public.customer_visits_one_matched_lead_per_day IS
  'Idempotent store check-in: one completed matched visit per lead per day.';
