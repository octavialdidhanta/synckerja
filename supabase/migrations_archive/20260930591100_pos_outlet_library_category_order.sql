-- Per-outlet POS Library custom category display order

CREATE TABLE IF NOT EXISTS public.pos_outlet_library_category_order (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.catalog_product_categories (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_outlet_library_category_order_pkey PRIMARY KEY (id),
  CONSTRAINT pos_outlet_library_category_order_sort_check CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_outlet_library_cat_order
  ON public.pos_outlet_library_category_order (outlet_id, category_id);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_library_cat_order
  ON public.pos_outlet_library_category_order (organization_id, outlet_id, sort_order ASC);

DROP TRIGGER IF EXISTS update_pos_outlet_library_category_order_updated_at
  ON public.pos_outlet_library_category_order;
CREATE TRIGGER update_pos_outlet_library_category_order_updated_at
  BEFORE UPDATE ON public.pos_outlet_library_category_order
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_outlet_library_category_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_outlet_library_cat_order_select" ON public.pos_outlet_library_category_order;
CREATE POLICY "pos_outlet_library_cat_order_select"
  ON public.pos_outlet_library_category_order FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_library_cat_order_insert" ON public.pos_outlet_library_category_order;
CREATE POLICY "pos_outlet_library_cat_order_insert"
  ON public.pos_outlet_library_category_order FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_library_cat_order_update" ON public.pos_outlet_library_category_order;
CREATE POLICY "pos_outlet_library_cat_order_update"
  ON public.pos_outlet_library_category_order FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_library_cat_order_delete" ON public.pos_outlet_library_category_order;
CREATE POLICY "pos_outlet_library_cat_order_delete"
  ON public.pos_outlet_library_category_order FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_outlet_library_category_order IS
  'Cashier Library hub custom category order per POS outlet.';
