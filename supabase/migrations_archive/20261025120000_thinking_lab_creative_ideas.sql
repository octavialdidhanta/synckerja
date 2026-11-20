-- Creative Ideas hang from a Conceptual Idea. Existing executions stay valid with a null link.

CREATE TABLE IF NOT EXISTS public.thinking_lab_creative_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  idea_id uuid NOT NULL,
  content_pillar_id uuid NOT NULL REFERENCES public.content_pillars (id) ON DELETE RESTRICT,
  format text NOT NULL,
  code text NOT NULL,
  title text NOT NULL DEFAULT '',
  statement text NOT NULL,
  concept text NOT NULL DEFAULT '',
  mechanism text NOT NULL DEFAULT '',
  value text NOT NULL DEFAULT '',
  validation jsonb,
  status text NOT NULL DEFAULT 'candidate',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_lab_creative_ideas_format_check
    CHECK (format = ANY (ARRAY['video'::text, 'carousel'::text, 'post'::text])),
  CONSTRAINT thinking_lab_creative_ideas_status_check
    CHECK (status = ANY (ARRAY['candidate'::text, 'selected'::text])),
  CONSTRAINT thinking_lab_creative_ideas_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_lab_creative_ideas_statement_check CHECK (char_length(trim(statement)) > 0),
  CONSTRAINT thinking_lab_creative_ideas_validation_object_check
    CHECK (validation IS NULL OR jsonb_typeof(validation) = 'object'),
  CONSTRAINT thinking_lab_creative_ideas_idea_org_fkey
    FOREIGN KEY (idea_id, organization_id)
    REFERENCES public.thinking_lab_ideas (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT thinking_lab_creative_ideas_id_parent_format_key
    UNIQUE (id, idea_id, organization_id, format),
  CONSTRAINT thinking_lab_creative_ideas_idea_code_key UNIQUE (idea_id, code)
);

CREATE INDEX IF NOT EXISTS thinking_lab_creative_ideas_parent_idx
  ON public.thinking_lab_creative_ideas (idea_id, content_pillar_id, format);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_lab_creative_ideas_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_lab_creative_ideas_updated_at
      BEFORE UPDATE ON public.thinking_lab_creative_ideas
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_lab_ideas
  ADD COLUMN IF NOT EXISTS development_paths jsonb;

ALTER TABLE public.thinking_lab_ideas
  DROP CONSTRAINT IF EXISTS thinking_lab_ideas_development_paths_array_check;

ALTER TABLE public.thinking_lab_ideas
  ADD CONSTRAINT thinking_lab_ideas_development_paths_array_check
  CHECK (development_paths IS NULL OR jsonb_typeof(development_paths) = 'array');

ALTER TABLE public.thinking_lab_executions
  ADD COLUMN IF NOT EXISTS creative_idea_id uuid,
  ADD COLUMN IF NOT EXISTS format text;

ALTER TABLE public.thinking_lab_executions
  DROP CONSTRAINT IF EXISTS thinking_lab_executions_format_check;

ALTER TABLE public.thinking_lab_executions
  ADD CONSTRAINT thinking_lab_executions_format_check
  CHECK (format IS NULL OR format = ANY (ARRAY['video'::text, 'carousel'::text, 'post'::text]));

ALTER TABLE public.thinking_lab_executions
  DROP CONSTRAINT IF EXISTS thinking_lab_executions_creative_pair_check;

ALTER TABLE public.thinking_lab_executions
  ADD CONSTRAINT thinking_lab_executions_creative_pair_check
  CHECK (
    (creative_idea_id IS NULL AND format IS NULL)
    OR (creative_idea_id IS NOT NULL AND format IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_pillar_key
  ON public.thinking_lab_executions (idea_id, pillar)
  WHERE creative_idea_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_content_pillar_key
  ON public.thinking_lab_executions (idea_id, content_pillar_id)
  WHERE creative_idea_id IS NULL AND content_pillar_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.thinking_lab_executions
    GROUP BY idea_id, pillar
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate execution idea and pillar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.thinking_lab_executions
    WHERE content_pillar_id IS NOT NULL
    GROUP BY idea_id, content_pillar_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate execution idea and content pillar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.thinking_lab_executions e
    LEFT JOIN public.thinking_lab_ideas i
      ON i.id = e.idea_id AND i.organization_id = e.organization_id
    WHERE i.id IS NULL
  ) THEN
    RAISE EXCEPTION 'orphan execution';
  END IF;
END;
$$;

ALTER TABLE public.thinking_lab_executions
  DROP CONSTRAINT IF EXISTS thinking_lab_executions_idea_pillar_key;

DROP INDEX IF EXISTS public.thinking_lab_executions_idea_content_pillar_key;

ALTER TABLE public.thinking_lab_executions
  DROP CONSTRAINT IF EXISTS thinking_lab_executions_creative_same_parent_fkey;

ALTER TABLE public.thinking_lab_executions
  ADD CONSTRAINT thinking_lab_executions_creative_same_parent_fkey
  FOREIGN KEY (creative_idea_id, idea_id, organization_id, format)
  REFERENCES public.thinking_lab_creative_ideas (id, idea_id, organization_id, format)
  ON DELETE CASCADE;

ALTER TABLE public.thinking_lab_creative_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS thinking_lab_creative_ideas_member_all ON public.thinking_lab_creative_ideas;
CREATE POLICY thinking_lab_creative_ideas_member_all
  ON public.thinking_lab_creative_ideas
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_lab_creative_ideas IS
  'Creative ideas under one conceptual idea, pillar, and format. Their validation does not change the parent idea.';

COMMENT ON COLUMN public.thinking_lab_ideas.development_paths IS
  'Saved pillar and format paths. Each path is identified by contentPillarId and format.';

COMMENT ON COLUMN public.thinking_lab_executions.creative_idea_id IS
  'Optional creative idea. Null on executions created before this link existed.';

NOTIFY pgrst, 'reload schema';
