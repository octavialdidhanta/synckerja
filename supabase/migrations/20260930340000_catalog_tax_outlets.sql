-- Tax availability per POS outlet.

CREATE TABLE IF NOT EXISTS public.catalog_tax_outlets (
  tax_id uuid NOT NULL REFERENCES public.catalog_taxes (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_tax_outlets_pkey PRIMARY KEY (tax_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_tax_outlets_org
  ON public.catalog_tax_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_tax_outlets_outlet
  ON public.catalog_tax_outlets (outlet_id);

ALTER TABLE public.catalog_tax_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_tax_outlets_org_select" ON public.catalog_tax_outlets;
CREATE POLICY "catalog_tax_outlets_org_select"
  ON public.catalog_tax_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_tax_outlets_org_insert" ON public.catalog_tax_outlets;
CREATE POLICY "catalog_tax_outlets_org_insert"
  ON public.catalog_tax_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_tax_outlets_org_update" ON public.catalog_tax_outlets;
CREATE POLICY "catalog_tax_outlets_org_update"
  ON public.catalog_tax_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_tax_outlets_org_delete" ON public.catalog_tax_outlets;
CREATE POLICY "catalog_tax_outlets_org_delete"
  ON public.catalog_tax_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_tax_outlets IS
  'Tax availability per POS outlet. UI requires min 1.';

INSERT INTO public.catalog_tax_outlets (tax_id, outlet_id, organization_id)
SELECT t.id, o.id, t.organization_id
FROM public.catalog_taxes t
JOIN public.pos_outlets o
  ON o.organization_id = t.organization_id
 AND o.is_deleted = false
 AND o.is_active = true
WHERE COALESCE(t.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.catalog_tax_outlets existing
    WHERE existing.tax_id = t.id
  )
ON CONFLICT DO NOTHING;
