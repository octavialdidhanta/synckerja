-- Sales type availability per POS outlet.

CREATE TABLE IF NOT EXISTS public.catalog_sales_type_outlets (
  sales_type_id uuid NOT NULL REFERENCES public.catalog_sales_types (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_sales_type_outlets_pkey PRIMARY KEY (sales_type_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_sales_type_outlets_org
  ON public.catalog_sales_type_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_sales_type_outlets_outlet
  ON public.catalog_sales_type_outlets (outlet_id);

ALTER TABLE public.catalog_sales_type_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_sales_type_outlets_org_select" ON public.catalog_sales_type_outlets;
CREATE POLICY "catalog_sales_type_outlets_org_select"
  ON public.catalog_sales_type_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_type_outlets_org_insert" ON public.catalog_sales_type_outlets;
CREATE POLICY "catalog_sales_type_outlets_org_insert"
  ON public.catalog_sales_type_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_type_outlets_org_update" ON public.catalog_sales_type_outlets;
CREATE POLICY "catalog_sales_type_outlets_org_update"
  ON public.catalog_sales_type_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_type_outlets_org_delete" ON public.catalog_sales_type_outlets;
CREATE POLICY "catalog_sales_type_outlets_org_delete"
  ON public.catalog_sales_type_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_sales_type_outlets IS
  'Sales type availability per POS outlet. UI requires min 1.';

INSERT INTO public.catalog_sales_type_outlets (sales_type_id, outlet_id, organization_id)
SELECT st.id, o.id, st.organization_id
FROM public.catalog_sales_types st
JOIN public.pos_outlets o
  ON o.organization_id = st.organization_id
 AND o.is_deleted = false
 AND o.is_active = true
WHERE NOT EXISTS (
    SELECT 1
    FROM public.catalog_sales_type_outlets existing
    WHERE existing.sales_type_id = st.id
  )
ON CONFLICT DO NOTHING;
