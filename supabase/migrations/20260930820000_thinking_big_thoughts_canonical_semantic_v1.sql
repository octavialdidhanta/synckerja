-- Persist canonical LLM semantic facts with the Big Thought row.
-- Lookup is by semantic_fingerprint (current text). Stale facts must not be reused.

ALTER TABLE public.thinking_big_thoughts
  ADD COLUMN IF NOT EXISTS canonical_semantic jsonb NULL,
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text NULL;

COMMENT ON COLUMN public.thinking_big_thoughts.canonical_semantic IS
  'BtCanonicalSemanticFacts for this candidate text. Authoritative meaning after Generate/Audit/Fix/Challenger.';

COMMENT ON COLUMN public.thinking_big_thoughts.semantic_fingerprint IS
  'Fingerprint of title/statement/meaning/core/ownership/boundary when canonical_semantic was written.';

NOTIFY pgrst, 'reload schema';
