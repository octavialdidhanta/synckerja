-- Stock commit point: per-outlet policy + session delta ledger.

CREATE TABLE IF NOT EXISTS public.pos_outlet_stock_settings (
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  stock_commit_point text NOT NULL DEFAULT 'pay'
    CHECK (stock_commit_point IN ('pay', 'kitchen', 'fulfillment')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_outlet_stock_settings_pkey PRIMARY KEY (outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_stock_settings_org
  ON public.pos_outlet_stock_settings (organization_id);

ALTER TABLE public.pos_outlet_stock_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_outlet_stock_settings_org_select" ON public.pos_outlet_stock_settings;
CREATE POLICY "pos_outlet_stock_settings_org_select"
  ON public.pos_outlet_stock_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_stock_settings_org_insert" ON public.pos_outlet_stock_settings;
CREATE POLICY "pos_outlet_stock_settings_org_insert"
  ON public.pos_outlet_stock_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_stock_settings_org_update" ON public.pos_outlet_stock_settings;
CREATE POLICY "pos_outlet_stock_settings_org_update"
  ON public.pos_outlet_stock_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_stock_settings_org_delete" ON public.pos_outlet_stock_settings;
CREATE POLICY "pos_outlet_stock_settings_org_delete"
  ON public.pos_outlet_stock_settings FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_outlet_stock_settings_updated_at ON public.pos_outlet_stock_settings;
CREATE TRIGGER update_pos_outlet_stock_settings_updated_at
  BEFORE UPDATE ON public.pos_outlet_stock_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.pos_outlet_stock_settings IS
  'Per-outlet stock commit timing: pay (default), kitchen (F&B ingredients on order ticket), fulfillment (retail ship).';

CREATE TABLE IF NOT EXISTS public.pos_session_stock_commits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.pos_table_sessions (id) ON DELETE CASCADE,
  line_fingerprint text NOT NULL,
  line_index integer NOT NULL CHECK (line_index > 0),
  committed_qty numeric(14, 3) NOT NULL DEFAULT 0 CHECK (committed_qty >= 0),
  last_reference_id text NOT NULL,
  last_committed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_session_stock_commits_pkey PRIMARY KEY (id),
  CONSTRAINT pos_session_stock_commits_session_line_uniq UNIQUE (session_id, line_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_pos_session_stock_commits_session
  ON public.pos_session_stock_commits (session_id);

CREATE INDEX IF NOT EXISTS idx_pos_session_stock_commits_org_outlet
  ON public.pos_session_stock_commits (organization_id, outlet_id);

ALTER TABLE public.pos_session_stock_commits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_session_stock_commits_org_select" ON public.pos_session_stock_commits;
CREATE POLICY "pos_session_stock_commits_org_select"
  ON public.pos_session_stock_commits FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_session_stock_commits_org_insert" ON public.pos_session_stock_commits;
CREATE POLICY "pos_session_stock_commits_org_insert"
  ON public.pos_session_stock_commits FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_session_stock_commits_org_update" ON public.pos_session_stock_commits;
CREATE POLICY "pos_session_stock_commits_org_update"
  ON public.pos_session_stock_commits FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_session_stock_commits_org_delete" ON public.pos_session_stock_commits;
CREATE POLICY "pos_session_stock_commits_org_delete"
  ON public.pos_session_stock_commits FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_session_stock_commits_updated_at ON public.pos_session_stock_commits;
CREATE TRIGGER update_pos_session_stock_commits_updated_at
  BEFORE UPDATE ON public.pos_session_stock_commits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.pos_session_stock_commits IS
  'Kitchen/fulfillment delta ledger per open bill line fingerprint.';

-- Extend movement types for reservation (Fase B).
ALTER TABLE public.catalog_stock_movements
  DROP CONSTRAINT IF EXISTS catalog_stock_movements_type_check;

ALTER TABLE public.catalog_stock_movements
  ADD CONSTRAINT catalog_stock_movements_type_check CHECK (
    movement_type IN (
      'opening',
      'purchase_order',
      'sale',
      'transfer',
      'adjustment',
      'recipe_consume',
      'production',
      'reserve',
      'release',
      'waste'
    )
  );

-- Reserved qty on catalog outlet junction tables (Fase B ATP).
ALTER TABLE public.catalog_product_outlets
  ADD COLUMN IF NOT EXISTS reserved_qty numeric(14, 3) NOT NULL DEFAULT 0
    CHECK (reserved_qty >= 0);

ALTER TABLE public.catalog_product_variant_outlets
  ADD COLUMN IF NOT EXISTS reserved_qty numeric(14, 3) NOT NULL DEFAULT 0
    CHECK (reserved_qty >= 0);

ALTER TABLE public.catalog_ingredient_outlets
  ADD COLUMN IF NOT EXISTS reserved_qty numeric(14, 3) NOT NULL DEFAULT 0
    CHECK (reserved_qty >= 0);
