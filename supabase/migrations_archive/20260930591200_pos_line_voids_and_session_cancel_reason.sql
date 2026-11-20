-- Cancel reason on table sessions + product line voids for cashier Bill List

ALTER TABLE public.pos_table_sessions
  ADD COLUMN IF NOT EXISTS cancel_reason text;

COMMENT ON COLUMN public.pos_table_sessions.cancel_reason IS
  'Free-text reason when status becomes cancelled.';

CREATE TABLE IF NOT EXISTS public.pos_line_voids (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  session_id uuid NULL REFERENCES public.pos_table_sessions (id) ON DELETE SET NULL,
  catalog_item_id uuid NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  voided_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_line_voids_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pos_line_voids_outlet_created
  ON public.pos_line_voids (organization_id, outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_line_voids_session
  ON public.pos_line_voids (session_id);

ALTER TABLE public.pos_line_voids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_line_voids_org_select" ON public.pos_line_voids;
CREATE POLICY "pos_line_voids_org_select"
  ON public.pos_line_voids FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_line_voids_org_insert" ON public.pos_line_voids;
CREATE POLICY "pos_line_voids_org_insert"
  ON public.pos_line_voids FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_line_voids IS
  'Cashier product void / qty-reduce events for Pembatalan Produk Bill List tab.';
