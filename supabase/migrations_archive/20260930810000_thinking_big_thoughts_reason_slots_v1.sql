-- Big Thought reason-slot / function / claim classification at generate time
-- (audit still stores structured fields on thinking_master_thoughts.last_audit).

ALTER TABLE public.thinking_big_thoughts
  ADD COLUMN IF NOT EXISTS reason_slot_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reason_slot_explanation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS function_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS claim_type text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.thinking_big_thoughts.reason_slot_label IS
  '2–5 word Title-Case identity of the fundamental WHY this Big Thought occupies.';

COMMENT ON COLUMN public.thinking_big_thoughts.reason_slot_explanation IS
  'One-sentence explanation of why this reason slot is material to the Master Thought.';

COMMENT ON COLUMN public.thinking_big_thoughts.function_type IS
  'Generate-time function classification (FOUNDATIONAL_REASON, PRINCIPLE, …).';

COMMENT ON COLUMN public.thinking_big_thoughts.claim_type IS
  'Generate-time claim type (CONCEPTUAL_STRATEGIC, CAUSAL, …).';

NOTIFY pgrst, 'reload schema';
