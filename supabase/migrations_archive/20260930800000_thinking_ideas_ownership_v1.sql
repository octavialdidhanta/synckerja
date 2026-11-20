-- Idea ownership slot: short Title-Case label that differentiates sibling Ideas
-- and Ideas belonging to sibling Angles.

ALTER TABLE public.thinking_ideas
  ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.thinking_ideas.ownership IS
  'Short ownership-slot label (2–5 words) that distinguishes this Idea from siblings under the same Angle and from Ideas under sibling Angles.';

NOTIFY pgrst, 'reload schema';
