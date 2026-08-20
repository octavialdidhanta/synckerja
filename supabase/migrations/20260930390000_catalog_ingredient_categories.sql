-- Ingredient categories (org-unique name) and per-outlet availability.
-- Ingredients reference at most one category; null means Uncategorized.

CREATE TABLE IF NOT EXISTS public.catalog_ingredient_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_ingredient_categories_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_ingredient_categories_name_check CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_ingredient_categories_org_name
  ON public.catalog_ingredient_categories (organization_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_categories_org
  ON public.catalog_ingredient_categories (organization_id, sort_order, name);

ALTER TABLE public.catalog_ingredient_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_ingredient_categories_org_select" ON public.catalog_ingredient_categories;
CREATE POLICY "catalog_ingredient_categories_org_select"
  ON public.catalog_ingredient_categories FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_categories_org_insert" ON public.catalog_ingredient_categories;
CREATE POLICY "catalog_ingredient_categories_org_insert"
  ON public.catalog_ingredient_categories FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_categories_org_update" ON public.catalog_ingredient_categories;
CREATE POLICY "catalog_ingredient_categories_org_update"
  ON public.catalog_ingredient_categories FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_categories_org_delete" ON public.catalog_ingredient_categories;
CREATE POLICY "catalog_ingredient_categories_org_delete"
  ON public.catalog_ingredient_categories FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_ingredient_categories_updated_at ON public.catalog_ingredient_categories;
CREATE TRIGGER update_catalog_ingredient_categories_updated_at
  BEFORE UPDATE ON public.catalog_ingredient_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_ingredient_categories IS
  'Ingredient grouping labels. Name is unique per organization.';

CREATE TABLE IF NOT EXISTS public.catalog_ingredient_category_outlets (
  category_id uuid NOT NULL REFERENCES public.catalog_ingredient_categories (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_ingredient_category_outlets_pkey PRIMARY KEY (category_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_category_outlets_org
  ON public.catalog_ingredient_category_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_category_outlets_outlet
  ON public.catalog_ingredient_category_outlets (outlet_id);

ALTER TABLE public.catalog_ingredient_category_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_ingredient_category_outlets_org_select" ON public.catalog_ingredient_category_outlets;
CREATE POLICY "catalog_ingredient_category_outlets_org_select"
  ON public.catalog_ingredient_category_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_category_outlets_org_insert" ON public.catalog_ingredient_category_outlets;
CREATE POLICY "catalog_ingredient_category_outlets_org_insert"
  ON public.catalog_ingredient_category_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_category_outlets_org_update" ON public.catalog_ingredient_category_outlets;
CREATE POLICY "catalog_ingredient_category_outlets_org_update"
  ON public.catalog_ingredient_category_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_category_outlets_org_delete" ON public.catalog_ingredient_category_outlets;
CREATE POLICY "catalog_ingredient_category_outlets_org_delete"
  ON public.catalog_ingredient_category_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_ingredient_category_outlets IS
  'Ingredient category availability per POS outlet. Create seeds the selected outlet.';

ALTER TABLE public.catalog_ingredients
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.catalog_ingredient_categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_ingredients_org_category
  ON public.catalog_ingredients (organization_id, category_id)
  WHERE is_deleted = false;
