-- Move TikTok Shop page permission to Operations → Sales.

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
  '/operations/sales/tiktok-shop',
  'Operations — Sales — TikTok Shop',
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
WHERE d.page_path = '/operations/sales/tiktok-shop'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

-- Legacy path: redirect access via exception on new path if your app uses exception_paths;
-- keep old permission inactive for new installs only.
UPDATE public.permission_configuration_defaults
SET is_active = false,
    updated_at = now()
WHERE page_path = '/digital-marketing/tiktok-shop';

UPDATE public.permission_configurations
SET is_active = false,
    updated_at = now()
WHERE page_path = '/digital-marketing/tiktok-shop';
