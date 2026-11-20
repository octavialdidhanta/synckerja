-- Gateway withdrawal: platform fee deduction (gross vs net to bank).

ALTER TABLE public.xendit_gateway_withdrawals
  ADD COLUMN IF NOT EXISTS platform_fee_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS bank_snapshot jsonb NULL;

COMMENT ON COLUMN public.xendit_gateway_withdrawals.amount IS
  'Gross withdrawal requested by tenant (before platform fee).';
COMMENT ON COLUMN public.xendit_gateway_withdrawals.net_amount IS
  'Amount disbursed to payout bank via Xendit (gross - platform_fee_amount).';
COMMENT ON COLUMN public.xendit_gateway_withdrawals.platform_fee_amount IS
  'Synckerja platform fee deducted from gross for this withdrawal.';

UPDATE public.xendit_gateway_withdrawals
SET
  net_amount = amount,
  platform_fee_amount = 0
WHERE net_amount IS NULL;

ALTER TABLE public.xendit_gateway_withdrawals
  ALTER COLUMN net_amount SET NOT NULL;

-- Settlement credits payout bank with net_amount (not gross).
CREATE OR REPLACE FUNCTION public.upsert_bank_statement_from_gateway_withdrawal(p_withdrawal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal public.xendit_gateway_withdrawals%ROWTYPE;
  v_disb public.xendit_disbursements%ROWTYPE;
  v_external_id text;
  v_description text;
  v_line_id uuid;
  v_payload jsonb;
  v_txn_at timestamptz;
  v_credit numeric;
BEGIN
  SELECT * INTO v_withdrawal
  FROM public.xendit_gateway_withdrawals
  WHERE id = p_withdrawal_id;

  IF NOT FOUND OR v_withdrawal.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  IF v_withdrawal.bank_statement_line_id IS NOT NULL THEN
    RETURN v_withdrawal.bank_statement_line_id;
  END IF;

  SELECT * INTO v_disb
  FROM public.xendit_disbursements
  WHERE id = v_withdrawal.xendit_disbursement_id
  LIMIT 1;

  v_credit := COALESCE(v_withdrawal.net_amount, v_withdrawal.amount);
  v_external_id := 'erp-gateway-withdrawal-' || v_withdrawal.id::text;
  v_description := 'Xendit — tarik ke rekening payout';
  v_txn_at := COALESCE(v_withdrawal.settled_at, v_disb.completed_at, v_withdrawal.updated_at, now());

  v_payload := jsonb_build_object(
    'source', 'xendit_gateway_withdrawal',
    'gateway_wallet_provider', 'xendit',
    'withdrawal_id', v_withdrawal.id,
    'xendit_disbursement_id', v_withdrawal.xendit_disbursement_id,
    'sub_account_id', v_withdrawal.sub_account_id,
    'gross_amount', v_withdrawal.amount,
    'platform_fee_amount', v_withdrawal.platform_fee_amount,
    'net_amount', v_credit
  );

  SELECT id INTO v_line_id
  FROM public.bank_statement_lines
  WHERE organization_id = v_withdrawal.organization_id
    AND external_id = v_external_id
  LIMIT 1;

  IF v_line_id IS NOT NULL THEN
    UPDATE public.bank_statement_lines
    SET
      amount = v_credit,
      description = v_description,
      transaction_date = v_txn_at,
      raw_payload = v_payload,
      synced_at = now()
    WHERE id = v_line_id;
  ELSE
    INSERT INTO public.bank_statement_lines (
      organization_id,
      bank_account_id,
      external_id,
      transaction_date,
      amount,
      direction,
      description,
      reference,
      raw_payload,
      origin,
      synced_at
    ) VALUES (
      v_withdrawal.organization_id,
      v_withdrawal.bank_account_id,
      v_external_id,
      v_txn_at,
      v_credit,
      'credit',
      v_description,
      v_withdrawal.id::text,
      v_payload,
      'erp_gateway_withdrawal',
      now()
    )
    RETURNING id INTO v_line_id;
  END IF;

  UPDATE public.xendit_gateway_withdrawals
  SET bank_statement_line_id = v_line_id
  WHERE id = v_withdrawal.id
    AND bank_statement_line_id IS NULL;

  RETURN v_line_id;
END;
$$;

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

  IF v_withdrawal.status = 'completed' AND v_withdrawal.settled_at IS NOT NULL THEN
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
