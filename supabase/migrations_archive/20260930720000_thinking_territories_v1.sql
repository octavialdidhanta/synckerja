-- Thinking Territories V1: under locked Big Thoughts (org-scoped).

CREATE TABLE IF NOT EXISTS public.thinking_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  big_thought_id uuid NOT NULL REFERENCES public.thinking_big_thoughts (id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  statement text NOT NULL DEFAULT '',
  boundary text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate',
  last_audit jsonb NULL,
  generation_batch_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_territories_status_check CHECK (
    status = ANY (ARRAY['candidate'::text, 'locked'::text, 'rejected'::text])
  ),
  CONSTRAINT thinking_territories_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_territories_title_check CHECK (char_length(trim(title)) > 0),
  CONSTRAINT thinking_territories_org_bt_code_key UNIQUE (organization_id, big_thought_id, code)
);

CREATE INDEX thinking_territories_bt_sort_idx
  ON public.thinking_territories (big_thought_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_territories_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_territories_updated_at
      BEFORE UPDATE ON public.thinking_territories
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_territories_member_all
  ON public.thinking_territories
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_territories IS
  'Strategic Territory candidates/locks under a Big Thought.';
