-- Walk-in open bills (nullable table/group) + assigned waiter

ALTER TABLE public.pos_table_sessions
  ALTER COLUMN pos_table_id DROP NOT NULL,
  ALTER COLUMN group_id DROP NOT NULL;

ALTER TABLE public.pos_table_sessions
  ADD COLUMN IF NOT EXISTS waiter_id uuid;

COMMENT ON COLUMN public.pos_table_sessions.waiter_id IS
  'Assigned waiter for the open bill (usually shift opener); display in Bill List.';

-- Recreate unique open-per-table only when a real table is assigned
DROP INDEX IF EXISTS public.uq_pos_table_sessions_one_open;
CREATE UNIQUE INDEX uq_pos_table_sessions_one_open
  ON public.pos_table_sessions (pos_table_id)
  WHERE status = 'open' AND closed_at IS NULL AND pos_table_id IS NOT NULL;
