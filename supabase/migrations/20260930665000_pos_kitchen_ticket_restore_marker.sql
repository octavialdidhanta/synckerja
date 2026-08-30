-- KDS: show Recalled / Reverted badge after restoring a done ticket.

ALTER TABLE public.pos_kitchen_tickets
  ADD COLUMN IF NOT EXISTS restore_marker text;

ALTER TABLE public.pos_kitchen_tickets
  DROP CONSTRAINT IF EXISTS pos_kitchen_tickets_restore_marker_check;
ALTER TABLE public.pos_kitchen_tickets
  ADD CONSTRAINT pos_kitchen_tickets_restore_marker_check
  CHECK (restore_marker IS NULL OR restore_marker IN ('recalled', 'reverted'));

COMMENT ON COLUMN public.pos_kitchen_tickets.restore_marker IS
  'Set when ticket is restored from done: recalled (yellow) or reverted (red). Cleared when completed again.';
