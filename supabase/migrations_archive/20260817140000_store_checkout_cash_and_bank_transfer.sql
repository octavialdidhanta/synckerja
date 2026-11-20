-- Store Checkout: cash stays off-bank; persist bank_transfer (not transfer).
-- Replaces apply_store_checkout_income / record_store_checkout_income from 20260817120000.

CREATE OR REPLACE FUNCTION public.apply_store_checkout_income(
  p_activity_id uuid,
  p_payment_method text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.sales_activities%ROWTYPE;
  v_payment_id uuid;
  v_income_id uuid;
  v_income_amount numeric;
  v_income_bank uuid;
  v_income_deposit_at timestamptz;
  v_income_status text;
  v_method text;
  v_needs_bank boolean;
  v_amount numeric;
  v_bank_id uuid;
  v_actor uuid;
  v_client_name text;
  v_tx_date date;
  v_description text;
  v_credited boolean := false;
BEGIN
  IF p_activity_id IS NULL THEN
    RAISE EXCEPTION 'store_checkout_not_found';
  END IF;

  SELECT * INTO v_activity
  FROM public.sales_activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_checkout_not_found';
  END IF;

  IF v_activity.activity_type IS DISTINCT FROM 'Store Checkout' THEN
    RAISE EXCEPTION 'store_checkout_wrong_type';
  END IF;

  v_amount := COALESCE(v_activity.total_amount, 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'store_checkout_invalid_amount';
  END IF;

  v_method := lower(btrim(COALESCE(NULLIF(p_payment_method, ''), v_activity.payment_method, 'cash')));
  IF v_method = 'transfer' THEN
    v_method := 'bank_transfer';
  END IF;
  IF v_method NOT IN ('cash', 'bank_transfer', 'e_wallet') THEN
    RAISE EXCEPTION 'store_checkout_invalid_payment_method';
  END IF;

  v_needs_bank := v_method IN ('bank_transfer', 'e_wallet');

  v_actor := COALESCE(p_actor, v_activity.created_by);
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'store_checkout_actor_required';
  END IF;

  IF v_needs_bank THEN
    SELECT ba.id INTO v_bank_id
    FROM public.bank_accounts ba
    WHERE ba.organization_id = v_activity.organization_id
      AND ba.use_for_omnichannel_income = true
      AND ba.is_active = true
    ORDER BY ba.created_at ASC
    LIMIT 1;

    IF v_bank_id IS NULL THEN
      RAISE EXCEPTION 'store_checkout_omnichannel_bank_missing';
    END IF;
  END IF;

  SELECT id INTO v_payment_id
  FROM public.sales_activity_payments
  WHERE sales_activity_id = v_activity.id
  ORDER BY created_at ASC, payment_sequence ASC
  LIMIT 1
  FOR UPDATE;

  IF v_payment_id IS NULL THEN
    INSERT INTO public.sales_activity_payments (
      sales_activity_id,
      organization_id,
      payment_amount,
      payment_date,
      payment_method,
      payment_type,
      payment_sequence,
      notes,
      receipt_url,
      created_by,
      transfer_verification_status,
      transfer_verified_at,
      transfer_verified_by
    )
    VALUES (
      v_activity.id,
      v_activity.organization_id,
      v_amount,
      COALESCE(v_activity.date, CURRENT_DATE),
      v_method,
      'final_payment',
      1,
      'Store checkout',
      NULL,
      v_actor,
      'approved',
      now(),
      v_actor
    )
    RETURNING id INTO v_payment_id;
  END IF;

  SELECT
    it.id,
    it.amount,
    it.bank_account_id,
    it.deposit_confirmed_at,
    it.status
  INTO
    v_income_id,
    v_income_amount,
    v_income_bank,
    v_income_deposit_at,
    v_income_status
  FROM public.income_transactions it
  WHERE it.organization_id = v_activity.organization_id
    AND it.sales_activity_payment_id = v_payment_id
  LIMIT 1
  FOR UPDATE;

  IF v_income_id IS NOT NULL AND (
    NOT v_needs_bank
    OR v_income_deposit_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_recorded', true,
      'income_id', v_income_id,
      'payment_id', v_payment_id,
      'status', v_income_status
    );
  END IF;

  v_client_name := COALESCE(NULLIF(btrim(v_activity.client_name), ''), 'Walk-in');
  v_tx_date := COALESCE(v_activity.date, CURRENT_DATE);
  v_description := 'Store checkout - ' || v_client_name;

  IF v_income_id IS NULL THEN
    INSERT INTO public.income_transactions (
      organization_id,
      user_id,
      transaction_date,
      amount,
      customer_name,
      payment_method,
      description,
      bank_account_id,
      income_type_id,
      category_id,
      service_id,
      sub_service_id,
      sales_activity_payment_id,
      status,
      created_by
    )
    VALUES (
      v_activity.organization_id,
      v_actor,
      v_tx_date,
      v_amount,
      v_client_name,
      v_method,
      v_description,
      CASE WHEN v_needs_bank THEN v_bank_id ELSE NULL END,
      NULL,
      NULL,
      v_activity.service_id,
      v_activity.sub_service_id,
      v_payment_id,
      CASE WHEN v_needs_bank THEN 'pending' ELSE 'completed' END,
      v_actor
    )
    RETURNING id, amount, bank_account_id INTO v_income_id, v_income_amount, v_income_bank;
  END IF;

  IF v_needs_bank AND v_income_deposit_at IS NULL THEN
    UPDATE public.income_transactions
    SET
      bank_account_id = COALESCE(bank_account_id, v_bank_id),
      deposit_confirmed_at = now(),
      deposit_confirmed_by = v_actor,
      deposit_source = 'store_checkout',
      status = 'completed',
      updated_at = now()
    WHERE id = v_income_id;

    PERFORM public.credit_income_bank_deposit(
      v_income_id,
      COALESCE(v_income_bank, v_bank_id),
      v_activity.organization_id,
      COALESCE(v_income_amount, v_amount),
      v_actor,
      'Store checkout deposit'
    );
    v_credited := true;
  END IF;

  UPDATE public.sales_activities
  SET
    payment_method = v_method,
    total_paid_amount = v_amount,
    remaining_amount = 0,
    updated_at = now()
  WHERE id = v_activity.id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_recorded', false,
    'income_id', v_income_id,
    'payment_id', v_payment_id,
    'status', 'completed',
    'credited', v_credited
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_store_checkout_income(
  p_activity_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_type text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'store_checkout_forbidden';
  END IF;

  SELECT organization_id, activity_type
  INTO v_org_id, v_type
  FROM public.sales_activities
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_checkout_not_found';
  END IF;

  IF v_org_id IS NULL OR v_org_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'store_checkout_forbidden';
  END IF;

  IF v_type IS DISTINCT FROM 'Store Checkout' THEN
    RAISE EXCEPTION 'store_checkout_wrong_type';
  END IF;

  RETURN public.apply_store_checkout_income(
    p_activity_id,
    p_payment_method,
    auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_store_checkout_income(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_store_checkout_income(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_store_checkout_income(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.record_store_checkout_income(uuid, text) IS
  'Store POS: cash completed off-bank; bank_transfer/e_wallet credit omnichannel once.';

-- A) Reverse accidental cash credits on Store Checkout, then detach bank.
DO $$
DECLARE
  r record;
  v_balance_before numeric;
  v_balance_after numeric;
  v_has_credit boolean;
  v_has_reversal boolean;
BEGIN
  FOR r IN
    SELECT
      it.id,
      it.amount,
      it.bank_account_id,
      it.organization_id,
      it.created_by
    FROM public.income_transactions it
    JOIN public.sales_activity_payments sap ON sap.id = it.sales_activity_payment_id
    JOIN public.sales_activities sa ON sa.id = sap.sales_activity_id
    WHERE sa.activity_type = 'Store Checkout'
      AND lower(it.payment_method) = 'cash'
      AND it.bank_account_id IS NOT NULL
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.bank_account_balance_history h
      WHERE h.transaction_id = r.id
        AND h.bank_account_id = r.bank_account_id
        AND h.transaction_type = 'income'
    ) INTO v_has_credit;

    SELECT EXISTS (
      SELECT 1
      FROM public.bank_account_balance_history h
      WHERE h.transaction_id = r.id
        AND h.bank_account_id = r.bank_account_id
        AND h.transaction_type = 'manual_adjustment'
        AND h.description = 'Reverse store checkout cash (not deposited)'
    ) INTO v_has_reversal;

    IF v_has_credit AND NOT v_has_reversal THEN
      SELECT balance INTO v_balance_before
      FROM public.bank_account_balances
      WHERE bank_account_id = r.bank_account_id
      FOR UPDATE;

      v_balance_after := COALESCE(v_balance_before, 0) - r.amount;

      UPDATE public.bank_account_balances
      SET balance = v_balance_after, updated_at = now()
      WHERE bank_account_id = r.bank_account_id;

      INSERT INTO public.bank_account_balance_history (
        bank_account_id, organization_id, transaction_type, transaction_id,
        amount, balance_before, balance_after, description, created_by
      ) VALUES (
        r.bank_account_id,
        r.organization_id,
        'manual_adjustment',
        r.id,
        r.amount,
        COALESCE(v_balance_before, 0),
        v_balance_after,
        'Reverse store checkout cash (not deposited)',
        r.created_by
      );
    END IF;

    UPDATE public.income_transactions
    SET
      bank_account_id = NULL,
      deposit_confirmed_at = NULL,
      deposit_confirmed_by = NULL,
      deposit_source = NULL,
      status = 'completed',
      updated_at = now()
    WHERE id = r.id;
  END LOOP;
END $$;

-- B) Canonical payment method: transfer → bank_transfer
UPDATE public.income_transactions
SET payment_method = 'bank_transfer', updated_at = now()
WHERE lower(payment_method) = 'transfer';

UPDATE public.sales_activity_payments
SET payment_method = 'bank_transfer', updated_at = now()
WHERE lower(payment_method) = 'transfer';

UPDATE public.sales_activities
SET payment_method = 'bank_transfer', updated_at = now()
WHERE lower(payment_method) = 'transfer';
