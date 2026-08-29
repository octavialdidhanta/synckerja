-- Open table sessions (occupied) + sales_activities FK/duration

CREATE TABLE IF NOT EXISTS public.pos_table_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.pos_table_groups (id) ON DELETE CASCADE,
  pos_table_id uuid NOT NULL REFERENCES public.pos_tables (id) ON DELETE CASCADE,
  table_name text NOT NULL,
  pax integer NOT NULL DEFAULT 1,
  seated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  opened_by uuid,
  closed_by uuid,
  sales_activity_id uuid REFERENCES public.sales_activities (id) ON DELETE SET NULL,
  cart_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_table_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT pos_table_sessions_status_check CHECK (status IN ('open', 'paid', 'cancelled')),
  CONSTRAINT pos_table_sessions_pax_check CHECK (pax >= 1 AND pax <= 20),
  CONSTRAINT pos_table_sessions_table_name_check CHECK (btrim(table_name) <> ''),
  CONSTRAINT pos_table_sessions_closed_consistency CHECK (
    (status = 'open' AND closed_at IS NULL)
    OR (status <> 'open' AND closed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_table_sessions_one_open
  ON public.pos_table_sessions (pos_table_id)
  WHERE status = 'open' AND closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_table_sessions_outlet_open
  ON public.pos_table_sessions (organization_id, outlet_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_pos_table_sessions_org_closed
  ON public.pos_table_sessions (organization_id, outlet_id, closed_at DESC)
  WHERE closed_at IS NOT NULL;

DROP TRIGGER IF EXISTS update_pos_table_sessions_updated_at ON public.pos_table_sessions;
CREATE TRIGGER update_pos_table_sessions_updated_at
  BEFORE UPDATE ON public.pos_table_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_table_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_table_sessions_org_select" ON public.pos_table_sessions;
CREATE POLICY "pos_table_sessions_org_select"
  ON public.pos_table_sessions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_table_sessions_org_insert" ON public.pos_table_sessions;
CREATE POLICY "pos_table_sessions_org_insert"
  ON public.pos_table_sessions FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_table_sessions_org_update" ON public.pos_table_sessions;
CREATE POLICY "pos_table_sessions_org_update"
  ON public.pos_table_sessions FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_table_sessions_org_delete" ON public.pos_table_sessions;
CREATE POLICY "pos_table_sessions_org_delete"
  ON public.pos_table_sessions FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS pos_table_id uuid NULL REFERENCES public.pos_tables (id) ON DELETE SET NULL;

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS table_duration_minutes integer NULL;

ALTER TABLE public.sales_activities
  DROP CONSTRAINT IF EXISTS sales_activities_table_duration_minutes_check;

ALTER TABLE public.sales_activities
  ADD CONSTRAINT sales_activities_table_duration_minutes_check CHECK (
    table_duration_minutes IS NULL OR table_duration_minutes >= 0
  );

CREATE INDEX IF NOT EXISTS idx_sales_activities_pos_table_id
  ON public.sales_activities (organization_id, pos_table_id)
  WHERE pos_table_id IS NOT NULL;

COMMENT ON TABLE public.pos_table_sessions IS
  'Open/closed dine-in table sessions for POS occupancy and turnover.';
COMMENT ON COLUMN public.sales_activities.pos_table_id IS
  'Optional FK to pos_tables when checkout was tied to a floor-plan table.';
COMMENT ON COLUMN public.sales_activities.table_duration_minutes IS
  'Minutes seated from session open to pay/close.';

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_table_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
