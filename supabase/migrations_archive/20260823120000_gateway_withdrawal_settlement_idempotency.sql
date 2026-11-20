-- Idempotent gateway withdrawal settlement + repair duplicate bank credits.

-- ---------------------------------------------------------------------------
-- A. One-time repair: dedupe gateway_withdrawal history rows
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_deleted int := 0;
  v_adjusted int := 0;
BEGIN
  WITH ranked AS (
    SELECT
      h.id,
      h.bank_account_id,
      h.amount,
      ROW_NUMBER() OVER (
        PARTITION BY h.transaction_id
        ORDER BY h.created_at ASC, h.id ASC
      ) AS rn
    FROM public.bank_account_balance_history h
    WHERE h.transaction_type = 'gateway_withdrawal'
      AND h.transaction_id IS NOT NULL
  ),
  dupes AS (
    SELECT id, bank_account_id, amount
    FROM ranked
    WHERE rn > 1
  ),
  adjustments AS (
    SELECT bank_account_id, SUM(amount) AS duplicate_total
    FROM dupes
    GROUP BY bank_account_id
  )
  UPDATE public.bank_account_balances bab
  SET
    balance = bab.balance - adj.duplicate_total,
    updated_at = now()
  FROM adjustments adj
  WHERE bab.bank_account_id = adj.bank_account_id;

  GET DIAGNOSTICS v_adjusted = ROW_COUNT;

  WITH ranked AS (
    SELECT
      h.id,
      ROW_NUMBER() OVER (
        PARTITION BY h.transaction_id
        ORDER BY h.created_at ASC, h.id ASC
      ) AS rn
    FROM public.bank_account_balance_history h
    WHERE h.transaction_type = 'gateway_withdrawal'
      AND h.transaction_id IS NOT NULL
  )
  DELETE FROM public.bank_account_balance_history h
  USING ranked r
  WHERE h.id = r.id
    AND r.rn > 1;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'gateway_withdrawal dedupe: deleted % duplicate history rows, adjusted % balance rows',
    v_deleted, v_adjusted;
END $$;

-- Ensure withdrawal rows reflect existing settlement history.
UPDATE public.xendit_gateway_withdrawals w
SET
  status = 'completed',
  settled_at = COALESCE(w.settled_at, h.first_settled_at),
  updated_at = now()
FROM (
  SELECT
    h.transaction_id AS withdrawal_id,
    MIN(h.created_at) AS first_settled_at
  FROM public.bank_account_balance_history h
  WHERE h.transaction_type = 'gateway_withdrawal'
    AND h.transaction_id IS NOT NULL
  GROUP BY h.transaction_id
) h
WHERE w.id = h.withdrawal_id
  AND (w.status <> 'completed' OR w.settled_at IS NULL);

-- ---------------------------------------------------------------------------
-- B. UNIQUE index (after dedupe)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_babh_gateway_withdrawal_txn_unique
  ON public.bank_account_balance_history (transaction_id)
  WHERE transaction_type = 'gateway_withdrawal' AND transaction_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- C. Idempotent settlement RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_xendit_gateway_withdrawal_settlement(
  p_disbursement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disb public.xendit_disbursements%ROWTYPE;
  v_withdrawal public.xendit_gateway_withdrawals%ROWTYPE;
  v_balance_before numeric;
  v_balance_after numeric;
  v_credit numeric;
  v_statement_line_id uuid;
  v_already_settled boolean := false;
BEGIN
  SELECT * INTO v_disb
  FROM public.xendit_disbursements
  WHERE id = p_disbursement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'xendit_disbursement_not_found';
  END IF;

  IF v_disb.source_type <> 'gateway_withdrawal' THEN
    RAISE EXCEPTION 'not_gateway_withdrawal_disbursement';
  END IF;

  IF v_disb.status <> 'completed' THEN
    RAISE EXCEPTION 'disbursement_not_completed';
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.xendit_gateway_withdrawals
  WHERE id = v_disb.source_id::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'xendit_gateway_withdrawal_not_found';
  END IF;

  v_credit := COALESCE(v_withdrawal.net_amount, v_withdrawal.amount);

  v_already_settled := (
    v_withdrawal.status = 'completed' AND v_withdrawal.settled_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.bank_account_balance_history h
    WHERE h.transaction_type = 'gateway_withdrawal'
      AND h.transaction_id = v_withdrawal.id
  );

  IF v_already_settled THEN
    UPDATE public.xendit_gateway_withdrawals
    SET
      status = 'completed',
      xendit_disbursement_id = COALESCE(xendit_disbursement_id, v_disb.id),
      settled_at = COALESCE(settled_at, now()),
      updated_at = now()
    WHERE id = v_withdrawal.id
      AND (status <> 'completed' OR settled_at IS NULL OR xendit_disbursement_id IS DISTINCT FROM v_disb.id);

    v_statement_line_id := public.upsert_bank_statement_from_gateway_withdrawal(v_withdrawal.id);
    RETURN jsonb_build_object(
      'ok', true,
      'already_settled', true,
      'withdrawal_id', v_withdrawal.id,
      'bank_account_id', v_withdrawal.bank_account_id,
      'amount', v_credit,
      'gross_amount', v_withdrawal.amount,
      'platform_fee_amount', v_withdrawal.platform_fee_amount,
      'bank_statement_line_id', v_statement_line_id
    );
  END IF;

  INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
  VALUES (v_withdrawal.bank_account_id, v_withdrawal.organization_id, 0)
  ON CONFLICT (bank_account_id) DO NOTHING;

  SELECT balance INTO v_balance_before
  FROM public.bank_account_balances
  WHERE bank_account_id = v_withdrawal.bank_account_id
  FOR UPDATE;

  v_balance_after := COALESCE(v_balance_before, 0) + v_credit;

  UPDATE public.bank_account_balances
  SET balance = v_balance_after, updated_at = now()
  WHERE bank_account_id = v_withdrawal.bank_account_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    v_withdrawal.bank_account_id,
    v_withdrawal.organization_id,
    'gateway_withdrawal',
    v_withdrawal.id,
    v_credit,
    COALESCE(v_balance_before, 0),
    v_balance_after,
    'Xendit gateway withdrawal to payout bank',
    v_withdrawal.initiated_by
  );

  UPDATE public.xendit_gateway_withdrawals
  SET
    status = 'completed',
    xendit_disbursement_id = v_disb.id,
    settled_at = now(),
    updated_at = now()
  WHERE id = v_withdrawal.id;

  v_statement_line_id := public.upsert_bank_statement_from_gateway_withdrawal(v_withdrawal.id);

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal.id,
    'bank_account_id', v_withdrawal.bank_account_id,
    'amount', v_credit,
    'gross_amount', v_withdrawal.amount,
    'platform_fee_amount', v_withdrawal.platform_fee_amount,
    'balance_after', v_balance_after,
    'bank_statement_line_id', v_statement_line_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) TO service_role;

COMMENT ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) IS
  'Credits payout bank once per gateway withdrawal; idempotent via history row + settled_at.';
