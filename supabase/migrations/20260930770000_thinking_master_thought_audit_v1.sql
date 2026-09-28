-- Dedicated Master Thought audit layer (separate from Big Thought last_audit).

ALTER TABLE public.thinking_master_thoughts
  ADD COLUMN IF NOT EXISTS original_input text,
  ADD COLUMN IF NOT EXISTS mt_status text NOT NULL DEFAULT 'raw',
  ADD COLUMN IF NOT EXISTS mt_audit jsonb NULL,
  ADD COLUMN IF NOT EXISTS root_belief text NULL,
  ADD COLUMN IF NOT EXISTS intent_preservation_notes text NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS confirmation_source text NULL;

UPDATE public.thinking_master_thoughts
SET original_input = statement
WHERE original_input IS NULL OR btrim(original_input) = '';

ALTER TABLE public.thinking_master_thoughts
  ALTER COLUMN original_input SET NOT NULL;

UPDATE public.thinking_master_thoughts AS m
SET
  mt_status = CASE
    WHEN m.status = 'locked' THEN 'locked'
    WHEN EXISTS (
      SELECT 1
      FROM public.thinking_big_thoughts bt
      WHERE bt.master_thought_id = m.id
        AND bt.status <> 'rejected'
    ) THEN 'confirmed'
    ELSE 'raw'
  END,
  confirmed_at = CASE
    WHEN m.status = 'locked'
      OR EXISTS (
        SELECT 1
        FROM public.thinking_big_thoughts bt
        WHERE bt.master_thought_id = m.id
          AND bt.status <> 'rejected'
      )
    THEN coalesce(m.confirmed_at, m.updated_at)
    ELSE m.confirmed_at
  END,
  confirmation_source = CASE
    WHEN m.status = 'locked'
      OR EXISTS (
        SELECT 1
        FROM public.thinking_big_thoughts bt
        WHERE bt.master_thought_id = m.id
          AND bt.status <> 'rejected'
      )
    THEN coalesce(m.confirmation_source, 'original')
    ELSE m.confirmation_source
  END
WHERE m.mt_status = 'raw';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'thinking_master_thoughts_mt_status_check'
  ) THEN
    ALTER TABLE public.thinking_master_thoughts
      ADD CONSTRAINT thinking_master_thoughts_mt_status_check
      CHECK (
        mt_status = ANY (
          ARRAY[
            'raw'::text,
            'audited_pass'::text,
            'audited_needs_normalization'::text,
            'confirmed'::text,
            'locked'::text
          ]
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'thinking_master_thoughts_confirmation_source_check'
  ) THEN
    ALTER TABLE public.thinking_master_thoughts
      ADD CONSTRAINT thinking_master_thoughts_confirmation_source_check
      CHECK (
        confirmation_source IS NULL
        OR confirmation_source = ANY (
          ARRAY['original'::text, 'recommendation'::text, 'edited'::text]
        )
      );
  END IF;
END;
$$;
