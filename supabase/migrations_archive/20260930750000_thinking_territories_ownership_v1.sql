-- Territory ownership column for conversation-space ownership labels.

ALTER TABLE public.thinking_territories
  ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.thinking_territories.ownership IS
  'Short conceptual ownership label: what conversation space this Territory uniquely owns.';
