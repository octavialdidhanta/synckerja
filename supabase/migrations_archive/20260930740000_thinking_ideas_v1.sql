-- Thinking Ideas V1: under locked Angles (org-scoped). Direct parent = angle_id only.

CREATE TABLE IF NOT EXISTS public.thinking_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  angle_id uuid NOT NULL REFERENCES public.thinking_angles (id) ON DELETE CASCADE,
  code text NOT NULL,
  statement text NOT NULL,
  core_concept text NOT NULL DEFAULT '',
  conceptual_device text NOT NULL DEFAULT '',
  why_angle_visible text NOT NULL DEFAULT '',
  boundary text NOT NULL DEFAULT '',
  evidence_state text NOT NULL DEFAULT 'not_required',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate',
  last_audit jsonb NULL,
  generation_batch_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_ideas_status_check CHECK (
    status = ANY (ARRAY['candidate'::text, 'locked'::text, 'rejected'::text])
  ),
  CONSTRAINT thinking_ideas_evidence_check CHECK (
    evidence_state = ANY (
      ARRAY[
        'known'::text,
        'unknown'::text,
        'conditional'::text,
        'not_required'::text,
        'park'::text
      ]
    )
  ),
  CONSTRAINT thinking_ideas_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_ideas_statement_check CHECK (char_length(trim(statement)) > 0),
  CONSTRAINT thinking_ideas_org_angle_code_key UNIQUE (organization_id, angle_id, code)
);

CREATE INDEX thinking_ideas_angle_sort_idx
  ON public.thinking_ideas (angle_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_ideas_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_ideas_updated_at
      BEFORE UPDATE ON public.thinking_ideas
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_ideas_member_all
  ON public.thinking_ideas
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_ideas IS
  'Idea communication-concept candidates/locks under an Angle. Parent = angle_id; T/BT/MT via lineage.';
