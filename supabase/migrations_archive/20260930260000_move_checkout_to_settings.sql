-- Move Checkout page access from Item Library to Operations Settings.

UPDATE public.permission_configuration_defaults
SET
  page_path = '/operations/settings/checkout',
  page_title = 'Operations — Settings — Checkout',
  updated_at = now()
WHERE page_path = '/operations/library/checkout'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configuration_defaults existing
    WHERE existing.page_path = '/operations/settings/checkout'
  );

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
  '/operations/settings/checkout',
  'Operations — Settings — Checkout',
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

UPDATE public.permission_configurations p
SET
  page_path = '/operations/settings/checkout',
  page_title = 'Operations — Settings — Checkout',
  updated_at = now()
WHERE p.page_path = '/operations/library/checkout'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations existing
    WHERE existing.organization_id = p.organization_id
      AND existing.page_path = '/operations/settings/checkout'
  );

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
WHERE p.page_path = '/operations/settings/outlets-list'
  AND d.page_path = '/operations/settings/checkout'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations existing
    WHERE existing.organization_id = p.organization_id
      AND existing.page_path = d.page_path
  );

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
WHERE d.page_path = '/operations/settings/checkout'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

DELETE FROM public.permission_configurations
WHERE page_path = '/operations/library/checkout';

DELETE FROM public.permission_configuration_defaults
WHERE page_path = '/operations/library/checkout';
