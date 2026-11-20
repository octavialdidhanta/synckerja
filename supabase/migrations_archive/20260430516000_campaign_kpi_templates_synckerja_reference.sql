-- KPI calculator saved templates (Services / Sales), aligned with synckerja-reference.
-- Uses public.update_updated_at_column() from prior migrations (do not redefine here).

CREATE TABLE IF NOT EXISTS public.campaign_kpi_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('services', 'sales')),
    settings JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_kpi_templates_org ON public.campaign_kpi_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_kpi_templates_creator ON public.campaign_kpi_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_campaign_kpi_templates_org_type ON public.campaign_kpi_templates(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_campaign_kpi_templates_public ON public.campaign_kpi_templates(is_public);

DROP TRIGGER IF EXISTS update_campaign_kpi_templates_updated_at ON public.campaign_kpi_templates;
CREATE TRIGGER update_campaign_kpi_templates_updated_at
    BEFORE UPDATE ON public.campaign_kpi_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.campaign_kpi_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view organization templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can view organization templates"
  ON public.campaign_kpi_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = campaign_kpi_templates.organization_id
    )
    AND (
      campaign_kpi_templates.is_public = TRUE
      OR campaign_kpi_templates.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert organization templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can insert organization templates"
  ON public.campaign_kpi_templates
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = campaign_kpi_templates.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update their own templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can update their own templates"
  ON public.campaign_kpi_templates
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.campaign_kpi_templates;
CREATE POLICY "Users can delete their own templates"
  ON public.campaign_kpi_templates
  FOR DELETE
  USING (auth.uid() = created_by);

COMMENT ON TABLE public.campaign_kpi_templates IS 'Stores saved KPI calculator templates per organization with optional sharing within the tenant.';
COMMENT ON COLUMN public.campaign_kpi_templates.organization_id IS 'Organization (tenant) that owns this template.';
COMMENT ON COLUMN public.campaign_kpi_templates.created_by IS 'User who created the template.';
COMMENT ON COLUMN public.campaign_kpi_templates.settings IS 'Serialized KPI calculator inputs for quick reuse.';
COMMENT ON COLUMN public.campaign_kpi_templates.is_public IS 'When true, template is visible to everyone in the organization.';
