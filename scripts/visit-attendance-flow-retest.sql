-- Extended flow retest: client visit + attendance integration
-- Org OCTA demo: 663c9336… | employee: 001b6725…

SELECT '=== FLOW RETEST ===' AS section;

DROP TABLE IF EXISTS _flow;
CREATE TEMP TABLE _flow (
  test_id text PRIMARY KEY,
  scenario text,
  expected text,
  actual text,
  pass boolean
);

-- ---------------------------------------------------------------------------
-- F01 Field-first: check-in 08:05 NOT late vs office 08:00 (late vs visit 08:00 only)
-- ---------------------------------------------------------------------------
INSERT INTO _flow
SELECT
  'F01_field_first_0805_not_late',
  'Field-first Start Visit 08:05 vs plan 08:00 (tol 15m)',
  'is_late=false',
  format('late=%s mins=%s ref=%s mode=%s', is_late, late_minutes, late_reference_time, visit_day_mode),
  is_late IS FALSE AND visit_day_mode = 'field_first'
FROM (
  SELECT
    (l->>'is_late')::boolean AS is_late,
    (l->>'late_minutes')::integer AS late_minutes,
    (l->>'late_reference_time')::time AS late_reference_time,
    l->>'visit_day_mode' AS visit_day_mode
  FROM (
    SELECT public.resolve_attendance_late_for_day(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      '2026-06-16'::date,
      '2026-06-16 08:05:00'::timestamp,
      'f5f5f5f5-5555-4555-8555-555555555502'::uuid,
      false
    ) AS l
  ) x
) y;

-- ---------------------------------------------------------------------------
-- F02 Field-first: 11:34 would be late vs visit 08:00 but NOT counted as office late
-- ---------------------------------------------------------------------------
INSERT INTO _flow
SELECT
  'F02_field_first_1134_late_vs_visit',
  'Field-first 11:34 late vs visit plan 08:00 not office',
  'is_late=true ref=08:00',
  format('late=%s mins=%s ref=%s', is_late, late_minutes, late_reference_time),
  is_late IS TRUE
    AND late_minutes >= 200
    AND late_reference_time = '08:00:00'::time
FROM (
  SELECT
    (l->>'is_late')::boolean AS is_late,
    (l->>'late_minutes')::integer AS late_minutes,
    (l->>'late_reference_time')::time AS late_reference_time
  FROM (
    SELECT public.resolve_attendance_late_for_day(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      '2026-06-16'::date,
      '2026-06-16 11:34:00'::timestamp,
      'f5f5f5f5-5555-4555-8555-555555555502'::uuid,
      false
    ) AS l
  ) x
) y;

-- ---------------------------------------------------------------------------
-- F03 Office-first: 11:34 late vs work start 08:00 (OCTA regression case)
-- ---------------------------------------------------------------------------
INSERT INTO _flow
SELECT
  'F03_office_first_1134_late_vs_office',
  'Office-first 11:34 late vs work 08:00',
  'is_late=true ref~08:00',
  format('late=%s mins=%s ref=%s mode=%s', is_late, late_minutes, late_reference_time, visit_day_mode),
  is_late IS TRUE AND late_minutes >= 200 AND visit_day_mode = 'office_first'
FROM (
  SELECT
    (l->>'is_late')::boolean AS is_late,
    (l->>'late_minutes')::integer AS late_minutes,
    (l->>'late_reference_time')::time AS late_reference_time,
    l->>'visit_day_mode' AS visit_day_mode
  FROM (
    SELECT public.resolve_attendance_late_for_day(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      '2026-06-15'::date,
      '2026-06-15 11:34:00'::timestamp,
      'f5f5f5f5-5555-4555-8555-555555555501'::uuid,
      false
    ) AS l
  ) x
) y;

-- ---------------------------------------------------------------------------
-- F04 Travel field: 08:00 check-in NOT required at office (late resolver uses visit 13:00)
-- ---------------------------------------------------------------------------
INSERT INTO _flow
SELECT
  'F04_travel_field_0800_not_late',
  'Travel field 08:00 office time not late (ref=visit 13:00)',
  'is_late=false',
  format('late=%s ref=%s mode=%s', is_late, late_reference_time, visit_day_mode),
  is_late IS FALSE AND visit_day_mode = 'travel_field'
FROM (
  SELECT
    (l->>'is_late')::boolean AS is_late,
    (l->>'late_reference_time')::time AS late_reference_time,
    l->>'visit_day_mode' AS visit_day_mode
  FROM (
    SELECT public.resolve_attendance_late_for_day(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      '2026-06-17'::date,
      '2026-06-17 08:00:00'::timestamp,
      NULL,
      false
    ) AS l
  ) x
) y;

-- ---------------------------------------------------------------------------
-- F05 Spontaneous auto check-in: not late at start
-- ---------------------------------------------------------------------------
INSERT INTO _flow
SELECT
  'F05_spontaneous_not_late_at_start',
  'Spontaneous Start Visit baseline = check-in time',
  'is_late=false',
  format('late=%s mode=%s', is_late, visit_day_mode),
  is_late IS FALSE AND visit_day_mode = 'field_first'
FROM (
  SELECT
    (l->>'is_late')::boolean AS is_late,
    l->>'visit_day_mode' AS visit_day_mode
  FROM (
    SELECT public.resolve_attendance_late_for_day(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      '2026-06-18'::date,
      '2026-06-18 10:15:00'::timestamp,
      NULL,
      true
    ) AS l
  ) x
) y;

-- ---------------------------------------------------------------------------
-- F06 Idempotent: second record_attendance_from_client_visit skipped
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.record_attendance_from_client_visit(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-16'::date,
    'f8f8f8f8-8888-4888-8888-888888888801'::uuid,
    'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
    ('2026-06-16 08:10:00+07')::timestamptz,
    jsonb_build_object('latitude', -6.167500, 'longitude', 106.790600),
    NULL,
    'Asia/Jakarta',
    false,
    NULL
  );

  INSERT INTO _flow VALUES (
    'F06_idempotent_skip',
    'Second auto check-in same day skipped',
    'skipped=true',
    format('skipped=%s reason=%s', v_result->>'skipped', v_result->>'reason'),
    COALESCE((v_result->>'skipped')::boolean, false) IS TRUE
      AND v_result->>'reason' = 'attendance_already_exists'
  );
END $$;

-- ---------------------------------------------------------------------------
-- F07 Multi-visit: primary = earliest planned_start (08:30 not 14:00)
-- ---------------------------------------------------------------------------
DELETE FROM public.client_visits WHERE id IN (
  'f9f9f9f9-9999-4999-8999-999999999901'::uuid,
  'f9f9f9f9-9999-4999-8999-999999999902'::uuid
);

INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time, created_at
)
VALUES
(
  'f9f9f9f9-9999-4999-8999-999999999902'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
  '2026-06-19'::date,
  'VA multi visit afternoon',
  'scheduled',
  '14:00'::time, '16:00'::time,
  '2026-06-01 12:00:00+07'::timestamptz
),
(
  'f9f9f9f9-9999-4999-8999-999999999901'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'd4d4d4d4-4444-4444-8444-444444444401'::uuid,
  '2026-06-19'::date,
  'VA multi visit morning',
  'scheduled',
  '08:30'::time, '10:00'::time,
  '2026-06-01 11:00:00+07'::timestamptz
);

INSERT INTO _flow
SELECT
  'F07_multi_visit_primary',
  'Primary visit = earliest planned_start',
  'primary=f9..901 mode=field_first',
  format('primary=%s mode=%s start=%s', primary_id, mode, planned),
  primary_id::uuid = 'f9f9f9f9-9999-4999-8999-999999999901'::uuid
    AND mode = 'field_first'
FROM (
  SELECT
    m->>'primary_visit_id' AS primary_id,
    m->>'mode' AS mode,
    m->>'planned_start_time' AS planned
  FROM (
    SELECT public.resolve_visit_day_mode(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      '2026-06-19'::date
    ) AS m
  ) s
) x;

-- ---------------------------------------------------------------------------
-- F08 Office-first check-in at client GPS: nearest office is HQ not client site
-- (simulate validate location logic — at client coords, office-first day)
-- ---------------------------------------------------------------------------
INSERT INTO _flow
SELECT
  'F08_office_first_client_gps_rejected',
  'Office-first at client GPS: no office within radius',
  'loc_ok=false',
  format('loc_ok=%s dist=%s radius=%s off=%s', loc_ok, dist, radius, off_name),
  loc_ok IS FALSE
FROM (
  WITH client_gps AS (
    SELECT -6.167500::double precision AS lat, 106.790600::double precision AS lon
  ),
  nearest_office AS (
    SELECT
      ol.id,
      ol.name,
      ol.radius_meters,
      (
        6371000.0 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(ol.latitude)) * cos(radians(g.lat))
            * cos(radians(g.lon) - radians(ol.longitude))
            + sin(radians(ol.latitude)) * sin(radians(g.lat))
          ))
        )
      )::numeric AS dist
    FROM public.office_locations ol
    CROSS JOIN client_gps g
    WHERE ol.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND COALESCE(ol.is_active, true)
      AND COALESCE(ol.is_client_location, false) IS NOT TRUE
      AND ol.latitude IS NOT NULL
    ORDER BY dist ASC
    LIMIT 1
  )
  SELECT
    n.dist <= COALESCE(n.radius_meters, 100) AS loc_ok,
    round(n.dist)::text AS dist,
    COALESCE(n.radius_meters, 100)::text AS radius,
    n.name AS off_name
  FROM nearest_office n
) y;

-- ---------------------------------------------------------------------------
-- F09 Integration disabled => mode normal
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_mode jsonb;
BEGIN
  UPDATE public.attendance_rules_settings
  SET enable_visit_attendance_integration = false
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

  v_mode := public.resolve_visit_day_mode(
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-06-16'::date
  );

  INSERT INTO _flow VALUES (
    'F09_integration_off_normal',
    'Master switch off => normal mode',
    'mode=normal',
    format('mode=%s reason=%s', v_mode->>'mode', v_mode->>'reason'),
    v_mode->>'mode' = 'normal'
  );

  UPDATE public.attendance_rules_settings
  SET enable_visit_attendance_integration = true
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;
END $$;

-- ---------------------------------------------------------------------------
-- F10 OCTA today: resolve mode for real scheduled visit (informational + assert mode)
-- ---------------------------------------------------------------------------
INSERT INTO _flow
SELECT
  'F10_octa_today_mode',
  'OCTA today visit day mode (informational)',
  'mode in (field_first,office_first,travel_field,normal)',
  format('mode=%s travel=%s visit=%s', mode, travel_mins, planned),
  mode IN ('field_first', 'office_first', 'travel_field', 'normal')
FROM (
  SELECT
    m->>'mode' AS mode,
    m->>'travel_minutes' AS travel_mins,
    m->>'planned_start_time' AS planned
  FROM (
    SELECT public.resolve_visit_day_mode(
      '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
      '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
      CURRENT_DATE
    ) AS m
  ) s
) x;

SELECT * FROM _flow ORDER BY test_id;

SELECT
  count(*) FILTER (WHERE pass) AS passed,
  count(*) FILTER (WHERE NOT pass) AS failed
FROM _flow;

DO $$
DECLARE v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed FROM _flow WHERE NOT pass;
  IF v_failed > 0 THEN
    RAISE EXCEPTION 'flow retest failed: % case(s)', v_failed;
  END IF;
END $$;
