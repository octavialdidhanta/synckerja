-- Product availability per POS outlet, with optional price/status overrides.

CREATE TABLE IF NOT EXISTS public.catalog_product_outlets (
  product_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  unit_price numeric NULL,
  pos_status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_outlets_pkey PRIMARY KEY (product_id, outlet_id),
  CONSTRAINT catalog_product_outlets_pos_status_check CHECK (
    pos_status IS NULL OR pos_status IN ('available', 'sold_out', 'hidden')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_product_outlets_org
  ON public.catalog_product_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_product_outlets_outlet
  ON public.catalog_product_outlets (outlet_id);

ALTER TABLE public.catalog_product_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_outlets_org_select" ON public.catalog_product_outlets;
CREATE POLICY "catalog_product_outlets_org_select"
  ON public.catalog_product_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_outlets_org_insert" ON public.catalog_product_outlets;
CREATE POLICY "catalog_product_outlets_org_insert"
  ON public.catalog_product_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_outlets_org_update" ON public.catalog_product_outlets;
CREATE POLICY "catalog_product_outlets_org_update"
  ON public.catalog_product_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_outlets_org_delete" ON public.catalog_product_outlets;
CREATE POLICY "catalog_product_outlets_org_delete"
  ON public.catalog_product_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_product_outlets IS
  'Product availability per POS outlet. Null unit_price/pos_status inherit the default_prices master.';

INSERT INTO public.catalog_product_outlets (product_id, outlet_id, organization_id)
SELECT p.id, o.id, p.organization_id
FROM public.default_prices p
JOIN public.pos_outlets o
  ON o.organization_id = p.organization_id
 AND o.is_deleted = false
 AND o.is_active = true
WHERE p.kind = 'product'
  AND NOT EXISTS (
    SELECT 1
    FROM public.catalog_product_outlets existing
    WHERE existing.product_id = p.id
  )
ON CONFLICT DO NOTHING;
