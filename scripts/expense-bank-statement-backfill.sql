-- Backfill bank_statement_lines for paid purchase requests that already have expenses
-- but no brick_bank_statement_line_id (pre-migration data).
--
-- Run in Supabase SQL Editor after applying 20260715120000_expense_bank_statement_outgoing.sql

DO $$
DECLARE
  v_expense_id uuid;
  v_line_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_expense_id IN
    SELECT e.id
    FROM public.expenses e
    INNER JOIN public.purchase_requests pr ON pr.id = e.purchase_request_id
    WHERE e.purchase_request_id IS NOT NULL
      AND e.brick_bank_statement_line_id IS NULL
      AND e.withdrawal_from_balance IS NULL
      AND (e.bank_account_id IS NOT NULL OR e.gateway_wallet_provider IS NOT NULL)
      AND pr.payment_status = 'paid'
    ORDER BY e.created_at ASC
  LOOP
    v_line_id := public.upsert_bank_statement_from_erp_expense(v_expense_id);
    IF v_line_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled % expense bank statement lines', v_count;
END $$;

-- Reconcile Brick debits with existing expenses
SELECT public.run_bank_expense_mutation_match_for_org(o.id)
FROM public.organizations o
WHERE EXISTS (
  SELECT 1 FROM public.expenses e
  WHERE e.organization_id = o.id
    AND e.purchase_request_id IS NOT NULL
);

-- Verification
SELECT
  e.expense_name,
  e.amount,
  e.gateway_wallet_provider,
  bsl.direction,
  bsl.amount AS line_amount,
  bsl.origin,
  bsl.description
FROM public.expenses e
LEFT JOIN public.bank_statement_lines bsl ON bsl.expense_id = e.id
WHERE e.purchase_request_id IS NOT NULL
ORDER BY e.created_at DESC
LIMIT 30;
