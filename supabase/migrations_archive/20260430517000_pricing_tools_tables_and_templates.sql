-- Pricing tools: business_expenses, sales_channels, pricing_calculations, pricing_templates.
-- Uses public.update_updated_at_column() from prior migrations (do not redefine).
-- product_id on pricing_calculations is optional uuid without FK (no public.products table in this project).

-- ---------------------------------------------------------------------------
-- business_expenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  amount numeric(15, 2) NOT NULL,
  month integer NULL CHECK (month IS NULL OR (month >= 0 AND month <= 12)),
  time_period text NOT NULL CHECK (time_period IN ('monthly', 'yearly')),
  year integer NULL,
  is_active boolean NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_expenses_organization_id ON public.business_expenses USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_created_by ON public.business_expenses USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_business_expenses_category ON public.business_expenses USING btree (category);
CREATE INDEX IF NOT EXISTS idx_business_expenses_is_active ON public.business_expenses USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_business_expenses_time_period ON public.business_expenses USING btree (time_period);

DROP TRIGGER IF EXISTS update_business_expenses_updated_at ON public.business_expenses;
CREATE TRIGGER update_business_expenses_updated_at
  BEFORE UPDATE ON public.business_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_tools_be_select" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_select"
  ON public.business_expenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_be_insert" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_insert"
  ON public.business_expenses FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_be_update" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_update"
  ON public.business_expenses FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_be_delete" ON public.business_expenses;
CREATE POLICY "pricing_tools_be_delete"
  ON public.business_expenses FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = business_expenses.organization_id
    )
  );

COMMENT ON TABLE public.business_expenses IS 'Pricing tool: operational business expenses per organization.';

-- ---------------------------------------------------------------------------
-- sales_channels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('online', 'offline')),
  commission_percent numeric(5, 2) NULL DEFAULT 0,
  payment_fee_percent numeric(5, 2) NULL DEFAULT 0,
  ad_spend_percent numeric(5, 2) NULL DEFAULT 0,
  other_fee_percent numeric(5, 2) NULL DEFAULT 0,
  total_fee_percent numeric(5, 2) NOT NULL,
  is_active boolean NULL DEFAULT true,
  is_default boolean NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sales_channels_organization_id ON public.sales_channels USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_channels_type ON public.sales_channels USING btree (type);
CREATE INDEX IF NOT EXISTS idx_sales_channels_is_active ON public.sales_channels USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_sales_channels_is_default ON public.sales_channels USING btree (is_default);

DROP TRIGGER IF EXISTS update_sales_channels_updated_at ON public.sales_channels;
CREATE TRIGGER update_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_tools_sc_select" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_select"
  ON public.sales_channels FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_sc_insert" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_insert"
  ON public.sales_channels FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_sc_update" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_update"
  ON public.sales_channels FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_sc_delete" ON public.sales_channels;
CREATE POLICY "pricing_tools_sc_delete"
  ON public.sales_channels FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = sales_channels.organization_id
    )
  );

COMMENT ON TABLE public.sales_channels IS 'Pricing tool: channel fee presets (system defaults + org overrides).';

INSERT INTO public.sales_channels (
  id, organization_id, name, type, commission_percent, payment_fee_percent, ad_spend_percent, other_fee_percent, total_fee_percent, is_active, is_default, created_at, updated_at
)
VALUES
  ('550e8400-e29b-41d4-a716-446655440101', NULL, 'Tokopedia', 'online', 1.5, 0.7, 1.0, 0, 3.2, true, true, now(), now()),
  ('550e8400-e29b-41d4-a716-446655440102', NULL, 'Shopee', 'online', 1.5, 0.7, 1.5, 0, 3.7, true, true, now(), now()),
  ('550e8400-e29b-41d4-a716-446655440103', NULL, 'Bukalapak', 'online', 1.5, 0.7, 1.0, 0, 3.2, false, true, now(), now()),
  ('550e8400-e29b-41d4-a716-446655440104', NULL, 'Offline Store', 'offline', 0, 0, 0, 5.0, 5.0, true, true, now(), now())
ON CONFLICT (organization_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- pricing_calculations (product_id without FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_calculations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  product_id uuid NULL,
  calculation_name text NOT NULL,
  calculation_input jsonb NOT NULL,
  calculation_result jsonb NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_calculations_organization_id ON public.pricing_calculations USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_pricing_calculations_created_by ON public.pricing_calculations USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_pricing_calculations_product_id ON public.pricing_calculations USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_calculations_created_at ON public.pricing_calculations USING btree (created_at DESC);

DROP TRIGGER IF EXISTS update_pricing_calculations_updated_at ON public.pricing_calculations;
CREATE TRIGGER update_pricing_calculations_updated_at
  BEFORE UPDATE ON public.pricing_calculations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pricing_calculations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_tools_pc_select" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_select"
  ON public.pricing_calculations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_pc_insert" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_insert"
  ON public.pricing_calculations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_pc_update" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_update"
  ON public.pricing_calculations FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

DROP POLICY IF EXISTS "pricing_tools_pc_delete" ON public.pricing_calculations;
CREATE POLICY "pricing_tools_pc_delete"
  ON public.pricing_calculations FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = pricing_calculations.organization_id
    )
  );

COMMENT ON TABLE public.pricing_calculations IS 'Pricing tool: saved calculation history (input + result JSON).';

-- ---------------------------------------------------------------------------
-- pricing_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_description text NULL,
  category text NULL,
  industry text NULL,
  template_data jsonb NOT NULL,
  is_active boolean NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_templates_organization_id ON public.pricing_templates USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_pricing_templates_category ON public.pricing_templates USING btree (category);
CREATE INDEX IF NOT EXISTS idx_pricing_templates_is_active ON public.pricing_templates USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_templates_org_active ON public.pricing_templates USING btree (organization_id, is_active);

CREATE OR REPLACE FUNCTION public.update_pricing_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_pricing_templates_updated_at ON public.pricing_templates;
CREATE TRIGGER trigger_update_pricing_templates_updated_at
  BEFORE UPDATE ON public.pricing_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pricing_templates_updated_at();

ALTER TABLE public.pricing_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_tools_pt_select_global" ON public.pricing_templates;
CREATE POLICY "pricing_tools_pt_select_global"
  ON public.pricing_templates FOR SELECT TO authenticated
  USING (organization_id IS NULL);

DROP POLICY IF EXISTS "pricing_tools_pt_select_org" ON public.pricing_templates;
CREATE POLICY "pricing_tools_pt_select_org"
  ON public.pricing_templates FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "pricing_tools_pt_insert" ON public.pricing_templates;
CREATE POLICY "pricing_tools_pt_insert"
  ON public.pricing_templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "pricing_tools_pt_update" ON public.pricing_templates;
CREATE POLICY "pricing_tools_pt_update"
  ON public.pricing_templates FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pricing_tools_pt_delete" ON public.pricing_templates;
CREATE POLICY "pricing_tools_pt_delete"
  ON public.pricing_templates FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pricing_templates IS 'Pricing tool: reusable calculation templates (global + per-org).';
