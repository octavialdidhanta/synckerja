-- One Execution can use any organization content pillar and store a voice-over script.
-- Older rows keep their enum pillar and a plain statement.

ALTER TABLE public.thinking_lab_executions
  DROP CONSTRAINT IF EXISTS thinking_lab_executions_pillar_check;

ALTER TABLE public.thinking_lab_executions
  ADD COLUMN IF NOT EXISTS content_pillar_id uuid REFERENCES public.content_pillars (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pillar_name text,
  ADD COLUMN IF NOT EXISTS script jsonb;

UPDATE public.thinking_lab_executions
SET pillar_name = CASE pillar
  WHEN 'B_ROLL_STORYTELLING' THEN 'B-Roll Storytelling'
  WHEN 'BEHIND_THE_SCENE' THEN 'Behind The Scene'
  WHEN 'BACA_KOMEN_HATERS' THEN 'Baca Komen Haters'
  WHEN 'FLASH_SALE_HOOK' THEN 'Flash Sale Hook'
  ELSE pillar
END
WHERE pillar_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_idea_content_pillar_key
  ON public.thinking_lab_executions (idea_id, content_pillar_id)
  WHERE content_pillar_id IS NOT NULL;

COMMENT ON COLUMN public.thinking_lab_executions.script IS
  'Structured voice-over script: assets, scenes, shots, and narration lines that failed the Idea message.';

NOTIFY pgrst, 'reload schema';
