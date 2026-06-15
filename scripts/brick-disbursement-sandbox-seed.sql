-- Seed purchase_request + debt_payment for Brick disbursement sandbox QA.
-- Org: 663c9336-8cb6-4a36-9ad9-313126e70a1a (adjust if needed).

-- Approved purchase request pending vendor payment
INSERT INTO public.purchase_requests (
  id,
  organization_id,
  request_title,
  amount_idr,
  status,
  payment_status,
  vendor_bank_code,
  vendor_bank_account_number,
  vendor_bank_account_holder,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'Brick Disburse QA Vendor',
  10000,
  'approved',
  'pending',
  'MANDIRI',
  '12345678',
  'PROD ONLY',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_requests
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND request_title = 'Brick Disburse QA Vendor'
    AND paid_at IS NULL
);

-- Debt payment row for disburse QA (requires existing debt)
-- Replace debt_id with an active debt in your org if this insert fails.
DO $$
DECLARE
  v_debt_id uuid;
  v_payment_id uuid;
BEGIN
  SELECT id INTO v_debt_id
  FROM public.debts
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_debt_id IS NULL THEN
    RAISE NOTICE 'No debt found — create a debt first';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.debt_payments dp
    WHERE dp.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
      AND dp.notes = 'Brick Disburse QA debt payment'
      AND dp.brick_disbursement_id IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.debt_payments (
    organization_id,
    debt_id,
    payment_amount,
    payment_date,
    notes,
    created_at
  ) VALUES (
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    v_debt_id,
    10000,
    current_date,
    'Brick Disburse QA debt payment',
    now()
  )
  RETURNING id INTO v_payment_id;

  RAISE NOTICE 'Created debt_payment % for disburse QA', v_payment_id;
END $$;

SELECT id, request_title, amount_idr, status, payment_status, paid_at
FROM public.purchase_requests
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND request_title = 'Brick Disburse QA Vendor';

SELECT id, payment_amount, notes, brick_disbursement_id, xendit_disbursement_id
FROM public.debt_payments
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND notes = 'Brick Disburse QA debt payment'
ORDER BY created_at DESC
LIMIT 5;
