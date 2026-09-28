-- Persist level-specific Territory canonical semantic facts with the Territory row.
-- Lookup is by semantic_fingerprint (node content + parent Big Thought fingerprint).
-- Stale facts must not be reused. Audit copies are projections, not another SOT.

ALTER TABLE public.thinking_territories
  ADD COLUMN IF NOT EXISTS canonical_semantic jsonb NULL,
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text NULL;

COMMENT ON COLUMN public.thinking_territories.canonical_semantic IS
  'Authoritative Territory-specific canonical semantic facts for the exact node represented by semantic_fingerprint. Audit copies are projections, not another semantic source of truth.';

COMMENT ON COLUMN public.thinking_territories.semantic_fingerprint IS
  'Fingerprint of this Territory''s semantic input plus required parent Big Thought semantic fingerprint. Facts are reusable only while this fingerprint matches.';

NOTIFY pgrst, 'reload schema';
