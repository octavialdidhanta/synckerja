-- Assign Promo/Bundle to POS outlets (junction). Existing rows backfill all active outlets.

CREATE TABLE IF NOT EXISTS public.catalog_promo_outlets (
  promo_id uuid NOT NULL REFERENCES public.catalog_promos (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_promo_outlets_pkey PRIMARY KEY (promo_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_promo_outlets_org
  ON public.catalog_promo_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_promo_outlets_outlet
  ON public.catalog_promo_outlets (outlet_id);

ALTER TABLE public.catalog_promo_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_promo_outlets_org_select" ON public.catalog_promo_outlets;
CREATE POLICY "catalog_promo_outlets_org_select"
  ON public.catalog_promo_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_outlets_org_insert" ON public.catalog_promo_outlets;
CREATE POLICY "catalog_promo_outlets_org_insert"
  ON public.catalog_promo_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_outlets_org_update" ON public.catalog_promo_outlets;
CREATE POLICY "catalog_promo_outlets_org_update"
  ON public.catalog_promo_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_outlets_org_delete" ON public.catalog_promo_outlets;
CREATE POLICY "catalog_promo_outlets_org_delete"
  ON public.catalog_promo_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_promo_outlets IS
  'Promo availability per POS outlet. Empty after backfill is not expected; UI requires min 1.';

CREATE TABLE IF NOT EXISTS public.catalog_bundle_outlets (
  bundle_id uuid NOT NULL REFERENCES public.catalog_bundles (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_bundle_outlets_pkey PRIMARY KEY (bundle_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_bundle_outlets_org
  ON public.catalog_bundle_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_bundle_outlets_outlet
  ON public.catalog_bundle_outlets (outlet_id);

ALTER TABLE public.catalog_bundle_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_bundle_outlets_org_select" ON public.catalog_bundle_outlets;
CREATE POLICY "catalog_bundle_outlets_org_select"
  ON public.catalog_bundle_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_outlets_org_insert" ON public.catalog_bundle_outlets;
CREATE POLICY "catalog_bundle_outlets_org_insert"
  ON public.catalog_bundle_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_outlets_org_update" ON public.catalog_bundle_outlets;
CREATE POLICY "catalog_bundle_outlets_org_update"
  ON public.catalog_bundle_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_outlets_org_delete" ON public.catalog_bundle_outlets;
CREATE POLICY "catalog_bundle_outlets_org_delete"
  ON public.catalog_bundle_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_bundle_outlets IS
  'Bundle availability per POS outlet. Empty after backfill is not expected; UI requires min 1.';

INSERT INTO public.catalog_promo_outlets (promo_id, outlet_id, organization_id)
SELECT p.id, o.id, p.organization_id
FROM public.catalog_promos p
JOIN public.pos_outlets o
  ON o.organization_id = p.organization_id
 AND o.is_deleted = false
 AND o.is_active = true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.catalog_promo_outlets existing
  WHERE existing.promo_id = p.id
)
ON CONFLICT DO NOTHING;

INSERT INTO public.catalog_bundle_outlets (bundle_id, outlet_id, organization_id)
SELECT b.id, o.id, b.organization_id
FROM public.catalog_bundles b
JOIN public.pos_outlets o
  ON o.organization_id = b.organization_id
 AND o.is_deleted = false
 AND o.is_active = true
WHERE COALESCE(b.is_deleted, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.catalog_bundle_outlets existing
    WHERE existing.bundle_id = b.id
  )
ON CONFLICT DO NOTHING;
