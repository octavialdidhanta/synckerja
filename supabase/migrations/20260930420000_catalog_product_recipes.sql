-- Product/menu recipes: link sellable items (default_prices products) to ingredient BOM lines.
-- POS stock deduction from product recipes is a later phase.

CREATE TABLE IF NOT EXISTS public.catalog_product_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  modifier_option_id uuid REFERENCES public.catalog_modifier_options (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_recipes_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_product_recipes_base
  ON public.catalog_product_recipes (product_id)
  WHERE modifier_option_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_product_recipes_variant
  ON public.catalog_product_recipes (product_id, modifier_option_id)
  WHERE modifier_option_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_product_recipes_org
  ON public.catalog_product_recipes (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_product_recipes_product
  ON public.catalog_product_recipes (product_id);

ALTER TABLE public.catalog_product_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_recipes_org_select" ON public.catalog_product_recipes;
CREATE POLICY "catalog_product_recipes_org_select"
  ON public.catalog_product_recipes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_recipes_org_insert" ON public.catalog_product_recipes;
CREATE POLICY "catalog_product_recipes_org_insert"
  ON public.catalog_product_recipes FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_recipes_org_update" ON public.catalog_product_recipes;
CREATE POLICY "catalog_product_recipes_org_update"
  ON public.catalog_product_recipes FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_recipes_org_delete" ON public.catalog_product_recipes;
CREATE POLICY "catalog_product_recipes_org_delete"
  ON public.catalog_product_recipes FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_product_recipes_updated_at ON public.catalog_product_recipes;
CREATE TRIGGER update_catalog_product_recipes_updated_at
  BEFORE UPDATE ON public.catalog_product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_product_recipes IS
  'Recipe header linking a POS product (and optional modifier variant) to ingredient lines. Stock deduction is a later phase.';

CREATE TABLE IF NOT EXISTS public.catalog_product_recipe_lines (
  recipe_id uuid NOT NULL REFERENCES public.catalog_product_recipes (id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.catalog_ingredients (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  quantity numeric(14, 3) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_recipe_lines_pkey PRIMARY KEY (recipe_id, ingredient_id),
  CONSTRAINT catalog_product_recipe_lines_qty_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_product_recipe_lines_org
  ON public.catalog_product_recipe_lines (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_product_recipe_lines_ingredient
  ON public.catalog_product_recipe_lines (ingredient_id);

ALTER TABLE public.catalog_product_recipe_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_recipe_lines_org_select" ON public.catalog_product_recipe_lines;
CREATE POLICY "catalog_product_recipe_lines_org_select"
  ON public.catalog_product_recipe_lines FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_recipe_lines_org_insert" ON public.catalog_product_recipe_lines;
CREATE POLICY "catalog_product_recipe_lines_org_insert"
  ON public.catalog_product_recipe_lines FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_recipe_lines_org_update" ON public.catalog_product_recipe_lines;
CREATE POLICY "catalog_product_recipe_lines_org_update"
  ON public.catalog_product_recipe_lines FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_recipe_lines_org_delete" ON public.catalog_product_recipe_lines;
CREATE POLICY "catalog_product_recipe_lines_org_delete"
  ON public.catalog_product_recipe_lines FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_product_recipe_lines IS
  'Ingredient quantities consumed per single unit sold of the product (or variant).';

CREATE OR REPLACE FUNCTION public.catalog_product_recipe_validate_header()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  product_kind text;
  option_group_id uuid;
BEGIN
  SELECT kind INTO product_kind
  FROM public.default_prices
  WHERE id = NEW.product_id
    AND organization_id = NEW.organization_id;
  IF product_kind IS DISTINCT FROM 'product' THEN
    RAISE EXCEPTION 'product_recipe_product_must_be_product_kind';
  END IF;

  IF NEW.modifier_option_id IS NOT NULL THEN
    SELECT group_id INTO option_group_id
    FROM public.catalog_modifier_options
    WHERE id = NEW.modifier_option_id
      AND organization_id = NEW.organization_id
      AND is_active = true;
    IF option_group_id IS NULL THEN
      RAISE EXCEPTION 'product_recipe_modifier_option_invalid';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.catalog_product_modifiers cpm
      WHERE cpm.product_id = NEW.product_id
        AND cpm.group_id = option_group_id
    ) THEN
      RAISE EXCEPTION 'product_recipe_modifier_not_linked';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_product_recipe_validate_header ON public.catalog_product_recipes;
CREATE TRIGGER catalog_product_recipe_validate_header
  BEFORE INSERT OR UPDATE OF product_id, modifier_option_id ON public.catalog_product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.catalog_product_recipe_validate_header();

CREATE OR REPLACE FUNCTION public.catalog_product_recipe_validate_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  line_kind text;
BEGIN
  SELECT kind INTO line_kind
  FROM public.catalog_ingredients
  WHERE id = NEW.ingredient_id
    AND organization_id = NEW.organization_id
    AND is_deleted = false;
  IF line_kind NOT IN ('raw', 'semi_finished') THEN
    RAISE EXCEPTION 'product_recipe_line_must_be_ingredient';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_product_recipe_validate_line ON public.catalog_product_recipe_lines;
CREATE TRIGGER catalog_product_recipe_validate_line
  BEFORE INSERT OR UPDATE OF ingredient_id, recipe_id ON public.catalog_product_recipe_lines
  FOR EACH ROW EXECUTE FUNCTION public.catalog_product_recipe_validate_line();
