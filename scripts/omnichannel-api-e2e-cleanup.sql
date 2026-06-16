-- Omnichannel Public API — E2E test data cleanup
-- Org: Klinik Utama Pandawa | web_id: klinik-utama-pandawa
--
-- Usage:
--   1) Run the PREVIEW block first and confirm row counts.
--   2) Run the DELETE block inside a transaction (BEGIN … COMMIT).
--   3) Run VERIFY to confirm zero remaining E2E rows.
--
-- Scope: only rows clearly marked as API E2E (E2E-* gclid/fbclid, INV-E2E-*,
-- LEAD-20260616-* on this org+web_id, test API token prefixes).

-- ===========================================================================
-- Constants (edit if re-running on another org / date)
-- ===========================================================================
-- organization_id: 86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf
-- web_id:          klinik-utama-pandawa
-- e2e_ticket_day:  LEAD-20260616-%

-- ===========================================================================
-- PREVIEW — row counts before delete
-- ===========================================================================
WITH e2e_leads AS (
  SELECT l.id
  FROM public.leads l
  WHERE l.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
    AND l.web_id = 'klinik-utama-pandawa'
    AND (
      l.gclid LIKE 'E2E-%'
      OR l.fbclid LIKE '%E2E%'
      OR l.ticket_id LIKE 'LEAD-20260616-%'
    )
),
e2e_sessions AS (
  SELECT s.id
  FROM public.analytics_sessions s
  WHERE s.web_id = 'klinik-utama-pandawa'
    AND (
      s.gclid LIKE 'E2E-%'
      OR s.fbclid LIKE '%E2E%'
      OR s.landing_url LIKE '%E2E-%'
    )
)
SELECT 'PREVIEW' AS section, jsonb_pretty(jsonb_build_object(
  'e2e_leads', (SELECT count(*)::int FROM e2e_leads),
  'lead_submissions', (
    SELECT count(*)::int FROM public.lead_submissions ls
    WHERE ls.lead_id IN (SELECT id FROM e2e_leads)
  ),
  'sales_invoices', (
    SELECT count(*)::int FROM public.sales_invoices si
    WHERE si.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
      AND si.invoice_number LIKE 'INV-E2E-%'
  ),
  'sales_activities', (
    SELECT count(*)::int FROM public.sales_activities sa
    WHERE sa.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
      AND (
        sa.lead_id IN (SELECT id FROM e2e_leads)
        OR sa.description LIKE 'Invoice INV-E2E-%'
      )
  ),
  'analytics_sessions', (SELECT count(*)::int FROM e2e_sessions),
  'analytics_page_views', (
    SELECT count(*)::int FROM public.analytics_page_views pv
    WHERE pv.session_id IN (SELECT id FROM e2e_sessions)
  ),
  'analytics_click_events', (
    SELECT count(*)::int FROM public.analytics_click_events ce
    WHERE ce.session_id IN (SELECT id FROM e2e_sessions)
  ),
  'analytics_wa_clicks', (
    SELECT count(*)::int FROM public.analytics_wa_clicks wc
    WHERE wc.session_id IN (SELECT id FROM e2e_sessions)
  ),
  'api_tokens', (
    SELECT count(*)::int FROM public.organization_omnichannel_api_tokens t
    WHERE t.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
      AND (
        t.token_prefix LIKE 'sk_omni_e2e_%'
        OR t.token_prefix LIKE 'sk_omni_exp_%'
        OR t.token_prefix = 'sk_omni_68ba927d'
      )
  )
)) AS payload;

-- ===========================================================================
-- DELETE — run in one transaction
-- ===========================================================================
BEGIN;

-- 1) Sales activities (+ items & payments via ON DELETE CASCADE)
WITH e2e_leads AS (
  SELECT l.id
  FROM public.leads l
  WHERE l.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
    AND l.web_id = 'klinik-utama-pandawa'
    AND (
      l.gclid LIKE 'E2E-%'
      OR l.fbclid LIKE '%E2E%'
      OR l.ticket_id LIKE 'LEAD-20260616-%'
    )
)
DELETE FROM public.sales_activities sa
WHERE sa.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
  AND (
    sa.lead_id IN (SELECT id FROM e2e_leads)
    OR sa.description LIKE 'Invoice INV-E2E-%'
  );

-- 2) API invoices (sales_invoices.lead_id → SET NULL; delete explicitly)
DELETE FROM public.sales_invoices si
WHERE si.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
  AND si.invoice_number LIKE 'INV-E2E-%';

-- 3) Lead submissions (lead_id → SET NULL on lead delete; remove explicitly)
WITH e2e_leads AS (
  SELECT l.id
  FROM public.leads l
  WHERE l.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
    AND l.web_id = 'klinik-utama-pandawa'
    AND (
      l.gclid LIKE 'E2E-%'
      OR l.fbclid LIKE '%E2E%'
      OR l.ticket_id LIKE 'LEAD-20260616-%'
    )
)
DELETE FROM public.lead_submissions ls
WHERE ls.lead_id IN (SELECT id FROM e2e_leads);

-- 4) Detach leads from analytics sessions (no FK, but keeps orphan refs out)
WITH e2e_leads AS (
  SELECT l.id
  FROM public.leads l
  WHERE l.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
    AND l.web_id = 'klinik-utama-pandawa'
    AND (
      l.gclid LIKE 'E2E-%'
      OR l.fbclid LIKE '%E2E%'
      OR l.ticket_id LIKE 'LEAD-20260616-%'
    )
)
UPDATE public.leads l
SET analytics_session_id = NULL
WHERE l.id IN (SELECT id FROM e2e_leads);

-- 5) Analytics sessions (+ page_views, click_events, wa_clicks via CASCADE)
DELETE FROM public.analytics_sessions s
WHERE s.web_id = 'klinik-utama-pandawa'
  AND (
    s.gclid LIKE 'E2E-%'
    OR s.fbclid LIKE '%E2E%'
    OR s.landing_url LIKE '%E2E-%'
  );

-- 6) Leads (+ status_history, follow_ups, conversion uploads via CASCADE)
DELETE FROM public.leads l
WHERE l.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
  AND l.web_id = 'klinik-utama-pandawa'
  AND (
    l.gclid LIKE 'E2E-%'
    OR l.fbclid LIKE '%E2E%'
    OR l.ticket_id LIKE 'LEAD-20260616-%'
  );

-- 7) Test API tokens (+ rate_limits via CASCADE)
DELETE FROM public.organization_omnichannel_api_tokens t
WHERE t.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
  AND (
    t.token_prefix LIKE 'sk_omni_e2e_%'
    OR t.token_prefix LIKE 'sk_omni_exp_%'
    OR t.token_prefix = 'sk_omni_68ba927d'
  );

COMMIT;

-- ===========================================================================
-- VERIFY — should all be 0
-- ===========================================================================
WITH e2e_leads AS (
  SELECT l.id
  FROM public.leads l
  WHERE l.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
    AND l.web_id = 'klinik-utama-pandawa'
    AND (
      l.gclid LIKE 'E2E-%'
      OR l.fbclid LIKE '%E2E%'
      OR l.ticket_id LIKE 'LEAD-20260616-%'
    )
),
e2e_sessions AS (
  SELECT s.id
  FROM public.analytics_sessions s
  WHERE s.web_id = 'klinik-utama-pandawa'
    AND (
      s.gclid LIKE 'E2E-%'
      OR s.fbclid LIKE '%E2E%'
      OR s.landing_url LIKE '%E2E-%'
    )
)
SELECT 'VERIFY' AS section, jsonb_pretty(jsonb_build_object(
  'e2e_leads_remaining', (SELECT count(*)::int FROM e2e_leads),
  'e2e_sessions_remaining', (SELECT count(*)::int FROM e2e_sessions),
  'e2e_invoices_remaining', (
    SELECT count(*)::int FROM public.sales_invoices si
    WHERE si.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
      AND si.invoice_number LIKE 'INV-E2E-%'
  ),
  'e2e_api_tokens_remaining', (
    SELECT count(*)::int FROM public.organization_omnichannel_api_tokens t
    WHERE t.organization_id = '86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf'::uuid
      AND (
        t.token_prefix LIKE 'sk_omni_e2e_%'
        OR t.token_prefix LIKE 'sk_omni_exp_%'
        OR t.token_prefix = 'sk_omni_68ba927d'
      )
  )
)) AS payload;
