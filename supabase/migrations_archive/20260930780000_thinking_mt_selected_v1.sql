-- Allow Master Thought to be selected (pending final audit) without confirming.

ALTER TABLE public.thinking_master_thoughts
  DROP CONSTRAINT IF EXISTS thinking_master_thoughts_mt_status_check;

ALTER TABLE public.thinking_master_thoughts
  ADD CONSTRAINT thinking_master_thoughts_mt_status_check
  CHECK (
    mt_status = ANY (
      ARRAY[
        'raw'::text,
        'audited_pass'::text,
        'audited_needs_normalization'::text,
        'selected'::text,
        'confirmed'::text,
        'locked'::text
      ]
    )
  );
