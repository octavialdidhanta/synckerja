-- QA: Kitchen system role + app.kitchen_display
-- Paste into Supabase SQL Editor. Change the company_name filter if needed.

WITH org AS (
  SELECT id
  FROM public.organizations
  WHERE company_name ILIKE '%Synckerja Office%'
  LIMIT 1
)
SELECT r.id, r.name, r.slug, r.is_system
FROM public.pos_employee_roles r
JOIN org ON org.id = r.organization_id
WHERE r.slug IN ('administrator', 'cashier', 'kitchen')
ORDER BY r.slug;

WITH org AS (
  SELECT id
  FROM public.organizations
  WHERE company_name ILIKE '%Synckerja Office%'
  LIMIT 1
)
SELECT r.slug, p.permission_key
FROM public.pos_employee_roles r
JOIN org ON org.id = r.organization_id
JOIN public.pos_employee_role_permissions p ON p.role_id = r.id
WHERE r.slug IN ('kitchen', 'administrator')
  AND p.permission_key = 'app.kitchen_display'
ORDER BY r.slug;

SELECT public.pos_default_kitchen_permission_keys() AS kitchen_keys;
