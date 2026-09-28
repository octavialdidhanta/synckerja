-- Persist level-specific Idea canonical semantic facts with the Idea row.
-- Lookup is by semantic_fingerprint (node content + parent Angle fingerprint).
-- Stale facts must not be reused. Audit copies are projections, not another SOT.
-- Timestamp 20260930860000 avoids colliding with Master Thought canonical_semantic v1 (20260930850000).

ALTER TABLE public.thinking_ideas
  ADD COLUMN IF NOT EXISTS canonical_semantic jsonb NULL,
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text NULL;

COMMENT ON COLUMN public.thinking_ideas.canonical_semantic IS
  'Authoritative Idea-specific canonical semantic facts for the exact node represented by semantic_fingerprint. Audit copies are projections, not another semantic source of truth.';

COMMENT ON COLUMN public.thinking_ideas.semantic_fingerprint IS
  'Fingerprint of this Idea''s semantic input plus required parent Angle semantic fingerprint. Facts are reusable only while this fingerprint matches.';

NOTIFY pgrst, 'reload schema';
