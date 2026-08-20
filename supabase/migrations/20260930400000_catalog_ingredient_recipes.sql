-- Semi-finished recipes: one recipe per output ingredient, lines are raw components.

CREATE TABLE IF NOT EXISTS public.catalog_ingredient_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  output_ingredient_id uuid NOT NULL REFERENCES public.catalog_ingredients (id) ON DELETE CASCADE,
  yield_qty numeric(14, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_ingredient_recipes_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_ingredient_recipes_output_unique UNIQUE (output_ingredient_id),
  CONSTRAINT catalog_ingredient_recipes_yield_check CHECK (yield_qty >= 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_recipes_org
  ON public.catalog_ingredient_recipes (organization_id);

ALTER TABLE public.catalog_ingredient_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_ingredient_recipes_org_select" ON public.catalog_ingredient_recipes;
CREATE POLICY "catalog_ingredient_recipes_org_select"
  ON public.catalog_ingredient_recipes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_recipes_org_insert" ON public.catalog_ingredient_recipes;
CREATE POLICY "catalog_ingredient_recipes_org_insert"
  ON public.catalog_ingredient_recipes FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_recipes_org_update" ON public.catalog_ingredient_recipes;
CREATE POLICY "catalog_ingredient_recipes_org_update"
  ON public.catalog_ingredient_recipes FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_recipes_org_delete" ON public.catalog_ingredient_recipes;
CREATE POLICY "catalog_ingredient_recipes_org_delete"
  ON public.catalog_ingredient_recipes FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_ingredient_recipes_updated_at ON public.catalog_ingredient_recipes;
CREATE TRIGGER update_catalog_ingredient_recipes_updated_at
  BEFORE UPDATE ON public.catalog_ingredient_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_ingredient_recipes IS
  'Recipe header for a semi-finished ingredient. Produce/stock deduction is a later phase.';

CREATE TABLE IF NOT EXISTS public.catalog_ingredient_recipe_lines (
  recipe_id uuid NOT NULL REFERENCES public.catalog_ingredient_recipes (id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.catalog_ingredients (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  quantity numeric(14, 3) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_ingredient_recipe_lines_pkey PRIMARY KEY (recipe_id, ingredient_id),
  CONSTRAINT catalog_ingredient_recipe_lines_qty_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_recipe_lines_org
  ON public.catalog_ingredient_recipe_lines (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_ingredient_recipe_lines_ingredient
  ON public.catalog_ingredient_recipe_lines (ingredient_id);

ALTER TABLE public.catalog_ingredient_recipe_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_ingredient_recipe_lines_org_select" ON public.catalog_ingredient_recipe_lines;
CREATE POLICY "catalog_ingredient_recipe_lines_org_select"
  ON public.catalog_ingredient_recipe_lines FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_recipe_lines_org_insert" ON public.catalog_ingredient_recipe_lines;
CREATE POLICY "catalog_ingredient_recipe_lines_org_insert"
  ON public.catalog_ingredient_recipe_lines FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_recipe_lines_org_update" ON public.catalog_ingredient_recipe_lines;
CREATE POLICY "catalog_ingredient_recipe_lines_org_update"
  ON public.catalog_ingredient_recipe_lines FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_ingredient_recipe_lines_org_delete" ON public.catalog_ingredient_recipe_lines;
CREATE POLICY "catalog_ingredient_recipe_lines_org_delete"
  ON public.catalog_ingredient_recipe_lines FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_ingredient_recipe_lines IS
  'Raw ingredient quantities required to produce the recipe yield.';

CREATE OR REPLACE FUNCTION public.catalog_ingredient_recipe_validate_output()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  output_kind text;
BEGIN
  SELECT kind INTO output_kind
  FROM public.catalog_ingredients
  WHERE id = NEW.output_ingredient_id
    AND organization_id = NEW.organization_id
    AND is_deleted = false;
  IF output_kind IS DISTINCT FROM 'semi_finished' THEN
    RAISE EXCEPTION 'recipe_output_must_be_semi_finished';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_ingredient_recipe_validate_output ON public.catalog_ingredient_recipes;
CREATE TRIGGER catalog_ingredient_recipe_validate_output
  BEFORE INSERT OR UPDATE OF output_ingredient_id ON public.catalog_ingredient_recipes
  FOR EACH ROW EXECUTE FUNCTION public.catalog_ingredient_recipe_validate_output();

CREATE OR REPLACE FUNCTION public.catalog_ingredient_recipe_validate_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  line_kind text;
  output_id uuid;
BEGIN
  SELECT kind INTO line_kind
  FROM public.catalog_ingredients
  WHERE id = NEW.ingredient_id
    AND organization_id = NEW.organization_id
    AND is_deleted = false;
  IF line_kind IS DISTINCT FROM 'raw' THEN
    RAISE EXCEPTION 'recipe_line_must_be_raw';
  END IF;
  SELECT output_ingredient_id INTO output_id
  FROM public.catalog_ingredient_recipes
  WHERE id = NEW.recipe_id;
  IF output_id IS NOT NULL AND output_id = NEW.ingredient_id THEN
    RAISE EXCEPTION 'recipe_line_cannot_be_output';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_ingredient_recipe_validate_line ON public.catalog_ingredient_recipe_lines;
CREATE TRIGGER catalog_ingredient_recipe_validate_line
  BEFORE INSERT OR UPDATE OF ingredient_id, recipe_id ON public.catalog_ingredient_recipe_lines
  FOR EACH ROW EXECUTE FUNCTION public.catalog_ingredient_recipe_validate_line();
