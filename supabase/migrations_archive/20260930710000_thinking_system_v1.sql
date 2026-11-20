-- Thinking System V1: Master Thought → Big Thought (org-scoped, multi-tenant).

CREATE TABLE IF NOT EXISTS public.thinking_master_thoughts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  statement text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  last_audit jsonb NULL,
  last_audit_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_master_thoughts_status_check CHECK (
    status = ANY (ARRAY['draft'::text, 'audited'::text, 'locked'::text])
  ),
  CONSTRAINT thinking_master_thoughts_statement_check CHECK (char_length(trim(statement)) > 0)
);

CREATE INDEX thinking_master_thoughts_org_updated_idx
  ON public.thinking_master_thoughts (organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.thinking_big_thoughts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  master_thought_id uuid NOT NULL REFERENCES public.thinking_master_thoughts (id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  statement text NOT NULL,
  core_belief text NOT NULL DEFAULT '',
  boundary text NOT NULL DEFAULT '',
  axis text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate',
  generation_batch_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT thinking_big_thoughts_status_check CHECK (
    status = ANY (ARRAY['candidate'::text, 'locked'::text, 'rejected'::text])
  ),
  CONSTRAINT thinking_big_thoughts_code_check CHECK (char_length(trim(code)) > 0),
  CONSTRAINT thinking_big_thoughts_org_master_code_key UNIQUE (organization_id, master_thought_id, code)
);

CREATE INDEX thinking_big_thoughts_master_sort_idx
  ON public.thinking_big_thoughts (master_thought_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_master_thoughts_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_master_thoughts_updated_at
      BEFORE UPDATE ON public.thinking_master_thoughts
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_thinking_big_thoughts_updated_at'
  ) THEN
    CREATE TRIGGER handle_thinking_big_thoughts_updated_at
      BEFORE UPDATE ON public.thinking_big_thoughts
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.thinking_master_thoughts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thinking_big_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinking_master_thoughts_member_all
  ON public.thinking_master_thoughts
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY thinking_big_thoughts_member_all
  ON public.thinking_big_thoughts
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.thinking_master_thoughts IS
  'Org-scoped Master Thought records for the Thinking System.';
COMMENT ON TABLE public.thinking_big_thoughts IS
  'Big Thought candidates/locks under a Master Thought.';

CREATE OR REPLACE FUNCTION public.sales_module_catalog_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT ARRAY[
    'okr',
    'humanResources',
    'finance',
    'digitalMarketing',
    'leadMagnet',
    'omnichannel',
    'operations',
    'tools',
    'requestForm',
    'customModules',
    'customerSupport',
    'thinking'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public._plan_module_label(p_module_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_module_key
    WHEN 'okr' THEN 'OKR'
    WHEN 'humanResources' THEN 'Human Resources'
    WHEN 'finance' THEN 'Finance'
    WHEN 'digitalMarketing' THEN 'Digital Marketing'
    WHEN 'omnichannel' THEN 'Operations / Omnichannel'
    WHEN 'operations' THEN 'Sales Operations'
    WHEN 'tools' THEN 'Tools'
    WHEN 'requestForm' THEN 'Request Form'
    WHEN 'customModules' THEN 'kustom'
    WHEN 'leadMagnet' THEN 'Lead Magnet'
    WHEN 'customerSupport' THEN 'Customer Support'
    WHEN 'thinking' THEN 'Thinking'
    ELSE p_module_key
  END;
$$;

INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES (
  '/thinking',
  'Thinking',
  true,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/thinking'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

INSERT INTO public.subscription_plan_module_access (subscription_plan_id, module_key, is_enabled)
SELECT sp.id, 'thinking', true
FROM public.subscription_plans sp
ON CONFLICT (subscription_plan_id, module_key) DO UPDATE SET
  is_enabled = true,
  updated_at = now();

INSERT INTO public.organization_sales_module_access (organization_id, module_key, is_enabled)
SELECT o.id, 'thinking', true
FROM public.organizations o
ON CONFLICT (organization_id, module_key) DO UPDATE SET
  is_enabled = true,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
