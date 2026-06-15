-- Brick bank mutation sync validation (run after migration 20260628160500).

SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'bank_statement_lines'
) AS has_statement_lines,
EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'bank_mutation_matches'
) AS has_mutation_matches,
EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'brick_link_status'
) AS has_brick_columns,
EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'brick_payment_requests'
) AS has_brick_payment_requests,
EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'brick_webhook_events'
) AS has_brick_webhook_events;

SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.income_transactions'::regclass
  AND conname = 'income_transactions_deposit_source_check';

SELECT
  ba.name,
  ba.brick_link_status,
  ba.brick_last_sync_at,
  ba.bank_statement_balance
FROM public.bank_accounts ba
WHERE ba.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
ORDER BY ba.name;

-- Brick VA v2: payment requests
SELECT id, sales_activity_payment_id, bank_short_code, account_no, expected_amount, status,
       brick_va_id, brick_payment_id, created_at, completed_at
FROM public.brick_payment_requests
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
ORDER BY created_at DESC
LIMIT 10;

-- Brick VA auto-settlement (deposit_source = brick_va)
SELECT it.id, it.status, it.deposit_source, it.deposit_confirmed_at,
       sap.transfer_verification_status
FROM public.income_transactions it
JOIN public.sales_activity_payments sap ON sap.id = it.sales_activity_payment_id
WHERE it.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND it.deposit_source = 'brick_va'
ORDER BY it.deposit_confirmed_at DESC NULLS LAST
LIMIT 5;

-- Recent webhook events
SELECT brick_event_id, event_type, processed_at, error, created_at
FROM public.brick_webhook_events
ORDER BY created_at DESC
LIMIT 10;
