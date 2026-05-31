-- Visit Scheduling — verify matrix (linked demo org)
-- Run: npm run supabase:db:push:visit-scheduling-verify
-- After: npm run supabase:db:push:visit-scheduling-fresh-demo

DROP TABLE IF EXISTS _vs_verify;
CREATE TEMP TABLE _vs_verify (
  test_id text PRIMARY KEY,
  description text,
  expected text,
  actual text,
  pass boolean
);

-- V01 demo client exists
INSERT INTO _vs_verify
SELECT
  'V01_demo_client',
  'VS Fresh Demo client seeded',
  'company_name contains VS Fresh Demo',
  c.company_name,
  c.company_name ILIKE 'VS Fresh Demo%'
FROM public.clients c
WHERE c.id = 'c1c1c1c1-1111-4111-8111-111111111101'::uuid;

-- V02 today scheduled visit for OCTA (mobile + jadwal)
INSERT INTO _vs_verify
SELECT
  'V02_today_scheduled_octa',
  'OCTA has scheduled visit TODAY',
  'count >= 1',
  format('count=%s', cnt),
  cnt >= 1
FROM (
  SELECT count(*)::int AS cnt
  FROM public.client_visits cv
  WHERE cv.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND cv.visit_date = CURRENT_DATE
    AND cv.status = 'scheduled'
) s;

-- V03 join query mirrors useVisitScheduling
INSERT INTO _vs_verify
SELECT
  'V03_visit_scheduling_join',
  'PostgREST embed clients/employees/office_locations',
  'row with company_name + employee name',
  format('client=%s employee=%s loc=%s', client_name, emp_name, loc_name),
  client_name IS NOT NULL AND emp_name IS NOT NULL
FROM (
  SELECT
    cl.company_name AS client_name,
    e.full_name AS emp_name,
    ol.name AS loc_name
  FROM public.client_visits cv
  JOIN public.clients cl ON cl.id = cv.lead_client_id
  LEFT JOIN public.employees e ON e.id = cv.employee_id
  LEFT JOIN public.office_locations ol ON ol.id = cv.validated_location_id
  WHERE cv.id = 'b3b3b3b3-3333-4333-8333-333333333301'::uuid
) j;

-- V04 status matrix — ongoing OK, in_progress must FAIL
DO $$
BEGIN
  BEGIN
    INSERT INTO public.client_visits (
      organization_id, lead_client_id, employee_id, visit_date, visit_purpose, status, notes
    ) VALUES (
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      CURRENT_DATE, 'probe', 'in_progress', 'VS verify probe — should fail'
    );
    INSERT INTO _vs_verify VALUES (
      'V04_mobile_status_in_progress',
      'Mobile uses in_progress — must match DB CHECK',
      'INSERT rejected',
      'INSERT succeeded (BUG)',
      false
    );
  EXCEPTION WHEN check_violation THEN
    INSERT INTO _vs_verify VALUES (
      'V04_mobile_status_in_progress',
      'Mobile uses in_progress — must match DB CHECK',
      'INSERT rejected',
      'check_violation (expected until migration)',
      true
    );
  END;
END $$;

-- V05 mobile extra columns — actual_start_time succeeds after migration
DO $$
DECLARE v_probe_id uuid;
BEGIN
  BEGIN
    INSERT INTO public.client_visits (
      organization_id, lead_client_id, employee_id, visit_date, visit_purpose, status,
      actual_start_time, notes
    ) VALUES (
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      CURRENT_DATE, 'probe', 'ongoing',
      now(), 'VS verify probe — extra column'
    )
    RETURNING id INTO v_probe_id;

    INSERT INTO _vs_verify VALUES (
      'V05_mobile_extra_columns',
      'Mobile insert payload has actual_start_time etc.',
      'INSERT succeeded',
      'INSERT succeeded',
      true
    );

    DELETE FROM public.client_visits WHERE id = v_probe_id;
  EXCEPTION WHEN undefined_column THEN
    INSERT INTO _vs_verify VALUES (
      'V05_mobile_extra_columns',
      'Mobile insert payload has actual_start_time etc.',
      'INSERT succeeded',
      'undefined_column (migration missing)',
      false
    );
  END;
END $$;

-- V06 createScheduledVisit shape insert
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.client_visits (
    organization_id, lead_client_id, employee_id, validated_location_id,
    visit_date, visit_purpose, status, planned_start_time, planned_end_time, notes
  ) VALUES (
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    'a2a2a2a2-2222-4222-8222-222222222201'::uuid,
    CURRENT_DATE + 2,
    'Probe createScheduledVisit',
    'scheduled',
    '09:00'::time, '10:00'::time,
    'VS verify probe — delete after'
  )
  RETURNING id INTO v_id;

  INSERT INTO _vs_verify VALUES (
    'V06_create_scheduled_visit',
    'Desktop hook insert shape works',
    'scheduled row created',
    format('id=%s', v_id),
    v_id IS NOT NULL
  );

  DELETE FROM public.client_visits WHERE id = v_id;
END $$;

-- V07 cross-tab same table count
INSERT INTO _vs_verify
SELECT
  'V07_shared_table_count',
  'jadwal + client-visits read same client_visits rows',
  'demo rows >= 5',
  format('demo_rows=%s total_org=%s', demo_cnt, total_cnt),
  demo_cnt >= 5 AND demo_cnt = total_cnt
FROM (
  SELECT
    count(*) FILTER (WHERE notes ILIKE '%VS Fresh Demo%')::int AS demo_cnt,
    count(*)::int AS total_cnt
  FROM public.client_visits
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
) s;

-- V11 mobile start — UPDATE scheduled → ongoing
DO $$
DECLARE
  v_id uuid := 'b3b3b3b3-3333-4333-8333-333333333301'::uuid;
  v_status text;
BEGIN
  UPDATE public.client_visits cv
  SET
    status = 'ongoing',
    actual_start_time = now(),
    start_location = jsonb_build_object('latitude', -6.136758, 'longitude', 106.785000),
    updated_at = now()
  WHERE cv.id = v_id
    AND cv.status = 'scheduled';

  SELECT cv.status INTO v_status FROM public.client_visits cv WHERE cv.id = v_id;

  INSERT INTO _vs_verify VALUES (
    'V11_scheduled_to_ongoing',
    'Simulate mobile start: scheduled → ongoing',
    'status=ongoing, actual_start_time NOT NULL',
    format('status=%s', v_status),
    v_status = 'ongoing'
  );

  -- Restore demo row for manual QA
  UPDATE public.client_visits cv
  SET
    status = 'scheduled',
    actual_start_time = NULL,
    start_location = NULL,
    updated_at = now()
  WHERE cv.id = v_id;
END $$;

-- V08 validate_client_visit_location RPC
INSERT INTO _vs_verify
SELECT
  'V08_location_validate_rpc',
  'validate_client_visit_location exists for mobile GPS check',
  'rpc exists',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_client_visit_location')
    THEN 'exists' ELSE 'MISSING' END,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_client_visit_location');

-- V09 sales_activities independent
INSERT INTO _vs_verify
SELECT
  'V09_sales_activities_demo',
  'Activities page has VS Fresh Demo row (separate table)',
  'count >= 1',
  format('count=%s', cnt),
  cnt >= 1
FROM (
  SELECT count(*)::int AS cnt FROM public.sales_activities sa
  WHERE sa.client_name ILIKE 'VS Fresh Demo%'
) s;

-- V10 ongoing vs mobile in_progress mismatch
INSERT INTO _vs_verify
SELECT
  'V10_status_vocabulary',
  'DB ongoing row exists; mobile filters in_progress',
  'ongoing=1, in_progress rows=0',
  format('ongoing=%s in_progress=%s', ongoing_cnt, ip_cnt),
  ongoing_cnt >= 1 AND ip_cnt = 0
FROM (
  SELECT
    count(*) FILTER (WHERE status = 'ongoing')::int AS ongoing_cnt,
    count(*) FILTER (WHERE status = 'in_progress')::int AS ip_cnt
  FROM public.client_visits
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
) s;

SELECT '--- VERIFY MATRIX ---' AS section;
SELECT * FROM _vs_verify ORDER BY test_id;

SELECT '--- SUMMARY ---' AS section;
SELECT
  count(*) FILTER (WHERE pass IS NOT TRUE) AS failures,
  count(*) AS total,
  CASE WHEN count(*) FILTER (WHERE pass IS NOT TRUE) = 0 THEN 'ALL PASS' ELSE 'FAIL' END AS status
FROM _vs_verify;

SELECT '--- FULL REPORT JSON ---' AS section;
SELECT jsonb_pretty(jsonb_agg(to_jsonb(v) ORDER BY test_id)) AS full_report
FROM _vs_verify v;
