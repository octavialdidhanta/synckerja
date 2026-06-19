-- Reset saldo & ledger finansial org Synckerja ke 0 (data uji / cleanup).
-- Jalankan di Supabase SQL Editor (role postgres / service — bypass RLS).
--
-- Target: Total Current Balance dashboard = 0
-- Sumber saldo: income_transactions, expenses, debt_payments, bank_transfer_journals,
--               bank_account_balance_history (gateway_withdrawal).
--
-- PREVIEW dulu (bagian 1), lalu uncomment COMMIT di bagian 2 jika sudah yakin.

\set org_id '663c9336-8cb6-4a36-9ad9-313126e70a1a'

-- =============================================================================
-- 1) PREVIEW — aman dijalankan berkali-kali
-- =============================================================================

SELECT id, company_name
FROM public.organizations
WHERE id = :'org_id'::uuid;

WITH accounts AS (
  SELECT id, name FROM public.bank_accounts
  WHERE organization_id = :'org_id'::uuid AND is_active = true
)
SELECT
  'income_transactions' AS tbl, COUNT(*)::bigint AS rows, COALESCE(SUM(amount), 0) AS amount_sum
FROM public.income_transactions WHERE organization_id = :'org_id'::uuid
UNION ALL
SELECT 'expenses (active)', COUNT(*), COALESCE(SUM(amount), 0)
FROM public.expenses WHERE organization_id = :'org_id'::uuid AND status = 'active'
UNION ALL
SELECT 'debt_payments', COUNT(*), COALESCE(SUM(payment_amount), 0)
FROM public.debt_payments WHERE organization_id = :'org_id'::uuid
UNION ALL
SELECT 'bank_transfer_journals', COUNT(*), COALESCE(SUM(amount), 0)
FROM public.bank_transfer_journals WHERE organization_id = :'org_id'::uuid
UNION ALL
SELECT 'bank_account_balance_history', COUNT(*), COALESCE(SUM(amount), 0)
FROM public.bank_account_balance_history WHERE organization_id = :'org_id'::uuid
UNION ALL
SELECT 'income_allocations', COUNT(*), COALESCE(SUM(amount), 0)
FROM public.income_allocations WHERE organization_id = :'org_id'::uuid
UNION ALL
SELECT 'bank_statement_lines', COUNT(*), COALESCE(SUM(amount), 0)
FROM public.bank_statement_lines WHERE organization_id = :'org_id'::uuid;

-- =============================================================================
-- 2) RESET — mulai transaksi, cek hasil, lalu COMMIT atau ROLLBACK
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_org_id uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_deleted bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
    RAISE EXCEPTION 'Organization % not found', v_org_id;
  END IF;

  -- Matches / allocations (RESTRICT ke income)
  DELETE FROM public.bank_mutation_matches WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'bank_mutation_matches deleted: %', v_deleted;

  DELETE FROM public.income_allocations WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'income_allocations deleted: %', v_deleted;

  -- Journals & history (RESTRICT ke income/expense)
  DELETE FROM public.bank_transfer_journals WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'bank_transfer_journals deleted: %', v_deleted;

  DELETE FROM public.bank_account_balance_history WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'bank_account_balance_history deleted: %', v_deleted;

  -- Debt payments (dashboard debit Rekening Gaji)
  DELETE FROM public.debt_payments WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'debt_payments deleted: %', v_deleted;

  -- Expenses self-FK + delete
  UPDATE public.expenses
  SET recurring_settlement_for_expense_id = NULL
  WHERE organization_id = v_org_id;

  DELETE FROM public.expenses WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'expenses deleted: %', v_deleted;

  -- Income (termasuk Rp 750k gateway di dashboard)
  DELETE FROM public.income_transactions WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'income_transactions deleted: %', v_deleted;

  -- Bank mutations / statement cache
  DELETE FROM public.bank_statement_lines WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'bank_statement_lines deleted: %', v_deleted;

  -- Stored balance columns (dashboard pakai ledger, tapi diselaraskan)
  UPDATE public.bank_account_balances
  SET balance = 0, updated_at = now()
  WHERE organization_id = v_org_id;

  -- Kembalikan utang ke belum dibayar
  UPDATE public.debts
  SET
    paid_amount = 0,
    remaining_debt = COALESCE(debt_amount, 0),
    status = CASE WHEN COALESCE(debt_amount, 0) > 0 THEN 'active' ELSE status END,
    updated_at = now()
  WHERE organization_id = v_org_id;

  -- Gateway drawer cache (Xendit / Brick)
  UPDATE public.organization_gateway_wallets
  SET
    usable_balance = 0,
    pending_balance = 0,
    total_balance = 0,
    sync_error = NULL,
    synced_at = now(),
    updated_at = now()
  WHERE organization_id = v_org_id;

  UPDATE public.xendit_sub_account_wallets
  SET
    usable_balance = 0,
    pending_balance = 0,
    total_balance = 0,
    sync_error = NULL,
    synced_at = now(),
    updated_at = now()
  WHERE organization_id = v_org_id;

  RAISE NOTICE 'Reset complete for org %', v_org_id;
END $$;

-- Verifikasi saldo terhitung (harus 0 per rekening & total)
WITH accounts AS (
  SELECT ba.id, ba.name
  FROM public.bank_accounts ba
  WHERE ba.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND ba.is_active = true
),
income_sum AS (
  SELECT it.bank_account_id, SUM(it.amount::numeric) AS amt
  FROM public.income_transactions it
  WHERE it.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND it.status IN ('completed', 'pending')
  GROUP BY 1
),
expense_sum AS (
  SELECT e.bank_account_id, SUM(e.amount::numeric) AS amt
  FROM public.expenses e
  WHERE e.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND e.status = 'active'
  GROUP BY 1
),
transfer_out AS (
  SELECT btj.from_bank_account_id AS bank_account_id, SUM(btj.amount::numeric) AS amt
  FROM public.bank_transfer_journals btj
  WHERE btj.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND btj.income_transaction_id IS NULL
  GROUP BY 1
),
transfer_in AS (
  SELECT btj.to_bank_account_id AS bank_account_id, SUM(btj.amount::numeric) AS amt
  FROM public.bank_transfer_journals btj
  WHERE btj.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND btj.income_transaction_id IS NULL
  GROUP BY 1
),
debt_sum AS (
  SELECT dp.payment_method AS bank_account_id, SUM(dp.payment_amount::numeric) AS amt
  FROM public.debt_payments dp
  WHERE dp.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  GROUP BY 1
),
gateway_sum AS (
  SELECT h.bank_account_id, SUM(h.amount::numeric) AS amt
  FROM public.bank_account_balance_history h
  WHERE h.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND h.transaction_type = 'gateway_withdrawal'
  GROUP BY 1
)
SELECT
  a.name,
  COALESCE(i.amt, 0) - COALESCE(e.amt, 0)
    + COALESCE(ti.amt, 0) - COALESCE(to_.amt, 0)
    - COALESCE(d.amt, 0) + COALESCE(g.amt, 0) AS computed_balance
FROM accounts a
LEFT JOIN income_sum i ON i.bank_account_id = a.id
LEFT JOIN expense_sum e ON e.bank_account_id = a.id
LEFT JOIN transfer_out to_ ON to_.bank_account_id = a.id
LEFT JOIN transfer_in ti ON ti.bank_account_id = a.id
LEFT JOIN debt_sum d ON d.bank_account_id = a.id
LEFT JOIN gateway_sum g ON g.bank_account_id = a.id
ORDER BY a.name;

SELECT SUM(
  COALESCE(i.amt, 0) - COALESCE(e.amt, 0)
  + COALESCE(ti.amt, 0) - COALESCE(to_.amt, 0)
  - COALESCE(d.amt, 0) + COALESCE(g.amt, 0)
) AS total_current_balance
FROM (
  SELECT ba.id FROM public.bank_accounts ba
  WHERE ba.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AND ba.is_active = true
) a
LEFT JOIN (
  SELECT bank_account_id, SUM(amount::numeric) AS amt FROM public.income_transactions
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AND status IN ('completed','pending')
  GROUP BY 1
) i ON i.bank_account_id = a.id
LEFT JOIN (
  SELECT bank_account_id, SUM(amount::numeric) AS amt FROM public.expenses
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AND status = 'active'
  GROUP BY 1
) e ON e.bank_account_id = a.id
LEFT JOIN (
  SELECT from_bank_account_id AS bank_account_id, SUM(amount::numeric) AS amt FROM public.bank_transfer_journals
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AND income_transaction_id IS NULL
  GROUP BY 1
) to_ ON to_.bank_account_id = a.id
LEFT JOIN (
  SELECT to_bank_account_id AS bank_account_id, SUM(amount::numeric) AS amt FROM public.bank_transfer_journals
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AND income_transaction_id IS NULL
  GROUP BY 1
) ti ON ti.bank_account_id = a.id
LEFT JOIN (
  SELECT payment_method AS bank_account_id, SUM(payment_amount::numeric) AS amt FROM public.debt_payments
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  GROUP BY 1
) d ON d.bank_account_id = a.id
LEFT JOIN (
  SELECT bank_account_id, SUM(amount::numeric) AS amt FROM public.bank_account_balance_history
  WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AND transaction_type = 'gateway_withdrawal'
  GROUP BY 1
) g ON g.bank_account_id = a.id;

-- Jika verifikasi sudah 0 semua:
COMMIT;
-- Jika belum yakin:
-- ROLLBACK;
