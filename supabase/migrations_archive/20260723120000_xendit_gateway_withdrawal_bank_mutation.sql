-- Incoming bank mutations for Xendit gateway withdrawal settlement (ERP ledger mirror, like erp_expense).

-- ---------------------------------------------------------------------------
-- Extend bank_statement_lines.origin + link to xendit_gateway_withdrawals
-- ---------------------------------------------------------------------------
ALTER TABLE public.xendit_gateway_withdrawals
  ADD COLUMN IF NOT EXISTS bank_statement_line_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'xendit_gateway_withdrawals_bank_statement_line_id_fkey'
  ) THEN
    ALTER TABLE public.xendit_gateway_withdrawals
      ADD CONSTRAINT xendit_gateway_withdrawals_bank_statement_line_id_fkey
      FOREIGN KEY (bank_statement_line_id)
      REFERENCES public.bank_statement_lines (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_gateway_withdrawals_bank_statement_line
  ON public.xendit_gateway_withdrawals (bank_statement_line_id)
  WHERE bank_statement_line_id IS NOT NULL;

ALTER TABLE public.bank_statement_lines
  DROP CONSTRAINT IF EXISTS bank_statement_lines_origin_check;

ALTER TABLE public.bank_statement_lines
  ADD CONSTRAINT bank_statement_lines_origin_check CHECK (
    origin = ANY (
      ARRAY[
        'brick_sync'::text,
        'brick_va'::text,
        'brick_disbursement'::text,
        'erp_expense'::text,
        'erp_gateway_withdrawal'::text
      ]
    )
  );

-- ---------------------------------------------------------------------------
-- Upsert credit line when gateway withdrawal settles to payout bank
-- ---------------------------------------------------------------------------
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

  v_external_id := 'erp-gateway-withdrawal-' || v_withdrawal.id::text;
  v_description := 'Xendit — tarik ke rekening payout';
  v_txn_at := COALESCE(v_withdrawal.settled_at, v_disb.completed_at, v_withdrawal.updated_at, now());

  v_payload := jsonb_build_object(
    'source', 'xendit_gateway_withdrawal',
    'gateway_wallet_provider', 'xendit',
    'withdrawal_id', v_withdrawal.id,
    'xendit_disbursement_id', v_withdrawal.xendit_disbursement_id,
    'sub_account_id', v_withdrawal.sub_account_id
  );

  SELECT id INTO v_line_id
  FROM public.bank_statement_lines
  WHERE organization_id = v_withdrawal.organization_id
    AND external_id = v_external_id
  LIMIT 1;

  IF v_line_id IS NOT NULL THEN
    UPDATE public.bank_statement_lines
    SET
      amount = v_withdrawal.amount,
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
      v_withdrawal.amount,
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

REVOKE ALL ON FUNCTION public.upsert_bank_statement_from_gateway_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_gateway_withdrawal(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Settlement: also mirror credit into bank_statement_lines
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
  v_amount numeric;
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

  IF v_withdrawal.status = 'completed' AND v_withdrawal.settled_at IS NOT NULL THEN
    v_statement_line_id := public.upsert_bank_statement_from_gateway_withdrawal(v_withdrawal.id);
    RETURN jsonb_build_object(
      'ok', true,
      'already_settled', true,
      'withdrawal_id', v_withdrawal.id,
      'bank_account_id', v_withdrawal.bank_account_id,
      'amount', v_withdrawal.amount,
      'bank_statement_line_id', v_statement_line_id
    );
  END IF;

  v_amount := v_withdrawal.amount;

  INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
  VALUES (v_withdrawal.bank_account_id, v_withdrawal.organization_id, 0)
  ON CONFLICT (bank_account_id) DO NOTHING;

  SELECT balance INTO v_balance_before
  FROM public.bank_account_balances
  WHERE bank_account_id = v_withdrawal.bank_account_id
  FOR UPDATE;

  v_balance_after := COALESCE(v_balance_before, 0) + v_amount;

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
    v_amount,
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
    'amount', v_amount,
    'balance_after', v_balance_after,
    'bank_statement_line_id', v_statement_line_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) TO service_role;

-- Backfill completed withdrawals missing mutation lines
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.xendit_gateway_withdrawals
    WHERE status = 'completed' AND bank_statement_line_id IS NULL
  LOOP
    PERFORM public.upsert_bank_statement_from_gateway_withdrawal(r.id);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.upsert_bank_statement_from_gateway_withdrawal(uuid) IS
  'ERP credit mirror in bank_statement_lines when Xendit gateway withdrawal settles to payout bank.';
