-- Page access: Tools / Pricing tools (all standard org roles)

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440081', NULL, '/tools/pricing-tools', 'Tools Pricing Tool', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/tools/pricing-tools'
);
