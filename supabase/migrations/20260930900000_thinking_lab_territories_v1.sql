-- Thinking Lab territories under one direct Big Thought.
-- Separate from the legacy thinking_territories pipeline.

CREATE TABLE IF NOT EXISTS public.thinking_lab_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  big_thought_id uuid NOT NULL,
  code text NOT NULL,
  statement text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  canonical_semantic jsonb NOT NULL,
  admission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_lab_territories_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_lab_territories_statement_check CHECK (char_length(trim(statement)) > 0),
  CONSTRAINT thinking_lab_territories_admission_check CHECK (
    admission = ANY (ARRAY['GENERATE_VALID'::text, 'GENERATE_REJECT'::text, 'UNRESOLVED'::text])
  ),
  CONSTRAINT thinking_lab_territories_big_thought_code_key UNIQUE (big_thought_id, code),
  CONSTRAINT thinking_lab_territories_big_thought_same_org_fkey
    FOREIGN KEY (big_thought_id, organization_id)
    REFERENCES public.thinking_big_thoughts (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS thinking_lab_territories_parent_sort_idx
  ON public.thinking_lab_territories (big_thought_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_lab_territories_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_lab_territories_updated_at
      BEFORE UPDATE ON public.thinking_lab_territories
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_lab_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_lab_territories_member_all
  ON public.thinking_lab_territories
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_lab_territories IS
  'Thinking Lab Territory candidates under one direct locked Big Thought.';
