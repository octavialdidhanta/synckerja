-- Income deposit validation: deposited status, audit columns, confirm RPC, Xendit settlement alignment.

-- 1) Extend status + audit columns
ALTER TABLE public.income_transactions
  DROP CONSTRAINT IF EXISTS income_transactions_status_check;

ALTER TABLE public.income_transactions
  ADD COLUMN IF NOT EXISTS deposit_confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deposit_confirmed_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposit_source text NULL;

ALTER TABLE public.income_transactions
  ADD CONSTRAINT income_transactions_status_check CHECK (
    status = ANY (ARRAY['completed'::text, 'pending'::text, 'cancelled'::text, 'deposited'::text])
  );

ALTER TABLE public.income_transactions
  DROP CONSTRAINT IF EXISTS income_transactions_deposit_source_check;

ALTER TABLE public.income_transactions
  ADD CONSTRAINT income_transactions_deposit_source_check CHECK (
    deposit_source IS NULL
    OR deposit_source = ANY (
      ARRAY['manual_verification'::text, 'xendit_va'::text, 'manual_admin'::text]
    )
  );

COMMENT ON COLUMN public.income_transactions.deposit_confirmed_at IS
  'When bank deposit was confirmed (piutang OK or Xendit settlement). Balance credits at this moment.';
COMMENT ON COLUMN public.income_transactions.deposit_source IS
  'manual_verification | xendit_va | manual_admin';

-- 2) Helpers
CREATE OR REPLACE FUNCTION public.income_allocation_is_complete(
  p_income_type_id uuid,
  p_category_id uuid,
  p_bank_account_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_income_type_id IS NOT NULL
    AND btrim(p_income_type_id::text) <> ''
    AND p_category_id IS NOT NULL
    AND btrim(p_category_id::text) <> ''
    AND p_bank_account_id IS NOT NULL
    AND btrim(p_bank_account_id::text) <> '';
$$;

CREATE OR REPLACE FUNCTION public.income_status_after_deposit(
  p_income_type_id uuid,
  p_category_id uuid,
  p_bank_account_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN public.income_allocation_is_complete(p_income_type_id, p_category_id, p_bank_account_id)
      THEN 'completed'
    ELSE 'deposited'
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_is_org_owner_or_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_organization_id
      AND ur.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_org_owner_or_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_org_owner_or_admin(uuid) TO authenticated;

-- 3) Idempotent bank credit for confirmed deposit
CREATE OR REPLACE FUNCTION public.credit_income_bank_deposit(
  p_income_id uuid,
  p_bank_account_id uuid,
  p_organization_id uuid,
  p_amount numeric,
  p_created_by uuid,
  p_description text DEFAULT 'Income deposit confirmed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  IF p_bank_account_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
  VALUES (p_bank_account_id, p_organization_id, 0)
  ON CONFLICT (bank_account_id) DO NOTHING;

  SELECT balance INTO v_balance_before
  FROM public.bank_account_balances
  WHERE bank_account_id = p_bank_account_id
  FOR UPDATE;

  v_balance_after := COALESCE(v_balance_before, 0) + p_amount;

  UPDATE public.bank_account_balances
  SET balance = v_balance_after, updated_at = now()
  WHERE bank_account_id = p_bank_account_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id, organization_id, transaction_type, transaction_id,
    amount, balance_before, balance_after, description, created_by
  ) VALUES (
    p_bank_account_id,
    p_organization_id,
    'income',
    p_income_id,
    p_amount,
    COALESCE(v_balance_before, 0),
    v_balance_after,
    p_description,
    p_created_by
  );
END;
$$;

-- 4) Confirm deposit (manual piutang OK / admin)
CREATE OR REPLACE FUNCTION public.confirm_income_bank_deposit(
  p_income_id uuid,
  p_deposit_source text DEFAULT 'manual_verification',
  p_confirmed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income public.income_transactions%ROWTYPE;
  v_actor uuid;
  v_source text;
  v_new_status text;
BEGIN
  v_actor := COALESCE(p_confirmed_by, auth.uid());
  v_source := COALESCE(NULLIF(btrim(p_deposit_source), ''), 'manual_verification');

  SELECT * INTO v_income
  FROM public.income_transactions
  WHERE id = p_income_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'income_transaction_not_found';
  END IF;

  IF v_income.status = 'cancelled' THEN
    RAISE EXCEPTION 'income_transaction_cancelled';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(v_income.organization_id) THEN
    RAISE EXCEPTION 'income_deposit_confirm_forbidden';
  END IF;

  IF v_income.deposit_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'income_id', v_income.id,
      'status', v_income.status
    );
  END IF;

  IF v_income.bank_account_id IS NULL THEN
    RAISE EXCEPTION 'income_bank_account_required';
  END IF;

  v_new_status := public.income_status_after_deposit(
    v_income.income_type_id,
    v_income.category_id,
    v_income.bank_account_id
  );

  UPDATE public.income_transactions
  SET
    deposit_confirmed_at = now(),
    deposit_confirmed_by = v_actor,
    deposit_source = v_source,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_income.id;

  PERFORM public.credit_income_bank_deposit(
    v_income.id,
    v_income.bank_account_id,
    v_income.organization_id,
    v_income.amount,
    COALESCE(v_actor, v_income.created_by),
    'Income deposit confirmed'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'income_id', v_income.id,
    'status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_income_bank_deposit(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_income_bank_deposit(uuid, text, uuid) TO authenticated;

-- 5) Reject linked income when piutang verification rejected
CREATE OR REPLACE FUNCTION public.cancel_income_for_payment_rejection(p_sales_activity_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.income_transactions
  SET status = 'cancelled', updated_at = now()
  WHERE sales_activity_payment_id = p_sales_activity_payment_id
    AND deposit_confirmed_at IS NULL
    AND status IN ('pending', 'deposited');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_income_for_payment_rejection(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_income_for_payment_rejection(uuid) TO authenticated;

-- 6) Xendit settlement — deposited + deposit audit; credit once
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
  v_amount numeric;
  v_new_status text;
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
      'pending',
      v_sap.created_by
    )
    RETURNING id INTO v_income_id;
  ELSE
    UPDATE public.income_transactions
    SET
      bank_account_id = COALESCE(bank_account_id, v_bank_id),
      payment_method = 'xendit_va'
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
      v_amount,
      v_sap.created_by,
      'Xendit VA settlement'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'income_id', v_income_id, 'bank_account_id', v_bank_id);
END;
$$;

-- 7) Backfill: completed without allocation → deposited; mark legacy deposits
UPDATE public.income_transactions it
SET
  status = 'deposited',
  deposit_confirmed_at = COALESCE(it.deposit_confirmed_at, it.updated_at, it.created_at),
  deposit_source = COALESCE(it.deposit_source, 'manual_admin')
WHERE it.status = 'completed'
  AND NOT public.income_allocation_is_complete(it.income_type_id, it.category_id, it.bank_account_id);

UPDATE public.income_transactions it
SET
  deposit_confirmed_at = COALESCE(it.deposit_confirmed_at, it.updated_at, it.created_at),
  deposit_source = COALESCE(it.deposit_source, 'manual_admin')
WHERE it.status = 'completed'
  AND public.income_allocation_is_complete(it.income_type_id, it.category_id, it.bank_account_id)
  AND it.deposit_confirmed_at IS NULL;
