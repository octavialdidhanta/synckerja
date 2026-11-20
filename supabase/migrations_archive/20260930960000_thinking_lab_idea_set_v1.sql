-- Idea sibling audit and down-top results live on the parent Angle.
-- Idea lock uses the existing status and semantic_fingerprint columns.
-- Locked rows are not rewritten.

ALTER TABLE public.thinking_lab_angles
  ADD COLUMN IF NOT EXISTS idea_set jsonb;

COMMENT ON COLUMN public.thinking_lab_angles.idea_set IS
  'Thinking Lab idea sibling audit and down-top test for this Angle.';

NOTIFY pgrst, 'reload schema';
