-- Validasi end-to-end Brick mutasi — org Synckerja test.
-- Jalankan setelah: seed piutang → VA COMPLETED → refresh mutasi → (opsional) konfirmasi match.

\set org_id '663c9336-8cb6-4a36-9ad9-313126e70a1a'

-- 1) Rekening terhubung Brick
SELECT name, bank_name, account_number, brick_link_status, brick_last_sync_at, brick_last_sync_error
FROM public.bank_accounts
WHERE organization_id = :'org_id'::uuid AND brick_link_status = 'linked'
ORDER BY bank_name;

-- 2) Mutasi (non-mock)
SELECT sl.direction, sl.amount, sl.transaction_date, sl.description, sl.reference,
       ba.name AS bank_account, (sl.raw_payload->>'mock') AS mock
FROM public.bank_statement_lines sl
JOIN public.bank_accounts ba ON ba.id = sl.bank_account_id
WHERE sl.organization_id = :'org_id'::uuid
ORDER BY sl.synced_at DESC
LIMIT 20;

-- 3) Kandidat match piutang Brick
SELECT
  it.id AS income_id,
  it.status,
  it.amount,
  it.deposit_confirmed_at,
  it.deposit_source,
  ba.name AS bank_account,
  sap.transfer_verification_status,
  sa.client_name
FROM public.income_transactions it
JOIN public.sales_activity_payments sap ON sap.id = it.sales_activity_payment_id
JOIN public.sales_activities sa ON sa.id = sap.sales_activity_id
LEFT JOIN public.bank_accounts ba ON ba.id = it.bank_account_id
WHERE it.organization_id = :'org_id'::uuid
  AND sa.description ILIKE '%BRICK_SANDBOX%'
ORDER BY it.created_at DESC;

-- 4) Saran match aktif
SELECT m.id, m.status, m.match_score, m.match_reason,
       sl.amount AS mutasi_amount, sl.transaction_date,
       it.amount AS income_amount, it.status AS income_status
FROM public.bank_mutation_matches m
JOIN public.bank_statement_lines sl ON sl.id = m.statement_line_id
JOIN public.income_transactions it ON it.id = m.income_transaction_id
WHERE m.organization_id = :'org_id'::uuid
ORDER BY m.created_at DESC;

-- 5) Setelah konfirmasi: deposit brick_mutasi
SELECT it.id, it.status, it.deposit_source, it.deposit_confirmed_at,
       sap.transfer_verification_status
FROM public.income_transactions it
JOIN public.sales_activity_payments sap ON sap.id = it.sales_activity_payment_id
WHERE it.organization_id = :'org_id'::uuid
  AND it.deposit_source = 'brick_mutasi'
ORDER BY it.deposit_confirmed_at DESC
LIMIT 5;

-- 6) Brick VA v2: payment requests
SELECT id, sales_activity_payment_id, bank_short_code, account_no, status,
       brick_va_id, brick_payment_id, completed_at
FROM public.brick_payment_requests
WHERE organization_id = :'org_id'::uuid
ORDER BY created_at DESC
LIMIT 10;

-- 7) Auto-settlement via webhook (brick_va)
SELECT it.id, it.status, it.deposit_source, sap.transfer_verification_status
FROM public.income_transactions it
JOIN public.sales_activity_payments sap ON sap.id = it.sales_activity_payment_id
WHERE it.organization_id = :'org_id'::uuid
  AND it.deposit_source = 'brick_va'
ORDER BY it.deposit_confirmed_at DESC NULLS LAST
LIMIT 5;
