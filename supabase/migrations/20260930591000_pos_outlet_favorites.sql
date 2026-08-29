-- Per-outlet curated POS Favorit catalog order

CREATE TABLE IF NOT EXISTS public.pos_outlet_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_outlet_favorites_pkey PRIMARY KEY (id),
  CONSTRAINT pos_outlet_favorites_sort_order_check CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_outlet_favorites_outlet_item
  ON public.pos_outlet_favorites (outlet_id, catalog_item_id);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_favorites_outlet_order
  ON public.pos_outlet_favorites (organization_id, outlet_id, sort_order ASC);

DROP TRIGGER IF EXISTS update_pos_outlet_favorites_updated_at ON public.pos_outlet_favorites;
CREATE TRIGGER update_pos_outlet_favorites_updated_at
  BEFORE UPDATE ON public.pos_outlet_favorites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_outlet_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_outlet_favorites_org_select" ON public.pos_outlet_favorites;
CREATE POLICY "pos_outlet_favorites_org_select"
  ON public.pos_outlet_favorites FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_favorites_org_insert" ON public.pos_outlet_favorites;
CREATE POLICY "pos_outlet_favorites_org_insert"
  ON public.pos_outlet_favorites FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_favorites_org_update" ON public.pos_outlet_favorites;
CREATE POLICY "pos_outlet_favorites_org_update"
  ON public.pos_outlet_favorites FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_favorites_org_delete" ON public.pos_outlet_favorites;
CREATE POLICY "pos_outlet_favorites_org_delete"
  ON public.pos_outlet_favorites FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_outlet_favorites IS
  'Cashier-curated Favorit grid order per POS outlet (default_prices catalog ids).';
