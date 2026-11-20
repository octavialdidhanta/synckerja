-- Thinking Lab angles under one direct Territory.
-- Separate from the legacy thinking_angles pipeline.
-- status and semantic_fingerprint are reserved for a later lock.
-- Sibling audit, challenger, fix, and certification are not stored here yet.

ALTER TABLE public.thinking_lab_territories
  DROP CONSTRAINT IF EXISTS thinking_lab_territories_id_org_key;

ALTER TABLE public.thinking_lab_territories
  ADD CONSTRAINT thinking_lab_territories_id_org_key UNIQUE (id, organization_id);

CREATE TABLE IF NOT EXISTS public.thinking_lab_angles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  territory_id uuid NOT NULL,
  code text NOT NULL,
  statement text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  parent_territory_fingerprint text NOT NULL,
  canonical_semantic jsonb NOT NULL,
  admission text NOT NULL,
  status text NOT NULL DEFAULT 'candidate',
  semantic_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_lab_angles_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_lab_angles_statement_check CHECK (char_length(trim(statement)) > 0),
  CONSTRAINT thinking_lab_angles_fingerprint_check CHECK (char_length(trim(parent_territory_fingerprint)) > 0),
  CONSTRAINT thinking_lab_angles_admission_check CHECK (
    admission = ANY (ARRAY['GENERATE_VALID'::text, 'GENERATE_REJECT'::text, 'UNRESOLVED'::text])
  ),
  CONSTRAINT thinking_lab_angles_status_check CHECK (
    status = ANY (ARRAY['candidate'::text, 'locked'::text])
  ),
  CONSTRAINT thinking_lab_angles_territory_code_key UNIQUE (territory_id, code),
  CONSTRAINT thinking_lab_angles_territory_same_org_fkey
    FOREIGN KEY (territory_id, organization_id)
    REFERENCES public.thinking_lab_territories (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS thinking_lab_angles_parent_sort_idx
  ON public.thinking_lab_angles (territory_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_lab_angles_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_lab_angles_updated_at
      BEFORE UPDATE ON public.thinking_lab_angles
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_lab_angles ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_lab_angles_member_all
  ON public.thinking_lab_angles
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_lab_angles IS
  'Thinking Lab Angle candidates under one direct locked Territory. Includes rejected and unresolved rows.';

COMMENT ON COLUMN public.thinking_lab_angles.parent_territory_fingerprint IS
  'Fingerprint of the direct Territory at generation time.';

COMMENT ON COLUMN public.thinking_lab_angles.canonical_semantic IS
  'Sealed Angle facts. ideaGenerativity is owned by the generativity review. relationToParent is derived.';

COMMENT ON COLUMN public.thinking_lab_angles.status IS
  'candidate until a later Angle lock. This slice does not lock Angles.';

NOTIFY pgrst, 'reload schema';
