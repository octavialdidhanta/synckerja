-- Store Checkout POS: payment + omnichannel income + bank credit + completed.
-- Cashiers (CS) are usually not Owner/Admin, so this is a dedicated SECURITY DEFINER
-- RPC instead of confirm_income_bank_deposit.

ALTER TABLE public.income_transactions
  DROP CONSTRAINT IF EXISTS income_transactions_deposit_source_check;

ALTER TABLE public.income_transactions
  ADD CONSTRAINT income_transactions_deposit_source_check CHECK (
    deposit_source IS NULL
    OR deposit_source = ANY (
      ARRAY[
        'manual_verification'::text,
        'xendit_va'::text,
        'manual_admin'::text,
        'brick_mutasi'::text,
        'brick_va'::text,
        'store_checkout'::text
      ]
    )
  );

COMMENT ON COLUMN public.income_transactions.deposit_source IS
  'manual_verification | xendit_va | manual_admin | brick_mutasi | brick_va | store_checkout';

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
  IF v_method = 'bank_transfer' THEN
    v_method := 'transfer';
  END IF;
  IF v_method NOT IN ('cash', 'transfer', 'e_wallet') THEN
    RAISE EXCEPTION 'store_checkout_invalid_payment_method';
  END IF;

  v_actor := COALESCE(p_actor, v_activity.created_by);
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'store_checkout_actor_required';
  END IF;

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

  IF v_income_id IS NOT NULL AND v_income_deposit_at IS NOT NULL THEN
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
      v_bank_id,
      NULL,
      NULL,
      v_activity.service_id,
      v_activity.sub_service_id,
      v_payment_id,
      'pending',
      v_actor
    )
    RETURNING id, amount, bank_account_id INTO v_income_id, v_income_amount, v_income_bank;
  END IF;

  IF v_income_deposit_at IS NULL THEN
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
    payment_method = COALESCE(payment_method, v_method),
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
  'Org-scoped store POS: insert payment + income, credit omnichannel bank once, mark completed.';

-- Backfill existing Store Checkout activities that never wrote income.
DO $$
DECLARE
  r record;
  v_actor uuid;
BEGIN
  FOR r IN
    SELECT
      sa.id,
      sa.payment_method,
      sa.organization_id,
      sa.created_by
    FROM public.sales_activities sa
    WHERE sa.activity_type = 'Store Checkout'
      AND COALESCE(sa.total_amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.sales_activity_payments sap
        JOIN public.income_transactions it
          ON it.sales_activity_payment_id = sap.id
        WHERE sap.sales_activity_id = sa.id
          AND it.deposit_confirmed_at IS NOT NULL
      )
  LOOP
    v_actor := COALESCE(
      r.created_by,
      (
        SELECT ur.user_id
        FROM public.user_roles ur
        WHERE ur.organization_id = r.organization_id
          AND ur.role = 'owner'
        ORDER BY ur.created_at ASC
        LIMIT 1
      )
    );

    IF v_actor IS NULL THEN
      RAISE NOTICE 'store checkout backfill skipped %: no actor', r.id;
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.apply_store_checkout_income(r.id, r.payment_method, v_actor);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'store checkout backfill skipped %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
