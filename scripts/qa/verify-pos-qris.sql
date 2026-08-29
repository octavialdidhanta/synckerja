-- QA: POS QRIS payment flow (run after sandbox payment or manual settlement)
-- Replace placeholders: :org_id, :pending_id, :payment_request_id

-- 1) Pending checkout exists and is active
SELECT id, status, expires_at, xendit_payment_request_id, sales_activity_id
FROM public.pos_pending_checkouts
WHERE organization_id = :'org_id'
ORDER BY created_at DESC
LIMIT 5;

-- 2) Xendit payment request row for QRIS
SELECT id, payment_type, status, expected_amount, platform_fee_amount, qr_string IS NOT NULL AS has_qr,
       pos_pending_checkout_id, sales_activity_id, expires_at, paid_at
FROM public.xendit_payment_requests
WHERE organization_id = :'org_id'
  AND payment_type = 'qris'
ORDER BY created_at DESC
LIMIT 5;

-- 3) After paid: sales activity + income (net = gross - platform fee)
SELECT
  sa.id,
  sa.payment_method,
  sa.total_paid_amount,
  sap.id AS payment_id,
  it.amount AS income_net,
  xpr.expected_amount AS gross,
  xpr.platform_fee_amount AS fee
FROM public.xendit_payment_requests xpr
JOIN public.sales_activities sa ON sa.id = xpr.sales_activity_id
JOIN public.sales_activity_payments sap ON sap.sales_activity_id = sa.id
LEFT JOIN public.income_transactions it ON it.sales_activity_payment_id = sap.id
WHERE xpr.id = :'payment_request_id';

-- 4) QRIS channel seeded
SELECT id, category, slug, legacy_payment_method, is_active
FROM public.pos_payment_method_channels
WHERE organization_id = :'org_id'
  AND slug = 'qris';

-- 5) Shift report includes qris bucket (when shift closed)
-- SELECT payment_methods FROM public.pos_shift_detail(:shift_id);

-- 6) Expire stale pending (service role / cron)
-- SELECT public.pos_expire_stale_pending_checkouts();
