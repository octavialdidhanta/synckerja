-- Store checkout: outlet, sales type, and tax/gratuity breakdown on sales_activities

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS pos_outlet_id uuid REFERENCES public.pos_outlets(id),
  ADD COLUMN IF NOT EXISTS catalog_sales_type_id uuid REFERENCES public.catalog_sales_types(id),
  ADD COLUMN IF NOT EXISTS checkout_subtotal numeric,
  ADD COLUMN IF NOT EXISTS checkout_tax_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_gratuity_amount numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_activities_org_pos_outlet
  ON public.sales_activities (organization_id, pos_outlet_id)
  WHERE pos_outlet_id IS NOT NULL;

COMMENT ON COLUMN public.sales_activities.pos_outlet_id IS
  'POS outlet that processed this store checkout transaction.';
COMMENT ON COLUMN public.sales_activities.catalog_sales_type_id IS
  'Sales type (e.g. Dine In) selected at store checkout; drives gratuity rules.';
COMMENT ON COLUMN public.sales_activities.checkout_subtotal IS
  'Pre-tax/gratuity cart subtotal at checkout (store checkout only).';
COMMENT ON COLUMN public.sales_activities.checkout_tax_amount IS
  'Total tax amount applied at store checkout.';
COMMENT ON COLUMN public.sales_activities.checkout_gratuity_amount IS
  'Total gratuity amount applied at store checkout.';
