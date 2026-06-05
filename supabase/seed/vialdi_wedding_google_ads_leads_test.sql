-- TEST ONLY: leads for Google Ads "Offering Performance" column set (vialdi-wedding org).
-- Exact-case utm_campaign must match Google Ads campaign names.
--
-- Suggested column set keys:
-- ["traffic_total_visit_page", "leads_total", "leads_visit_rate", "leads_cost_per_lead"]
--
-- Cleanup:
-- DELETE FROM public.leads WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a' AND ticket_id LIKE 'TEST-GADS-%';

DELETE FROM public.leads
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND ticket_id LIKE 'TEST-GADS-%';

WITH org AS (
  SELECT '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id
),
actor AS (
  SELECT COALESCE(
    (SELECT p.user_id FROM public.profiles p, org o
     WHERE p.active_organization_id = o.organization_id
     ORDER BY p.updated_at DESC NULLS LAST
     LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  ) AS user_id
),
targets(campaign, cnt, base_day) AS (
  VALUES
    ('JASA FOTO WEDDING.'::text, 15, '2026-05-20'::date),
    ('JASA FOTO WEDDING (WINNING KEYWORD CONVERSI DARI THANK YOU PAGE) Q2 2023'::text, 10, '2026-05-22'::date),
    ('Website traffic-Search Jasa Foto Wedding'::text, 8, '2026-05-24'::date),
    ('JASA FOTO PREWEDDING'::text, 3, '2026-05-26'::date)
),
expanded AS (
  SELECT
    t.campaign,
    gs AS seq,
    (t.base_day + ((gs - 1) % 10))::date AS day
  FROM targets t
  CROSS JOIN LATERAL generate_series(1, t.cnt) AS gs
)
INSERT INTO public.leads (
  ticket_id,
  client,
  title,
  category,
  created_by,
  created_by_name,
  assignee,
  organization_id,
  created_at,
  attribution,
  attribution_label
)
SELECT
  'TEST-GADS-' || lpad(e.seq::text, 4, '0') || '-' || substr(md5(e.campaign || e.seq::text), 1, 6),
  'Test Lead ' || e.seq,
  'Google Ads test lead',
  'Test',
  a.user_id,
  'Test Seed',
  'Unassigned',
  o.organization_id,
  (e.day + time '14:00:00' + (e.seq || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta',
  jsonb_build_object(
    'utm_source', 'google',
    'utm_medium', 'cpc',
    'utm_campaign', e.campaign
  ),
  e.campaign
FROM expanded e
CROSS JOIN org o
CROSS JOIN actor a;
