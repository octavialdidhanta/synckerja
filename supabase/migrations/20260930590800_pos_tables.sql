-- Physical tables on a table-group floor map

CREATE TABLE IF NOT EXISTS public.pos_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.pos_table_groups (id) ON DELETE CASCADE,
  name text NOT NULL,
  shape text NOT NULL,
  pax integer NOT NULL DEFAULT 2,
  grid_x integer NOT NULL DEFAULT 0,
  grid_y integer NOT NULL DEFAULT 0,
  grid_w integer NOT NULL DEFAULT 1,
  grid_h integer NOT NULL DEFAULT 1,
  rotation integer NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_tables_pkey PRIMARY KEY (id),
  CONSTRAINT pos_tables_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT pos_tables_shape_check CHECK (shape IN ('circle', 'square', 'rectangle', 'one_sided')),
  CONSTRAINT pos_tables_pax_check CHECK (pax >= 1 AND pax <= 20),
  CONSTRAINT pos_tables_grid_check CHECK (grid_w >= 1 AND grid_h >= 1 AND grid_x >= 0 AND grid_y >= 0),
  CONSTRAINT pos_tables_rotation_check CHECK (rotation IN (0, 90, 180, 270))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_tables_group_name
  ON public.pos_tables (group_id, lower(btrim(name)))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_pos_tables_group
  ON public.pos_tables (group_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_pos_tables_org_outlet
  ON public.pos_tables (organization_id, outlet_id)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS update_pos_tables_updated_at ON public.pos_tables;
CREATE TRIGGER update_pos_tables_updated_at
  BEFORE UPDATE ON public.pos_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_tables_org_select" ON public.pos_tables;
CREATE POLICY "pos_tables_org_select"
  ON public.pos_tables FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_tables_org_insert" ON public.pos_tables;
CREATE POLICY "pos_tables_org_insert"
  ON public.pos_tables FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_tables_org_update" ON public.pos_tables;
CREATE POLICY "pos_tables_org_update"
  ON public.pos_tables FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_tables_org_delete" ON public.pos_tables;
CREATE POLICY "pos_tables_org_delete"
  ON public.pos_tables FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
