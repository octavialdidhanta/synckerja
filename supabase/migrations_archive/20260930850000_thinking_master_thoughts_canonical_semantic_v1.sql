-- Persist canonical semantic facts for the Master Thought row.
-- Lookup is by semantic_fingerprint (statement + root belief). Stale facts must not be reused.
-- Audit copies are projections, not another semantic source of truth.

ALTER TABLE public.thinking_master_thoughts
  ADD COLUMN IF NOT EXISTS canonical_semantic jsonb NULL,
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text NULL;

COMMENT ON COLUMN public.thinking_master_thoughts.canonical_semantic IS
  'Authoritative canonical semantic facts for the exact Master Thought represented by semantic_fingerprint. Audit copies are projections, not another semantic source of truth.';

COMMENT ON COLUMN public.thinking_master_thoughts.semantic_fingerprint IS
  'Fingerprint of the Master Thought semantic input used when canonical_semantic was produced. Facts are reusable only while this fingerprint matches the current Master Thought.';

NOTIFY pgrst, 'reload schema';
