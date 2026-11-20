-- Persist level-specific Angle canonical semantic facts with the Angle row.
-- Lookup is by semantic_fingerprint (node content + parent Territory fingerprint).
-- Stale facts must not be reused. Audit copies are projections, not another SOT.

ALTER TABLE public.thinking_angles
  ADD COLUMN IF NOT EXISTS canonical_semantic jsonb NULL,
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text NULL;

COMMENT ON COLUMN public.thinking_angles.canonical_semantic IS
  'Authoritative Angle-specific canonical semantic facts for the exact node represented by semantic_fingerprint. Audit copies are projections, not another semantic source of truth.';

COMMENT ON COLUMN public.thinking_angles.semantic_fingerprint IS
  'Fingerprint of this Angle''s semantic input plus required parent Territory semantic fingerprint. Facts are reusable only while this fingerprint matches.';

NOTIFY pgrst, 'reload schema';
