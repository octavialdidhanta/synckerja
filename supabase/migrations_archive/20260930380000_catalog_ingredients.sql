-- Catalog ingredients (raw / semi-finished) and per-outlet stock, alerts, and COGS.

CREATE TABLE IF NOT EXISTS public.catalog_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'raw',
  unit_code text NOT NULL,
  track_inventory boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_ingredients_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_ingredients_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_ingredients_kind_check CHECK (kind IN ('raw', 'semi_finished')),
  CONSTRAINT catalog_ingredients_unit_code_check CHECK (btrim(unit_code) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_ingredients_org_name
  ON public.catalog_ingredients (organization_id, lower(btrim(name)))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_catalog_ingredients_org
  ON public.catalog_ingredients (organization_id, sort_order, name)
  WHERE is_deleted = false;

ALTER TABLE public.catalog_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_ingredients_org_select" ON public.catalog_ingredients;
CREATE POLICY "catalog_ingredients_org_select"
  ON public.catalog_ingredients FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredients_org_insert" ON public.catalog_ingredients;
CREATE POLICY "catalog_ingredients_org_insert"
  ON public.catalog_ingredients FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredients_org_update" ON public.catalog_ingredients;
CREATE POLICY "catalog_ingredients_org_update"
  ON public.catalog_ingredients FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredients_org_delete" ON public.catalog_ingredients;
CREATE POLICY "catalog_ingredients_org_delete"
  ON public.catalog_ingredients FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_ingredients_updated_at ON public.catalog_ingredients;
CREATE TRIGGER update_catalog_ingredients_updated_at
  BEFORE UPDATE ON public.catalog_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_ingredients IS
  'Raw and semi-finished ingredients. POS stock decrement and recipes are a later phase.';

CREATE TABLE IF NOT EXISTS public.catalog_ingredient_outlets (
  ingredient_id uuid NOT NULL REFERENCES public.catalog_ingredients (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  in_stock numeric(14, 3) NOT NULL DEFAULT 0,
  alert_enabled boolean NOT NULL DEFAULT false,
  alert_at numeric(14, 3),
  track_cogs boolean NOT NULL DEFAULT false,
  avg_cost numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_ingredient_outlets_pkey PRIMARY KEY (ingredient_id, outlet_id),
  CONSTRAINT catalog_ingredient_outlets_in_stock_check CHECK (in_stock >= 0),
  CONSTRAINT catalog_ingredient_outlets_alert_at_check CHECK (alert_at IS NULL OR alert_at >= 0),
  CONSTRAINT catalog_ingredient_outlets_avg_cost_check CHECK (avg_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_outlets_org
  ON public.catalog_ingredient_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_outlets_outlet
  ON public.catalog_ingredient_outlets (outlet_id);

ALTER TABLE public.catalog_ingredient_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_ingredient_outlets_org_select" ON public.catalog_ingredient_outlets;
CREATE POLICY "catalog_ingredient_outlets_org_select"
  ON public.catalog_ingredient_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_outlets_org_insert" ON public.catalog_ingredient_outlets;
CREATE POLICY "catalog_ingredient_outlets_org_insert"
  ON public.catalog_ingredient_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_outlets_org_update" ON public.catalog_ingredient_outlets;
CREATE POLICY "catalog_ingredient_outlets_org_update"
  ON public.catalog_ingredient_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_outlets_org_delete" ON public.catalog_ingredient_outlets;
CREATE POLICY "catalog_ingredient_outlets_org_delete"
  ON public.catalog_ingredient_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_ingredient_outlets IS
  'Ingredient stock, low-stock alert, and average COGS per POS outlet.';
