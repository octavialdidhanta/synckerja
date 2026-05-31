SELECT jsonb_pretty(jsonb_build_object(
  'client_visits_columns', (
    SELECT jsonb_agg(jsonb_build_object('name', column_name, 'type', data_type) ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_visits'
  ),
  'status_check', (
    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.client_visits'::regclass AND contype = 'c'
      AND conname = 'client_visits_status_check'
  ),
  'visit_counts_by_status', (
    SELECT coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
    FROM (
      SELECT status, count(*)::int AS cnt
      FROM public.client_visits
      WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      GROUP BY status
    ) s
  ),
  'sales_activities_count', (
    SELECT count(*)::int FROM public.sales_activities
    WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  ),
  'demo_clients', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'company_name', company_name)), '[]'::jsonb)
    FROM (
      SELECT id, company_name FROM public.clients
      WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      ORDER BY created_at DESC LIMIT 5
    ) c
  ),
  'demo_employees', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name)), '[]'::jsonb)
    FROM (
      SELECT id, full_name FROM public.employees
      WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      LIMIT 5
    ) e
  ),
  'office_locations', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]'::jsonb)
    FROM (
      SELECT id, name FROM public.office_locations
      WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND is_active IS NOT FALSE LIMIT 5
    ) ol
  ),
  'validate_rpc_exists', (
    SELECT EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'validate_client_visit_location'
    )
  )
)) AS vs_inspect;
