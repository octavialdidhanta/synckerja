-- QA only: force Brick VA settlement when sandbox simulate COMPLETED returns 502.
-- Prerequisite: brick_payment_requests.status = 'paid' (Brick Transaction List = Paid).
-- Run in Supabase SQL Editor (postgres role can execute service_role RPC).

SELECT id, status, brick_payment_id, brick_va_id, sales_activity_payment_id
FROM public.brick_payment_requests
ORDER BY created_at DESC
LIMIT 1;

-- Replace with id from above if needed:
SELECT public.apply_brick_va_settlement(
  p_brick_payment_request_id := (
    SELECT id FROM public.brick_payment_requests ORDER BY created_at DESC LIMIT 1
  ),
  p_brick_payment_id := (
    SELECT brick_payment_id FROM public.brick_payment_requests ORDER BY created_at DESC LIMIT 1
  )
);

SELECT status, completed_at FROM public.brick_payment_requests ORDER BY created_at DESC LIMIT 1;

SELECT sap.transfer_verification_status, it.status, it.deposit_source, it.deposit_confirmed_at
FROM public.brick_payment_requests bpr
JOIN public.sales_activity_payments sap ON sap.id = bpr.sales_activity_payment_id
LEFT JOIN public.income_transactions it ON it.sales_activity_payment_id = sap.id
ORDER BY bpr.created_at DESC
LIMIT 1;
