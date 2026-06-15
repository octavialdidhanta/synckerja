-- Roll back purchase requests that were marked paid via ledger-only gateway path
-- (expense + erp_expense bank_statement_line) without a completed Xendit/Brick disbursement.
--
-- Run in Supabase SQL editor. Review SELECT preview first, then uncomment the transaction block.

-- Preview affected purchase requests
SELECT
  pr.id,
  pr.request_title,
  pr.amount_idr,
  pr.gateway_wallet_provider,
  pr.payment_status,
  e.id AS expense_id,
  bsl.id AS bank_statement_line_id,
  bsl.amount AS mutation_amount
FROM public.purchase_requests pr
JOIN public.expenses e ON e.purchase_request_id = pr.id
LEFT JOIN public.bank_statement_lines bsl
  ON bsl.expense_id = e.id AND bsl.origin = 'erp_expense'
WHERE pr.gateway_wallet_provider IN ('xendit', 'brick')
  AND pr.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.xendit_disbursements xd
    WHERE xd.source_type = 'purchase_request'
      AND xd.source_id = pr.id
      AND xd.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.brick_disbursements bd
    WHERE bd.source_type = 'purchase_request'
      AND bd.source_id = pr.id
      AND bd.status = 'completed'
  );

/*
BEGIN;

-- Restore gateway wallet balances debited by ledger-only expenses
UPDATE public.organization_gateway_wallets ogw
SET
  usable_balance = ogw.usable_balance + sub.total_amount,
  total_balance = ogw.total_balance + sub.total_amount,
  updated_at = now()
FROM (
  SELECT e.organization_id, e.gateway_wallet_provider AS provider, SUM(e.amount) AS total_amount
  FROM public.expenses e
  JOIN public.purchase_requests pr ON pr.id = e.purchase_request_id
  WHERE pr.gateway_wallet_provider IN ('xendit', 'brick')
    AND pr.payment_status = 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM public.xendit_disbursements xd
      WHERE xd.source_type = 'purchase_request' AND xd.source_id = pr.id AND xd.status = 'completed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.brick_disbursements bd
      WHERE bd.source_type = 'purchase_request' AND bd.source_id = pr.id AND bd.status = 'completed'
    )
  GROUP BY e.organization_id, e.gateway_wallet_provider
) sub
WHERE ogw.organization_id = sub.organization_id
  AND ogw.provider = sub.provider;

DELETE FROM public.bank_mutation_matches bmm
USING public.bank_statement_lines bsl, public.expenses e, public.purchase_requests pr
WHERE bmm.statement_line_id = bsl.id
  AND bsl.expense_id = e.id
  AND e.purchase_request_id = pr.id
  AND pr.gateway_wallet_provider IN ('xendit', 'brick')
  AND bsl.origin = 'erp_expense'
  AND NOT EXISTS (
    SELECT 1 FROM public.xendit_disbursements xd
    WHERE xd.source_type = 'purchase_request' AND xd.source_id = pr.id AND xd.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.brick_disbursements bd
    WHERE bd.source_type = 'purchase_request' AND bd.source_id = pr.id AND bd.status = 'completed'
  );

DELETE FROM public.bank_statement_lines bsl
USING public.expenses e, public.purchase_requests pr
WHERE bsl.expense_id = e.id
  AND e.purchase_request_id = pr.id
  AND pr.gateway_wallet_provider IN ('xendit', 'brick')
  AND bsl.origin = 'erp_expense'
  AND NOT EXISTS (
    SELECT 1 FROM public.xendit_disbursements xd
    WHERE xd.source_type = 'purchase_request' AND xd.source_id = pr.id AND xd.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.brick_disbursements bd
    WHERE bd.source_type = 'purchase_request' AND bd.source_id = pr.id AND bd.status = 'completed'
  );

DELETE FROM public.expenses e
USING public.purchase_requests pr
WHERE e.purchase_request_id = pr.id
  AND pr.gateway_wallet_provider IN ('xendit', 'brick')
  AND pr.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.xendit_disbursements xd
    WHERE xd.source_type = 'purchase_request' AND xd.source_id = pr.id AND xd.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.brick_disbursements bd
    WHERE bd.source_type = 'purchase_request' AND bd.source_id = pr.id AND bd.status = 'completed'
  );

UPDATE public.purchase_requests pr
SET
  payment_status = 'pending',
  paid_at = NULL,
  paid_by_user_id = NULL,
  updated_at = now()
WHERE pr.gateway_wallet_provider IN ('xendit', 'brick')
  AND pr.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.xendit_disbursements xd
    WHERE xd.source_type = 'purchase_request' AND xd.source_id = pr.id AND xd.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.brick_disbursements bd
    WHERE bd.source_type = 'purchase_request' AND bd.source_id = pr.id AND bd.status = 'completed'
  );

COMMIT;
*/
