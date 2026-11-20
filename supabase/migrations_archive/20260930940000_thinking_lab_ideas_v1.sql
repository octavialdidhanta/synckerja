-- Thinking Lab ideas under one direct Angle.
-- status and semantic_fingerprint are reserved for a later lock.
-- Sibling audit, challenger, fix, and execution are not stored here yet.

ALTER TABLE public.thinking_lab_angles
  DROP CONSTRAINT IF EXISTS thinking_lab_angles_id_org_key;

ALTER TABLE public.thinking_lab_angles
  ADD CONSTRAINT thinking_lab_angles_id_org_key UNIQUE (id, organization_id);

CREATE TABLE IF NOT EXISTS public.thinking_lab_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  angle_id uuid NOT NULL,
  code text NOT NULL,
  statement text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  parent_angle_fingerprint text NOT NULL,
  canonical_semantic jsonb NOT NULL,
  admission text NOT NULL,
  status text NOT NULL DEFAULT 'candidate',
  semantic_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_lab_ideas_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_lab_ideas_statement_check CHECK (char_length(trim(statement)) > 0),
  CONSTRAINT thinking_lab_ideas_fingerprint_check CHECK (char_length(trim(parent_angle_fingerprint)) > 0),
  CONSTRAINT thinking_lab_ideas_admission_check CHECK (
    admission = ANY (ARRAY['GENERATE_VALID'::text, 'GENERATE_REJECT'::text, 'UNRESOLVED'::text])
  ),
  CONSTRAINT thinking_lab_ideas_status_check CHECK (
    status = ANY (ARRAY['candidate'::text, 'locked'::text])
  ),
  CONSTRAINT thinking_lab_ideas_angle_code_key UNIQUE (angle_id, code),
  CONSTRAINT thinking_lab_ideas_angle_same_org_fkey
    FOREIGN KEY (angle_id, organization_id)
    REFERENCES public.thinking_lab_angles (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS thinking_lab_ideas_parent_sort_idx
  ON public.thinking_lab_ideas (angle_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_lab_ideas_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_lab_ideas_updated_at
      BEFORE UPDATE ON public.thinking_lab_ideas
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_lab_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_lab_ideas_member_all
  ON public.thinking_lab_ideas
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_lab_ideas IS
  'Thinking Lab Idea candidates under one direct locked Angle. Includes rejected and unresolved rows.';

COMMENT ON COLUMN public.thinking_lab_ideas.parent_angle_fingerprint IS
  'Fingerprint of the direct Angle at generation time.';

COMMENT ON COLUMN public.thinking_lab_ideas.canonical_semantic IS
  'Sealed Idea facts. relationToParent is derived. creativeMechanism is descriptive.';

COMMENT ON COLUMN public.thinking_lab_ideas.status IS
  'candidate until a later Idea lock. This slice does not lock Ideas.';

NOTIFY pgrst, 'reload schema';
