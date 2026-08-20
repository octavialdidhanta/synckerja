-- Brand availability per POS outlet.

CREATE TABLE IF NOT EXISTS public.catalog_brand_outlets (
  brand_id uuid NOT NULL REFERENCES public.catalog_brands (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_brand_outlets_pkey PRIMARY KEY (brand_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_brand_outlets_org
  ON public.catalog_brand_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_brand_outlets_outlet
  ON public.catalog_brand_outlets (outlet_id);

ALTER TABLE public.catalog_brand_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_brand_outlets_org_select" ON public.catalog_brand_outlets;
CREATE POLICY "catalog_brand_outlets_org_select"
  ON public.catalog_brand_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_brand_outlets_org_insert" ON public.catalog_brand_outlets;
CREATE POLICY "catalog_brand_outlets_org_insert"
  ON public.catalog_brand_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_brand_outlets_org_update" ON public.catalog_brand_outlets;
CREATE POLICY "catalog_brand_outlets_org_update"
  ON public.catalog_brand_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_brand_outlets_org_delete" ON public.catalog_brand_outlets;
CREATE POLICY "catalog_brand_outlets_org_delete"
  ON public.catalog_brand_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_brand_outlets IS
  'Brand availability per POS outlet. UI requires min 1.';

INSERT INTO public.catalog_brand_outlets (brand_id, outlet_id, organization_id)
SELECT b.id, o.id, b.organization_id
FROM public.catalog_brands b
JOIN public.pos_outlets o
  ON o.organization_id = b.organization_id
 AND o.is_deleted = false
 AND o.is_active = true
WHERE COALESCE(b.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.catalog_brand_outlets existing
    WHERE existing.brand_id = b.id
  )
ON CONFLICT DO NOTHING;
