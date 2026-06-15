-- Income deposit validation report — run in Supabase SQL Editor (org Synckerja test).
-- Paste output sections into QA report.

\set org_id '663c9336-8cb6-4a36-9ad9-313126e70a1a'

-- 1) Schema check
SELECT
  'schema' AS section,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'income_transactions' AND column_name = 'deposit_confirmed_at'
  ) AS has_deposit_confirmed_at,
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'confirm_income_bank_deposit'
  ) AS has_confirm_rpc;

-- 2) Income status distribution
SELECT status, COUNT(*) AS cnt,
       COUNT(*) FILTER (WHERE deposit_confirmed_at IS NOT NULL) AS with_deposit_ts
FROM public.income_transactions
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
GROUP BY status
ORDER BY status;

-- 3) Manual flow candidates (livechat / bank transfer linked to sales payment)
SELECT
  it.id AS income_id,
  it.status,
  it.amount,
  it.customer_name,
  it.payment_method,
  it.deposit_confirmed_at,
  it.deposit_source,
  it.income_type_id IS NOT NULL AND it.category_id IS NOT NULL AND it.bank_account_id IS NOT NULL AS allocation_complete,
  sap.transfer_verification_status AS piutang_verify,
  sap.receipt_url IS NOT NULL AS has_receipt,
  sa.client_name
FROM public.income_transactions it
JOIN public.sales_activity_payments sap ON sap.id = it.sales_activity_payment_id
JOIN public.sales_activities sa ON sa.id = sap.sales_activity_id
WHERE it.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
ORDER BY it.created_at DESC
LIMIT 20;

-- 4) OCTA VIALDI (manual Mandiri path)
SELECT
  sa.id AS activity_id,
  sa.client_name,
  sa.total_amount,
  sa.total_paid_amount,
  sap.id AS payment_id,
  sap.payment_amount,
  sap.payment_method,
  sap.transfer_verification_status,
  it.id AS income_id,
  it.status AS income_status,
  it.deposit_confirmed_at,
  it.deposit_source
FROM public.sales_activities sa
LEFT JOIN public.sales_activity_payments sap ON sap.sales_activity_id = sa.id
LEFT JOIN public.income_transactions it ON it.sales_activity_payment_id = sap.id
WHERE sa.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND sa.client_name ILIKE '%OCTA%VIALDI%'
ORDER BY sap.payment_sequence NULLS LAST;

-- 5) Xendit demo retest
SELECT
  sa.id AS activity_id,
  sa.client_name,
  sap.id AS payment_id,
  sap.payment_amount,
  sap.transfer_verification_status,
  xpr.id AS va_request_id,
  xpr.status AS va_status,
  xpr.account_number,
  it.id AS income_id,
  it.status AS income_status,
  it.deposit_source
FROM public.sales_activities sa
JOIN public.sales_activity_payments sap ON sap.sales_activity_id = sa.id
LEFT JOIN public.xendit_payment_requests xpr ON xpr.sales_activity_payment_id = sap.id
LEFT JOIN public.income_transactions it ON it.sales_activity_payment_id = sap.id
WHERE sa.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND (sa.client_name = 'Klien Demo Xendit VA' OR sa.description ILIKE '%XENDIT_SANDBOX_RETEST%')
ORDER BY sa.created_at DESC, sap.payment_sequence;

-- 6) Bank balances (omnichannel + xendit income flags)
SELECT
  ba.name,
  ba.account_number,
  ba.use_for_omnichannel_income,
  ba.use_for_xendit_income,
  bab.balance
FROM public.bank_accounts ba
LEFT JOIN public.bank_account_balances bab ON bab.bank_account_id = ba.id
WHERE ba.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ba.is_active = true
ORDER BY ba.name;

-- 7) Consistency checks (should return 0 rows each = OK)
SELECT 'completed_without_deposit' AS issue, it.id, it.status, it.deposit_confirmed_at
FROM public.income_transactions it
WHERE it.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND it.status = 'completed'
  AND it.deposit_confirmed_at IS NULL;

SELECT 'deposited_without_deposit_ts' AS issue, it.id, it.status
FROM public.income_transactions it
WHERE it.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND it.status = 'deposited'
  AND it.deposit_confirmed_at IS NULL;

SELECT 'pending_with_deposit_ts' AS issue, it.id, it.status, it.deposit_confirmed_at
FROM public.income_transactions it
WHERE it.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND it.status = 'pending'
  AND it.deposit_confirmed_at IS NOT NULL;
