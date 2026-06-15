-- Reset stuck/failed Brick disbursement QA rows before retry.
-- Run in Supabase SQL Editor, then deploy brick-bank-api and retry Pay via Brick.

-- 1) See last failures
SELECT id, reference_id, status, failure_message, amount, source_type, source_id, created_at
FROM brick_disbursements
ORDER BY created_at DESC
LIMIT 10;

-- 2) Unstick purchase requests left in processing (failed disbursement or no active disbursement)
UPDATE purchase_requests pr
SET payment_status = 'pending', updated_at = now()
WHERE pr.payment_status = 'processing'
  AND pr.paid_at IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM brick_disbursements bd
      WHERE bd.source_type = 'purchase_request'
        AND bd.source_id = pr.id
        AND bd.status = 'failed'
    )
    OR NOT EXISTS (
      SELECT 1 FROM brick_disbursements bd
      WHERE bd.source_type = 'purchase_request'
        AND bd.source_id = pr.id
        AND bd.status IN ('pending', 'processing', 'completed')
    )
  );

-- 3) Optional: mark failed disbursements so retry uses fresh reference id
-- (executeBrickDisbursement reuses failed rows automatically)

-- 4) Optional: set sandbox-friendly amount on QA vendor row
UPDATE purchase_requests
SET amount_idr = 10000, vendor_bank_code = 'MANDIRI',
    vendor_bank_account_number = '12345678',
    vendor_bank_account_holder = 'PROD ONLY',
    updated_at = now()
WHERE request_title LIKE '%vendor utama (Brick)%'
  AND paid_at IS NULL;

-- 5) Verify sandbox vendor row
SELECT id, request_title, amount_idr, payment_status, vendor_bank_code,
       vendor_bank_account_number, vendor_bank_account_holder
FROM purchase_requests
WHERE request_title LIKE '%vendor utama (Brick)%'
  AND paid_at IS NULL
ORDER BY created_at DESC
LIMIT 3;
