-- KDS card UX: line checklist + hold/pause for SLA timer.

ALTER TABLE public.pos_kitchen_ticket_lines
  ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;

ALTER TABLE public.pos_kitchen_tickets
  ADD COLUMN IF NOT EXISTS is_held boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS held_at timestamptz,
  ADD COLUMN IF NOT EXISTS pause_ms integer NOT NULL DEFAULT 0;

ALTER TABLE public.pos_kitchen_tickets
  DROP CONSTRAINT IF EXISTS pos_kitchen_tickets_pause_ms_check;
ALTER TABLE public.pos_kitchen_tickets
  ADD CONSTRAINT pos_kitchen_tickets_pause_ms_check CHECK (pause_ms >= 0);

COMMENT ON COLUMN public.pos_kitchen_ticket_lines.is_done IS
  'Kitchen checklist: item prepared (strikethrough on KDS card).';
COMMENT ON COLUMN public.pos_kitchen_tickets.is_held IS
  'When true, SLA timer is paused (Hold).';
COMMENT ON COLUMN public.pos_kitchen_tickets.held_at IS
  'Timestamp when current hold started; null when not held.';
COMMENT ON COLUMN public.pos_kitchen_tickets.pause_ms IS
  'Accumulated SLA pause milliseconds from prior holds.';
