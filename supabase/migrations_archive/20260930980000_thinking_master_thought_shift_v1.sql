-- Prior belief and optional audience are context for a new Master Thought.
-- Existing locked rows are not rewritten.

ALTER TABLE public.thinking_master_thoughts
  ADD COLUMN IF NOT EXISTS prior_belief text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.thinking_master_thoughts.prior_belief IS
  'Audience belief being displaced. Context only. Empty on rows created before this column.';

COMMENT ON COLUMN public.thinking_master_thoughts.audience IS
  'Optional audience the planted belief addresses. Context only. Empty when unset.';

NOTIFY pgrst, 'reload schema';
