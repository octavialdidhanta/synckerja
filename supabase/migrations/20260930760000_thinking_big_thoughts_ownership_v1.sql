-- Big Thought ownership + meaning for distinct supporting-reason slots under Master Thought.

ALTER TABLE public.thinking_big_thoughts
  ADD COLUMN IF NOT EXISTS meaning text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ownership_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ownership_statement text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.thinking_big_thoughts.meaning IS
  'Short explanation of what the Big Thought means in context of the Master Thought.';

COMMENT ON COLUMN public.thinking_big_thoughts.ownership_label IS
  'Short semantic label for the unique supporting-reason slot this BT owns.';

COMMENT ON COLUMN public.thinking_big_thoughts.ownership_statement IS
  'One-sentence exclusive role this BT contributes toward proving the Master Thought.';
