-- Floor fixtures (Kasir, Tangga, Pintu, …) on a table-group floor map.
-- Separate from pos_tables so fixtures never join sessions / orders.

CREATE TABLE IF NOT EXISTS public.pos_floor_fixtures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.pos_table_groups (id) ON DELETE CASCADE,
  fixture_type text NOT NULL,
  name text NOT NULL,
  grid_x integer NOT NULL DEFAULT 0,
  grid_y integer NOT NULL DEFAULT 0,
  grid_w integer NOT NULL DEFAULT 1,
  grid_h integer NOT NULL DEFAULT 1,
  rotation integer NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_floor_fixtures_pkey PRIMARY KEY (id),
  CONSTRAINT pos_floor_fixtures_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT pos_floor_fixtures_type_check CHECK (
    fixture_type IN (
      'cashier',
      'stairs',
      'door',
      'kitchen',
      'washbasin',
      'kiosk',
      'parking'
    )
  ),
  CONSTRAINT pos_floor_fixtures_grid_check CHECK (
    grid_w >= 1 AND grid_h >= 1 AND grid_x >= 0 AND grid_y >= 0
  ),
  CONSTRAINT pos_floor_fixtures_rotation_check CHECK (rotation IN (0, 90, 180, 270))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_floor_fixtures_group_name
  ON public.pos_floor_fixtures (group_id, lower(btrim(name)))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_pos_floor_fixtures_group
  ON public.pos_floor_fixtures (group_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_pos_floor_fixtures_org_outlet
  ON public.pos_floor_fixtures (organization_id, outlet_id)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS update_pos_floor_fixtures_updated_at ON public.pos_floor_fixtures;
CREATE TRIGGER update_pos_floor_fixtures_updated_at
  BEFORE UPDATE ON public.pos_floor_fixtures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_floor_fixtures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_floor_fixtures_org_select" ON public.pos_floor_fixtures;
CREATE POLICY "pos_floor_fixtures_org_select"
  ON public.pos_floor_fixtures FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_floor_fixtures_org_insert" ON public.pos_floor_fixtures;
CREATE POLICY "pos_floor_fixtures_org_insert"
  ON public.pos_floor_fixtures FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_floor_fixtures_org_update" ON public.pos_floor_fixtures;
CREATE POLICY "pos_floor_fixtures_org_update"
  ON public.pos_floor_fixtures FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_floor_fixtures_org_delete" ON public.pos_floor_fixtures;
CREATE POLICY "pos_floor_fixtures_org_delete"
  ON public.pos_floor_fixtures FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_floor_fixtures IS
  'Non-table floor landmarks on a POS table-group map (cashier, door, kitchen, …).';
