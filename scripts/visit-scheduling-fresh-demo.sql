-- Visit Scheduling — fresh demo data (linked Synckerja org)
-- Run: npm run supabase:db:push:visit-scheduling-fresh-demo
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a | OCTA: 001b6725-bf16-4a2f-81ae-8960cf86c46d

SELECT '--- RUN CONTEXT ---' AS section;
SELECT CURRENT_DATE AS demo_date, now() AS seeded_at;

-- ===========================================================================
-- 1) CLEANUP — hapus data demo Visit Scheduling lama
-- ===========================================================================
DELETE FROM public.client_visits cv
WHERE cv.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND (
    cv.notes ILIKE '%VS Fresh Demo%'
    OR cv.id IN (
      'b3b3b3b3-3333-4333-8333-333333333301'::uuid,
      'b3b3b3b3-3333-4333-8333-333333333302'::uuid,
      'b3b3b3b3-3333-4333-8333-333333333303'::uuid,
      'b3b3b3b3-3333-4333-8333-333333333304'::uuid,
      'b3b3b3b3-3333-4333-8333-333333333305'::uuid
    )
  );

DELETE FROM public.clients c
WHERE c.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND c.company_name ILIKE 'VS Fresh Demo%';

-- Hapus sales activity demo lama (prefix nama klien demo)
DELETE FROM public.sales_activity_payments sap
WHERE sap.sales_activity_id IN (
  SELECT sa.id FROM public.sales_activities sa
  WHERE sa.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND sa.client_name ILIKE 'VS Fresh Demo%'
);

DELETE FROM public.sales_activity_items sai
WHERE sai.sales_activity_id IN (
  SELECT sa.id FROM public.sales_activities sa
  WHERE sa.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND sa.client_name ILIKE 'VS Fresh Demo%'
);

DELETE FROM public.sales_activities sa
WHERE sa.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND sa.client_name ILIKE 'VS Fresh Demo%';

-- ===========================================================================
-- 2) SEED — client demo + lokasi kunjungan
-- ===========================================================================
INSERT INTO public.clients (
  id, organization_id, company_name, contact_person, contact_phone, address, is_active
)
VALUES (
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'VS Fresh Demo — PT Maju Bersama',
  'Budi Santoso',
  '+6281234567890',
  'Jl. Demo Kunjungan No. 10, Jakarta Barat',
  true
)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  contact_person = EXCLUDED.contact_person,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  is_active = true,
  updated_at = now();

INSERT INTO public.office_locations (
  id, organization_id, name, address, latitude, longitude, radius_meters, is_active
)
VALUES (
  'a2a2a2a2-2222-4222-8222-222222222201'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'VS Fresh Demo Client Site — Grogol',
  'Grogol, Jakarta Barat',
  -6.167500, 106.790600, 150, true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  radius_meters = EXCLUDED.radius_meters,
  is_active = true,
  is_client_location = true,
  client_id = 'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  sales_person_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  updated_at = now();

-- ===========================================================================
-- 3) SEED — client_visits (desktop jadwal + client-visits + mobile today)
-- ===========================================================================
-- V301: scheduled TODAY — mobile TodayVisitSchedule + desktop jadwal
INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time, notes
)
VALUES (
  'b3b3b3b3-3333-4333-8333-333333333301'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222201'::uuid,
  CURRENT_DATE,
  'Presentasi produk — VS Fresh Demo',
  'scheduled',
  '09:00'::time, '11:00'::time,
  'VS Fresh Demo | skenario desktop W-jadwal + mobile today'
);

-- V302: scheduled TOMORROW
INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time, notes
)
VALUES (
  'b3b3b3b3-3333-4333-8333-333333333302'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222201'::uuid,
  CURRENT_DATE + 1,
  'Follow-up kontrak — VS Fresh Demo',
  'scheduled',
  '14:00'::time, '16:00'::time,
  'VS Fresh Demo | filter tomorrow di jadwal-kunjungan'
);

-- V303: completed YESTERDAY — client-visits metrics
INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time, notes
)
VALUES (
  'b3b3b3b3-3333-4333-8333-333333333303'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222201'::uuid,
  CURRENT_DATE - 1,
  'Kunjungan selesai — VS Fresh Demo',
  'completed',
  '10:00'::time, '12:00'::time,
  'VS Fresh Demo | completed history'
);

-- V304: cancelled TODAY
INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time, notes
)
VALUES (
  'b3b3b3b3-3333-4333-8333-333333333304'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222201'::uuid,
  CURRENT_DATE,
  'Dibatalkan — VS Fresh Demo',
  'cancelled',
  '15:00'::time, '16:00'::time,
  'VS Fresh Demo | cancelled row'
);

-- V305: ongoing TODAY — desktop client-visits filter "ongoing"
INSERT INTO public.client_visits (
  id, organization_id, lead_client_id, employee_id, validated_location_id,
  visit_date, visit_purpose, status, planned_start_time, planned_end_time,
  actual_start_time, notes
)
VALUES (
  'b3b3b3b3-3333-4333-8333-333333333305'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'c1c1c1c1-1111-4111-8111-111111111101'::uuid,
  '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid,
  'a2a2a2a2-2222-4222-8222-222222222201'::uuid,
  CURRENT_DATE,
  'Kunjungan berlangsung — VS Fresh Demo',
  'ongoing',
  '08:30'::time, '10:30'::time,
  (CURRENT_DATE + TIME '08:30:00') AT TIME ZONE 'Asia/Jakarta',
  'VS Fresh Demo | ongoing (DB) — mobile expects in_progress'
);

-- ===========================================================================
-- 4) SEED — sales_activity terpisah (halaman activities, bukan FK visit)
-- ===========================================================================
INSERT INTO public.sales_activities (
  id, organization_id, client_name, client_phone, status, activity_type, date, notes
)
VALUES (
  'e4e4e4e4-4444-4444-8444-444444444401'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'VS Fresh Demo — PT Maju Bersama',
  '+6281234567890',
  'Active',
  'visit',
  CURRENT_DATE,
  'VS Fresh Demo | sales activity terpisah dari client_visits (post-visit mobile insert pattern)'
)
ON CONFLICT (id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  status = EXCLUDED.status,
  updated_at = now();

SELECT '--- SEED SUMMARY ---' AS section;
SELECT jsonb_pretty(jsonb_build_object(
  'demo_date', CURRENT_DATE::text,
  'client', (SELECT company_name FROM public.clients WHERE id = 'c1c1c1c1-1111-4111-8111-111111111101'::uuid),
  'visits_by_status', (
    SELECT coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
    FROM (
      SELECT cv.status, count(*)::int AS cnt
      FROM public.client_visits cv
      WHERE cv.notes ILIKE '%VS Fresh Demo%'
      GROUP BY cv.status
    ) s
  ),
  'visits_today_octa', (
    SELECT count(*)::int FROM public.client_visits cv
    WHERE cv.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
      AND cv.visit_date = CURRENT_DATE
  ),
  'sales_demo_count', (
    SELECT count(*)::int FROM public.sales_activities sa
    WHERE sa.client_name ILIKE 'VS Fresh Demo%'
  )
)) AS fresh_demo_summary;
