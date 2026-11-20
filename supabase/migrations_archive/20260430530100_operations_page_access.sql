-- Page access: Operations / CRM / Sales / Livechat (standard org roles)

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440090', NULL, '/operations/sales', 'Operations Sales', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/operations/sales'
);

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440091', NULL, '/operations/consultant/dashboard', 'Operations CRM Dashboard', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/operations/consultant/dashboard'
);

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440092', NULL, '/operations/consultant/leads-management', 'Operations Leads Management', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/operations/consultant/leads-management'
);

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440093', NULL, '/operations/consultant/whatsapp/connect', 'Connect WhatsApp', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/operations/consultant/whatsapp/connect'
);

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440094', NULL, '/operations/consultant/instagram/connect', 'Connect Instagram', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/operations/consultant/instagram/connect'
);

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440095', NULL, '/operations/consultant/email/connect', 'Connect Email', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/operations/consultant/email/connect'
);

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
)
SELECT '550e8400-e29b-41d4-a716-446655440096', NULL, '/operations/consultant/all/livechat', 'Livechat', TRUE,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_configurations c
  WHERE c.organization_id IS NULL AND c.page_path = '/operations/consultant/all/livechat'
);
