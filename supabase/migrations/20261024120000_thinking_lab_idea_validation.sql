-- K1–K7 stays on thinking_lab_ideas. Revisions are new rows.

ALTER TABLE public.thinking_lab_ideas
  ADD COLUMN IF NOT EXISTS parent_idea_id uuid REFERENCES public.thinking_lab_ideas (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation jsonb;

ALTER TABLE public.thinking_lab_ideas
  DROP CONSTRAINT IF EXISTS thinking_lab_ideas_validation_object_check;

ALTER TABLE public.thinking_lab_ideas
  ADD CONSTRAINT thinking_lab_ideas_validation_object_check CHECK (
    validation IS NULL OR jsonb_typeof(validation) = 'object'
  );

CREATE INDEX IF NOT EXISTS thinking_lab_ideas_parent_idea_idx
  ON public.thinking_lab_ideas (parent_idea_id);

COMMENT ON COLUMN public.thinking_lab_ideas.parent_idea_id IS
  'Idea this row revises. The original statement stays on the parent row.';

COMMENT ON COLUMN public.thinking_lab_ideas.validation IS
  'K1–K7 result. LOLOS, DITOLAK, and BELUM TERVERIFIKASI all stay on this table.';

NOTIFY pgrst, 'reload schema';
