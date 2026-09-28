-- Thinking Angles V1: under locked Territories (org-scoped). Direct parent = territory_id only.

CREATE TABLE IF NOT EXISTS public.thinking_angles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  territory_id uuid NOT NULL REFERENCES public.thinking_territories (id) ON DELETE CASCADE,
  code text NOT NULL,
  statement text NOT NULL,
  meaning text NOT NULL DEFAULT '',
  boundary text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate',
  last_audit jsonb NULL,
  generation_batch_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_angles_status_check CHECK (
    status = ANY (ARRAY['candidate'::text, 'locked'::text, 'rejected'::text])
  ),
  CONSTRAINT thinking_angles_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_angles_statement_check CHECK (char_length(trim(statement)) > 0),
  CONSTRAINT thinking_angles_org_territory_code_key UNIQUE (organization_id, territory_id, code)
);

CREATE INDEX thinking_angles_territory_sort_idx
  ON public.thinking_angles (territory_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_angles_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_angles_updated_at
      BEFORE UPDATE ON public.thinking_angles
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_angles ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_angles_member_all
  ON public.thinking_angles
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_angles IS
  'Angle proposition candidates/locks under a Territory. Parent = territory_id; BT/MT via lineage.';
