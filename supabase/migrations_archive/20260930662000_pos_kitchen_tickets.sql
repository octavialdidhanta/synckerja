-- Kitchen Display tickets (KDS Phase 1): snapshot per "send to kitchen" from Simpan Bill.

CREATE TABLE IF NOT EXISTS public.pos_kitchen_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.pos_table_sessions (id) ON DELETE CASCADE,
  pos_table_id uuid REFERENCES public.pos_tables (id) ON DELETE SET NULL,
  table_name text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_kitchen_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT pos_kitchen_tickets_status_check CHECK (
    status IN ('new', 'in_progress', 'ready', 'done', 'void')
  ),
  CONSTRAINT pos_kitchen_tickets_table_name_check CHECK (btrim(table_name) <> '')
);

CREATE TABLE IF NOT EXISTS public.pos_kitchen_ticket_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.pos_kitchen_tickets (id) ON DELETE CASCADE,
  line_fingerprint text NOT NULL,
  display_name text NOT NULL,
  modifiers_text text,
  quantity integer NOT NULL,
  sort_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_kitchen_ticket_lines_pkey PRIMARY KEY (id),
  CONSTRAINT pos_kitchen_ticket_lines_qty_check CHECK (quantity >= 1),
  CONSTRAINT pos_kitchen_ticket_lines_name_check CHECK (btrim(display_name) <> ''),
  CONSTRAINT pos_kitchen_ticket_lines_fp_check CHECK (btrim(line_fingerprint) <> '')
);

CREATE INDEX IF NOT EXISTS idx_pos_kitchen_tickets_outlet_active
  ON public.pos_kitchen_tickets (outlet_id, status, created_at ASC)
  WHERE status IN ('new', 'in_progress', 'ready');

CREATE INDEX IF NOT EXISTS idx_pos_kitchen_tickets_session
  ON public.pos_kitchen_tickets (session_id);

CREATE INDEX IF NOT EXISTS idx_pos_kitchen_tickets_org_outlet
  ON public.pos_kitchen_tickets (organization_id, outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_kitchen_ticket_lines_ticket
  ON public.pos_kitchen_ticket_lines (ticket_id, sort_index);

DROP TRIGGER IF EXISTS update_pos_kitchen_tickets_updated_at ON public.pos_kitchen_tickets;
CREATE TRIGGER update_pos_kitchen_tickets_updated_at
  BEFORE UPDATE ON public.pos_kitchen_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_kitchen_ticket_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_kitchen_tickets_org_select" ON public.pos_kitchen_tickets;
CREATE POLICY "pos_kitchen_tickets_org_select"
  ON public.pos_kitchen_tickets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_kitchen_tickets_org_insert" ON public.pos_kitchen_tickets;
CREATE POLICY "pos_kitchen_tickets_org_insert"
  ON public.pos_kitchen_tickets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_kitchen_tickets_org_update" ON public.pos_kitchen_tickets;
CREATE POLICY "pos_kitchen_tickets_org_update"
  ON public.pos_kitchen_tickets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_kitchen_tickets_org_delete" ON public.pos_kitchen_tickets;
CREATE POLICY "pos_kitchen_tickets_org_delete"
  ON public.pos_kitchen_tickets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_kitchen_ticket_lines_org_select" ON public.pos_kitchen_ticket_lines;
CREATE POLICY "pos_kitchen_ticket_lines_org_select"
  ON public.pos_kitchen_ticket_lines FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT t.id FROM public.pos_kitchen_tickets t
      WHERE t.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "pos_kitchen_ticket_lines_org_insert" ON public.pos_kitchen_ticket_lines;
CREATE POLICY "pos_kitchen_ticket_lines_org_insert"
  ON public.pos_kitchen_ticket_lines FOR INSERT TO authenticated
  WITH CHECK (
    ticket_id IN (
      SELECT t.id FROM public.pos_kitchen_tickets t
      WHERE t.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "pos_kitchen_ticket_lines_org_update" ON public.pos_kitchen_ticket_lines;
CREATE POLICY "pos_kitchen_ticket_lines_org_update"
  ON public.pos_kitchen_ticket_lines FOR UPDATE TO authenticated
  USING (
    ticket_id IN (
      SELECT t.id FROM public.pos_kitchen_tickets t
      WHERE t.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    ticket_id IN (
      SELECT t.id FROM public.pos_kitchen_tickets t
      WHERE t.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "pos_kitchen_ticket_lines_org_delete" ON public.pos_kitchen_ticket_lines;
CREATE POLICY "pos_kitchen_ticket_lines_org_delete"
  ON public.pos_kitchen_ticket_lines FOR DELETE TO authenticated
  USING (
    ticket_id IN (
      SELECT t.id FROM public.pos_kitchen_tickets t
      WHERE t.organization_id IN (SELECT public.user_organization_ids())
    )
  );

COMMENT ON TABLE public.pos_kitchen_tickets IS
  'KDS tickets created when an open bill is sent to kitchen (Simpan Bill).';
COMMENT ON TABLE public.pos_kitchen_ticket_lines IS
  'Snapshot line items for a kitchen ticket (immutable display text).';

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_kitchen_tickets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
