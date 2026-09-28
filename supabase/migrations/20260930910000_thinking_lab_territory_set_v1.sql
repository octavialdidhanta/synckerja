-- Territory set conclusions live on the parent Big Thought.
-- Territory lock is a row status plus the fingerprint of the locked statement.

ALTER TABLE public.thinking_big_thoughts
  ADD COLUMN IF NOT EXISTS territory_set jsonb;

COMMENT ON COLUMN public.thinking_big_thoughts.territory_set IS
  'Thinking Lab territory sibling audit, audit verdicts, and challenger for this Big Thought.';

ALTER TABLE public.thinking_lab_territories
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text;

ALTER TABLE public.thinking_lab_territories
  DROP CONSTRAINT IF EXISTS thinking_lab_territories_status_check;

ALTER TABLE public.thinking_lab_territories
  ADD CONSTRAINT thinking_lab_territories_status_check
  CHECK (status = ANY (ARRAY['candidate'::text, 'locked'::text]));

COMMENT ON COLUMN public.thinking_lab_territories.status IS
  'candidate until the admitted set passes audit, challenger, and lock.';
