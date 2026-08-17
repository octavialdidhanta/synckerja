-- Link store check-in to a paid sales activity (lightweight POS).
-- Also allow activity_type 'Store Checkout' (not Live Chat Lead Conversion).

ALTER TABLE public.customer_visits
  ADD COLUMN IF NOT EXISTS sales_activity_id uuid NULL
    REFERENCES public.sales_activities (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_visits_org_sales_activity
  ON public.customer_visits USING btree (organization_id, sales_activity_id)
  WHERE sales_activity_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_activities'
  ) THEN
    ALTER TABLE public.sales_activities DROP CONSTRAINT IF EXISTS sales_activities_activity_type_check;
    ALTER TABLE public.sales_activities
      ADD CONSTRAINT sales_activities_activity_type_check CHECK (
        activity_type IN (
          'Demo',
          'Meeting',
          'Call',
          'Proposal',
          'Closing',
          'visit',
          'Lead Conversion',
          'Store Checkout'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.customer_visits.sales_activity_id IS
  'Paid store checkout created after this check-in; null when visit had no sale.';
