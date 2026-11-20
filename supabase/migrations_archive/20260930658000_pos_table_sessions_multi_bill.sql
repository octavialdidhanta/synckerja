-- Allow multiple open bills per table (shared soft capacity enforced in app via pax sum).
DROP INDEX IF EXISTS public.uq_pos_table_sessions_one_open;

CREATE INDEX IF NOT EXISTS idx_pos_table_sessions_open_by_table
  ON public.pos_table_sessions (organization_id, outlet_id, pos_table_id)
  WHERE status = 'open' AND closed_at IS NULL AND pos_table_id IS NOT NULL;

COMMENT ON TABLE public.pos_table_sessions IS
  'POS dine-in / walk-in open bills. Multiple open rows per pos_table_id are allowed; capacity is enforced in the app as sum(open.pax) <= table.pax.';
