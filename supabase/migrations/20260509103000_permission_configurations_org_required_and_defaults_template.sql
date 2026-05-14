-- Page access: no NULL organization_id on permission_configurations.
-- Template rows live in permission_configuration_defaults; new organizations get a full copy via trigger.

-- ---------------------------------------------------------------------------
-- 1) Template table (global defaults — not tied to an org row in permission_configurations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_configuration_defaults (
  page_path text PRIMARY KEY,
  page_title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  roles_allowed text[] NOT NULL DEFAULT ARRAY[]::text[],
  job_levels_allowed text[] NOT NULL DEFAULT ARRAY[]::text[],
  exceptions text[] NOT NULL DEFAULT ARRAY[]::text[],
  exception_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_configuration_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permission_configuration_defaults_select" ON public.permission_configuration_defaults;
CREATE POLICY "permission_configuration_defaults_select"
  ON public.permission_configuration_defaults
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed template from current system rows (organization_id IS NULL)
INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT DISTINCT ON (p.page_path)
  p.page_path,
  p.page_title,
  COALESCE(p.is_active, true),
  COALESCE(p.roles_allowed, ARRAY[]::text[]),
  COALESCE(p.job_levels_allowed, ARRAY[]::text[]),
  COALESCE(p.exceptions, ARRAY[]::text[]),
  COALESCE(p.exception_paths, ARRAY[]::text[])
FROM public.permission_configurations p
WHERE p.organization_id IS NULL
ORDER BY p.page_path, p.updated_at DESC
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

-- App routes for Employees module (legacy seeds used /employee-management only)
INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES
  (
    '/employees',
    'Halaman Employees',
    true,
    ARRAY['owner', 'admin']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/employees/add',
    'Tambah Karyawan',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/employees/reprimand',
    'Reprimand',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
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

-- ---------------------------------------------------------------------------
-- 2) Ensure every organization has all template paths
-- ---------------------------------------------------------------------------
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
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permission_configurations p
  WHERE p.organization_id = o.id
    AND p.page_path = d.page_path
);

-- ---------------------------------------------------------------------------
-- 3) Remove system rows from main table; enforce NOT NULL organization_id
-- ---------------------------------------------------------------------------
DELETE FROM public.permission_configurations
WHERE organization_id IS NULL;

DROP INDEX IF EXISTS public.idx_permission_configurations_unique_page_system;

ALTER TABLE public.permission_configurations
  ALTER COLUMN organization_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) RLS: main table is org-scoped only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "permission_configurations_select" ON public.permission_configurations;
CREATE POLICY "permission_configurations_select"
  ON public.permission_configurations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- 5) New organization → copy defaults into permission_configurations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_permission_configurations_for_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
    NEW.id,
    d.page_path,
    d.page_title,
    d.is_active,
    d.roles_allowed,
    d.job_levels_allowed,
    d.exceptions,
    d.exception_paths
  FROM public.permission_configuration_defaults AS d;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_seed_permission_configurations ON public.organizations;
CREATE TRIGGER organizations_seed_permission_configurations
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_permission_configurations_for_organization();
