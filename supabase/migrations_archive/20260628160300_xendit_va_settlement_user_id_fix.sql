-- Fix apply_xendit_va_settlement: user_id + bank_account_balance_history columns.
CREATE OR REPLACE FUNCTION public.apply_xendit_va_settlement(
  p_payment_request_id uuid,
  p_xendit_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.xendit_payment_requests%ROWTYPE;
  v_sap public.sales_activity_payments%ROWTYPE;
  v_sa public.sales_activities%ROWTYPE;
  v_bank_id uuid;
  v_income_id uuid;
  v_amount numeric;
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  SELECT * INTO v_req FROM public.xendit_payment_requests WHERE id = p_payment_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'xendit_payment_request_not_found';
  END IF;
  IF v_req.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  SELECT * INTO v_sap FROM public.sales_activity_payments WHERE id = v_req.sales_activity_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_activity_payment_not_found';
  END IF;

  SELECT * INTO v_sa FROM public.sales_activities WHERE id = v_sap.sales_activity_id;

  SELECT ba.id INTO v_bank_id
  FROM public.bank_accounts ba
  WHERE ba.organization_id = v_req.organization_id
    AND ba.use_for_xendit_income = true
    AND ba.is_active = true
  ORDER BY ba.created_at ASC
  LIMIT 1;

  IF v_bank_id IS NULL THEN
    SELECT ba.id INTO v_bank_id
    FROM public.bank_accounts ba
    WHERE ba.organization_id = v_req.organization_id
      AND ba.is_active = true
    ORDER BY ba.created_at ASC
    LIMIT 1;
  END IF;

  v_amount := v_sap.payment_amount;

  UPDATE public.xendit_payment_requests
  SET status = 'paid', paid_at = now(), xendit_payment_id = COALESCE(p_xendit_payment_id, xendit_payment_id), updated_at = now()
  WHERE id = v_req.id;

  UPDATE public.sales_activity_payments
  SET
    transfer_verification_status = 'approved',
    transfer_verified_at = now(),
    payment_method = 'xendit_va',
    notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END || 'Paid via Xendit VA'
  WHERE id = v_sap.id;

  SELECT id INTO v_income_id
  FROM public.income_transactions
  WHERE organization_id = v_req.organization_id
    AND sales_activity_payment_id = v_sap.id
  LIMIT 1;

  IF v_income_id IS NULL THEN
    INSERT INTO public.income_transactions (
      organization_id, user_id, transaction_date, amount, customer_name, payment_method,
      description, bank_account_id, sales_activity_payment_id, status, created_by
    )
    VALUES (
      v_req.organization_id,
      v_sap.created_by,
      CURRENT_DATE,
      v_amount,
      COALESCE(v_sa.client_name, 'Customer'),
      'xendit_va',
      'Xendit VA - Piutang payment',
      v_bank_id,
      v_sap.id,
      'completed',
      v_sap.created_by
    )
    RETURNING id INTO v_income_id;
  ELSE
    UPDATE public.income_transactions
    SET status = 'completed', bank_account_id = COALESCE(bank_account_id, v_bank_id), payment_method = 'xendit_va'
    WHERE id = v_income_id;
  END IF;

  IF v_bank_id IS NOT NULL AND v_amount > 0 THEN
    INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
    VALUES (v_bank_id, v_req.organization_id, 0)
    ON CONFLICT (bank_account_id) DO NOTHING;

    SELECT balance INTO v_balance_before
    FROM public.bank_account_balances
    WHERE bank_account_id = v_bank_id
    FOR UPDATE;

    v_balance_after := COALESCE(v_balance_before, 0) + v_amount;

    UPDATE public.bank_account_balances
    SET balance = v_balance_after, updated_at = now()
    WHERE bank_account_id = v_bank_id;

    INSERT INTO public.bank_account_balance_history (
      bank_account_id, organization_id, transaction_type, transaction_id,
      amount, balance_before, balance_after, description, created_by
    ) VALUES (
      v_bank_id,
      v_req.organization_id,
      'income',
      v_income_id,
      v_amount,
      COALESCE(v_balance_before, 0),
      v_balance_after,
      'Xendit VA settlement',
      v_sap.created_by
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'income_id', v_income_id, 'bank_account_id', v_bank_id);
END;
$$;
