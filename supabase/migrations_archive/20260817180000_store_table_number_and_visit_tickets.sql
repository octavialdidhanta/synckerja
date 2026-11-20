-- Pay-first dine-in: optional table label + many Store Checkout tickets per visit.

ALTER TABLE public.customer_visits
  ADD COLUMN IF NOT EXISTS table_number text NULL;

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS customer_visit_id uuid NULL
    REFERENCES public.customer_visits (id) ON DELETE SET NULL;

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS table_number text NULL;

ALTER TABLE public.customer_visits
  DROP CONSTRAINT IF EXISTS customer_visits_table_number_check;

ALTER TABLE public.customer_visits
  ADD CONSTRAINT customer_visits_table_number_check CHECK (
    table_number IS NULL OR char_length(btrim(table_number)) BETWEEN 1 AND 16
  );

ALTER TABLE public.sales_activities
  DROP CONSTRAINT IF EXISTS sales_activities_table_number_check;

ALTER TABLE public.sales_activities
  ADD CONSTRAINT sales_activities_table_number_check CHECK (
    table_number IS NULL OR char_length(btrim(table_number)) BETWEEN 1 AND 16
  );

CREATE INDEX IF NOT EXISTS idx_sales_activities_org_customer_visit
  ON public.sales_activities (organization_id, customer_visit_id)
  WHERE customer_visit_id IS NOT NULL;

UPDATE public.sales_activities AS a
SET customer_visit_id = v.id
FROM public.customer_visits AS v
WHERE v.sales_activity_id = a.id
  AND a.customer_visit_id IS NULL;

COMMENT ON COLUMN public.customer_visits.table_number IS
  'Current dine-in table for this check-in (latest ticket). Empty means counter/takeaway.';

COMMENT ON COLUMN public.sales_activities.customer_visit_id IS
  'Store checkout ticket belonging to a customer visit. Many tickets per visit are allowed.';

COMMENT ON COLUMN public.sales_activities.table_number IS
  'Table printed on this ticket. Independent of later tickets on the same visit.';
