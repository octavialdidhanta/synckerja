-- Validate Brick disbursement E2E: brick_disbursements, webhook events, debit mutasi.
-- Run after executeDisbursement + callback (or poll).

SELECT
  bd.id,
  bd.reference_id,
  bd.brick_disbursement_id,
  bd.source_type,
  bd.source_id,
  bd.status,
  bd.amount,
  bd.fee_amount,
  bd.completed_at,
  bd.failure_message
FROM public.brick_disbursements bd
WHERE bd.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
ORDER BY bd.created_at DESC
LIMIT 10;

SELECT brick_event_id, event_type, processed_at, error
FROM public.brick_webhook_events
WHERE payload::text ILIKE '%disbursement%'
ORDER BY created_at DESC
LIMIT 10;

SELECT
  bsl.id,
  bsl.external_id,
  bsl.direction,
  bsl.amount,
  bsl.description,
  ba.name AS bank_account
FROM public.bank_statement_lines bsl
JOIN public.bank_accounts ba ON ba.id = bsl.bank_account_id
WHERE bsl.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND bsl.direction = 'debit'
  AND bsl.description ILIKE '%Brick disbursement%'
ORDER BY bsl.synced_at DESC
LIMIT 10;

-- Purchase request paid after completed disbursement
SELECT id, request_title, payment_status, paid_at
FROM public.purchase_requests
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND request_title = 'Brick Disburse QA Vendor';

-- Debt payment reference
SELECT id, notes, transaction_reference, brick_disbursement_id
FROM public.debt_payments
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND notes = 'Brick Disburse QA debt payment'
ORDER BY created_at DESC
LIMIT 5;
