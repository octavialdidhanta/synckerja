-- Operations Ingredient: Library / Categories / Recipes page access.

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
    '/operations/ingredient/list',
    'Operations — Ingredient — Library',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/ingredient/categories',
    'Operations — Ingredient — Categories',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/ingredient/recipes',
    'Operations — Ingredient — Recipes',
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

-- Copy org-specific access from product-list when present.
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
  p.organization_id,
  d.page_path,
  d.page_title,
  p.is_active,
  p.roles_allowed,
  p.job_levels_allowed,
  p.exceptions,
  p.exception_paths
FROM public.permission_configurations p
CROSS JOIN public.permission_configuration_defaults d
WHERE p.page_path = '/operations/library/product-list'
  AND d.page_path IN (
    '/operations/ingredient/list',
    '/operations/ingredient/categories',
    '/operations/ingredient/recipes'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations existing
    WHERE existing.organization_id = p.organization_id
      AND existing.page_path = d.page_path
  );

-- Orgs without a product-list row: seed from defaults.
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
WHERE d.page_path IN (
    '/operations/ingredient/list',
    '/operations/ingredient/categories',
    '/operations/ingredient/recipes'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
