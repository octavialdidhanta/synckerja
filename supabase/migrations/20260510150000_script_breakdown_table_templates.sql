-- Org-scoped script breakdown table templates for Script Generator (Product Knowledge).
-- Prerequisites: public.organizations, public.update_updated_at_column(), public.user_organization_ids().

CREATE TABLE IF NOT EXISTS public.script_breakdown_table_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT script_breakdown_table_templates_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_script_breakdown_table_templates_org
  ON public.script_breakdown_table_templates USING btree (organization_id);

DROP TRIGGER IF EXISTS update_script_breakdown_table_templates_updated_at ON public.script_breakdown_table_templates;
CREATE TRIGGER update_script_breakdown_table_templates_updated_at
  BEFORE UPDATE ON public.script_breakdown_table_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.script_breakdown_table_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.script_breakdown_table_templates (id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  header_label text NOT NULL,
  placeholder_example text NULL,
  detail_body text NULL,
  fill_rule text NOT NULL DEFAULT 'strict'::text
    CONSTRAINT script_breakdown_table_columns_fill_rule_check
      CHECK (fill_rule = ANY (ARRAY['strict'::text, 'honest_empty'::text])),
  keyword_hint text NOT NULL DEFAULT 'none'::text
    CONSTRAINT script_breakdown_table_columns_keyword_hint_check
      CHECK (keyword_hint = ANY (ARRAY['none'::text, 'narasi'::text, 'visual'::text]))
);

CREATE INDEX IF NOT EXISTS idx_script_breakdown_table_columns_template_sort
  ON public.script_breakdown_table_columns USING btree (template_id, sort_order);

ALTER TABLE public.script_breakdown_table_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_breakdown_table_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "script_breakdown_table_templates_org" ON public.script_breakdown_table_templates;
CREATE POLICY "script_breakdown_table_templates_org" ON public.script_breakdown_table_templates
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "script_breakdown_table_columns_org" ON public.script_breakdown_table_columns;
CREATE POLICY "script_breakdown_table_columns_org" ON public.script_breakdown_table_columns
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.script_breakdown_table_templates t
      WHERE t.id = script_breakdown_table_columns.template_id
        AND t.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.script_breakdown_table_templates t
      WHERE t.id = script_breakdown_table_columns.template_id
        AND t.organization_id IN (SELECT public.user_organization_ids())
    )
  );
