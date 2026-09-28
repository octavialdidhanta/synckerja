-- Angle ownership slot: short Title-Case label that differentiates sibling Angles.

ALTER TABLE public.thinking_angles
  ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.thinking_angles.ownership IS
  'Short ownership-slot label (2–5 words) that distinguishes this Angle from siblings.';
