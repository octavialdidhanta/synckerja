CREATE TABLE IF NOT EXISTS public.thinking_lab_pillar_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  content_pillar_id uuid NOT NULL REFERENCES public.content_pillars (id) ON DELETE CASCADE,
  medium text NOT NULL CHECK (medium IN ('image', 'video')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thinking_lab_pillar_defaults_org_pillar_key UNIQUE (organization_id, content_pillar_id)
);

CREATE INDEX IF NOT EXISTS thinking_lab_pillar_defaults_org_idx
  ON public.thinking_lab_pillar_defaults (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_lab_pillar_defaults_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_lab_pillar_defaults_updated_at
      BEFORE UPDATE ON public.thinking_lab_pillar_defaults
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_lab_pillar_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS thinking_lab_pillar_defaults_member_all ON public.thinking_lab_pillar_defaults;
CREATE POLICY thinking_lab_pillar_defaults_member_all
  ON public.thinking_lab_pillar_defaults
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_lab_pillar_defaults IS
  'Per-organization Image or Video default for a content pillar. Shared default pillars are not edited.';

NOTIFY pgrst, 'reload schema';
