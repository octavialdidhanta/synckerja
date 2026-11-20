-- Default prices per Service + Category (sub_service) for lead conversion amount.
-- SOP templates and steps (reference: synckerja-reference).
-- Page access: Tools / Default Prices.

CREATE TABLE IF NOT EXISTS public.default_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  sub_service_id UUID REFERENCES public.sub_services(id) ON DELETE CASCADE,
  unit_price NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_default_prices_org_service_sub UNIQUE (organization_id, service_id, sub_service_id)
);

CREATE INDEX IF NOT EXISTS idx_default_prices_lookup
  ON public.default_prices(organization_id, service_id, sub_service_id);

COMMENT ON TABLE public.default_prices IS 'Default unit price per Service + Category for auto-filling amount on lead conversion.';

ALTER TABLE public.default_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org default_prices"
  ON public.default_prices FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = default_prices.organization_id));

CREATE POLICY "Users can insert own org default_prices"
  ON public.default_prices FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = default_prices.organization_id));

CREATE POLICY "Users can update own org default_prices"
  ON public.default_prices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = default_prices.organization_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = default_prices.organization_id));

CREATE POLICY "Users can delete own org default_prices"
  ON public.default_prices FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = default_prices.organization_id));

CREATE TABLE IF NOT EXISTS public.sop_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_price_id UUID NOT NULL REFERENCES public.default_prices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_sop_templates_default_price UNIQUE (default_price_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_templates_default_price
  ON public.sop_templates(default_price_id);
CREATE INDEX IF NOT EXISTS idx_sop_templates_organization
  ON public.sop_templates(organization_id);

COMMENT ON TABLE public.sop_templates IS 'One workflow/SOP template per default_price (Service + Sub Service).';

ALTER TABLE public.sop_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org sop_templates"
  ON public.sop_templates FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = sop_templates.organization_id));

CREATE POLICY "Users can insert own org sop_templates"
  ON public.sop_templates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = sop_templates.organization_id));

CREATE POLICY "Users can update own org sop_templates"
  ON public.sop_templates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = sop_templates.organization_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = sop_templates.organization_id));

CREATE POLICY "Users can delete own org sop_templates"
  ON public.sop_templates FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = sop_templates.organization_id));

CREATE TABLE IF NOT EXISTS public.sop_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_template_id UUID NOT NULL REFERENCES public.sop_templates(id) ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('days_before_h', 'hari_h', 'working_days_after_h')),
  schedule_value INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sop_template_steps_template
  ON public.sop_template_steps(sop_template_id);

COMMENT ON TABLE public.sop_template_steps IS 'Steps of an SOP template; schedule_type drives due date calculation from Hari H.';

ALTER TABLE public.sop_template_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sop_template_steps via org"
  ON public.sop_template_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sop_templates st
    JOIN profiles p ON p.active_organization_id = st.organization_id AND p.user_id = auth.uid()
    WHERE st.id = sop_template_steps.sop_template_id
  ));

CREATE POLICY "Users can insert sop_template_steps via org"
  ON public.sop_template_steps FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sop_templates st
    JOIN profiles p ON p.active_organization_id = st.organization_id AND p.user_id = auth.uid()
    WHERE st.id = sop_template_steps.sop_template_id
  ));

CREATE POLICY "Users can update sop_template_steps via org"
  ON public.sop_template_steps FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sop_templates st
    JOIN profiles p ON p.active_organization_id = st.organization_id AND p.user_id = auth.uid()
    WHERE st.id = sop_template_steps.sop_template_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sop_templates st
    JOIN profiles p ON p.active_organization_id = st.organization_id AND p.user_id = auth.uid()
    WHERE st.id = sop_template_steps.sop_template_id
  ));

CREATE POLICY "Users can delete sop_template_steps via org"
  ON public.sop_template_steps FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sop_templates st
    JOIN profiles p ON p.active_organization_id = st.organization_id AND p.user_id = auth.uid()
    WHERE st.id = sop_template_steps.sop_template_id
  ));

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440081', NULL, '/tools/default-prices', 'Tools Default Prices', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/tools/default-prices'
);
