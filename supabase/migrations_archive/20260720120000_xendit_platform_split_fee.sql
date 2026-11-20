-- Xendit platform split fee: audit columns + net ERP settlement after platform fee.

ALTER TABLE public.xendit_payment_requests
  ADD COLUMN IF NOT EXISTS split_rule_id text NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_status text NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_split_payment_id text NULL;

ALTER TABLE public.xendit_payment_requests
  DROP CONSTRAINT IF EXISTS xendit_payment_requests_platform_fee_status_check;

ALTER TABLE public.xendit_payment_requests
  ADD CONSTRAINT xendit_payment_requests_platform_fee_status_check CHECK (
    platform_fee_status IS NULL
    OR platform_fee_status = ANY (
      ARRAY['pending', 'completed', 'failed', 'not_applicable']::text[]
    )
  );

COMMENT ON COLUMN public.xendit_payment_requests.split_rule_id IS
  'Xendit xenPlatform split rule applied when VA was created.';
COMMENT ON COLUMN public.xendit_payment_requests.platform_fee_status IS
  'Audit status of platform fee split (from split.payment webhook).';
COMMENT ON COLUMN public.xendit_payment_requests.platform_fee_split_payment_id IS
  'Xendit split payment id from split.payment webhook.';

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
  v_income public.income_transactions%ROWTYPE;
  v_gross numeric;
  v_platform_fee integer;
  v_net numeric;
  v_new_status text;
  v_fee_note text;
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

  v_gross := v_sap.payment_amount;
  v_platform_fee := GREATEST(COALESCE(v_req.platform_fee_amount, 0), 0);
  v_net := GREATEST(v_gross - v_platform_fee, 0);
  v_fee_note := CASE
    WHEN v_platform_fee > 0 THEN ' | Platform fee Rp ' || v_platform_fee::text
    ELSE ''
  END;

  UPDATE public.xendit_payment_requests
  SET
    status = 'paid',
    paid_at = now(),
    xendit_payment_id = COALESCE(p_xendit_payment_id, xendit_payment_id),
    updated_at = now()
  WHERE id = v_req.id;

  UPDATE public.sales_activity_payments
  SET
    transfer_verification_status = 'approved',
    transfer_verified_at = now(),
    payment_method = 'xendit_va',
    notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END
      || 'Paid via Xendit VA' || v_fee_note
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
      v_net,
      COALESCE(v_sa.client_name, 'Customer'),
      'xendit_va',
      'Xendit VA - Piutang payment' || v_fee_note,
      v_bank_id,
      v_sap.id,
      'pending',
      v_sap.created_by
    )
    RETURNING id INTO v_income_id;
  ELSE
    UPDATE public.income_transactions
    SET
      amount = v_net,
      bank_account_id = COALESCE(bank_account_id, v_bank_id),
      payment_method = 'xendit_va',
      description = COALESCE(description, 'Xendit VA - Piutang payment') || v_fee_note
    WHERE id = v_income_id;
  END IF;

  SELECT * INTO v_income FROM public.income_transactions WHERE id = v_income_id FOR UPDATE;

  IF v_income.deposit_confirmed_at IS NULL THEN
    v_new_status := public.income_status_after_deposit(
      v_income.income_type_id,
      v_income.category_id,
      COALESCE(v_income.bank_account_id, v_bank_id)
    );

    UPDATE public.income_transactions
    SET
      deposit_confirmed_at = now(),
      deposit_confirmed_by = v_sap.created_by,
      deposit_source = 'xendit_va',
      status = v_new_status,
      bank_account_id = COALESCE(bank_account_id, v_bank_id),
      updated_at = now()
    WHERE id = v_income_id;

    PERFORM public.credit_income_bank_deposit(
      v_income_id,
      COALESCE(v_income.bank_account_id, v_bank_id),
      v_req.organization_id,
      v_net,
      v_sap.created_by,
      'Xendit VA settlement' || v_fee_note
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'income_id', v_income_id,
    'bank_account_id', v_bank_id,
    'gross_amount', v_gross,
    'platform_fee_amount', v_platform_fee,
    'net_amount', v_net
  );
END;
$$;
