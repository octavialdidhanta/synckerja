-- One Execution is one locked Idea plus one pillar.
-- The pillar is a format menu, not a semantic tree level.
-- Existing locked rows are not rewritten.

ALTER TABLE public.thinking_lab_ideas
  DROP CONSTRAINT IF EXISTS thinking_lab_ideas_id_org_key;

ALTER TABLE public.thinking_lab_ideas
  ADD CONSTRAINT thinking_lab_ideas_id_org_key UNIQUE (id, organization_id);

CREATE TABLE IF NOT EXISTS public.thinking_lab_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  idea_id uuid NOT NULL,
  pillar text NOT NULL,
  statement text NOT NULL,
  canonical_semantic jsonb NOT NULL,
  admission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_lab_executions_pillar_check CHECK (
    pillar = ANY (ARRAY[
      'B_ROLL_STORYTELLING'::text,
      'BEHIND_THE_SCENE'::text,
      'BACA_KOMEN_HATERS'::text,
      'FLASH_SALE_HOOK'::text
    ])
  ),
  CONSTRAINT thinking_lab_executions_statement_check CHECK (char_length(trim(statement)) > 0),
  CONSTRAINT thinking_lab_executions_admission_check CHECK (
    admission = ANY (ARRAY['GENERATE_VALID'::text, 'GENERATE_REJECT'::text, 'UNRESOLVED'::text])
  ),
  CONSTRAINT thinking_lab_executions_idea_pillar_key UNIQUE (idea_id, pillar),
  CONSTRAINT thinking_lab_executions_idea_same_org_fkey
    FOREIGN KEY (idea_id, organization_id)
    REFERENCES public.thinking_lab_ideas (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS thinking_lab_executions_idea_idx
  ON public.thinking_lab_executions (idea_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_lab_executions_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_lab_executions_updated_at
      BEFORE UPDATE ON public.thinking_lab_executions
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_lab_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_lab_executions_member_all
  ON public.thinking_lab_executions
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_lab_executions IS
  'Thinking Lab content: one locked Idea plus one format pillar. The pillar is not a meaning level.';

NOTIFY pgrst, 'reload schema';
