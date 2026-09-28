-- Angle set conclusions live on the parent Territory.
-- Angle lock uses the existing status and semantic_fingerprint columns.

ALTER TABLE public.thinking_lab_territories
  ADD COLUMN IF NOT EXISTS angle_set jsonb;

COMMENT ON COLUMN public.thinking_lab_territories.angle_set IS
  'Thinking Lab angle sibling audit, audit verdicts, and challenger for this Territory.';

NOTIFY pgrst, 'reload schema';
