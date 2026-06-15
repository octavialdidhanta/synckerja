-- Real gateway disbursement: finalize expense only after Xendit/Brick disbursement completes.
-- Skip internal wallet debit when funds already left the gateway via disbursement API.

-- ---------------------------------------------------------------------------
-- Skip ledger-only gateway debit when disbursement already completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_expense_gateway_wallet_debit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usable numeric;
BEGIN
  IF NEW.gateway_wallet_provider IS NULL OR NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.purchase_request_id IS NOT NULL THEN
    IF NEW.gateway_wallet_provider = 'xendit' AND EXISTS (
      SELECT 1 FROM public.xendit_disbursements xd
      WHERE xd.source_type = 'purchase_request'
        AND xd.source_id = NEW.purchase_request_id
        AND xd.status = 'completed'
    ) THEN
      RETURN NEW;
    END IF;

    IF NEW.gateway_wallet_provider = 'brick' AND EXISTS (
      SELECT 1 FROM public.brick_disbursements bd
      WHERE bd.source_type = 'purchase_request'
        AND bd.source_id = NEW.purchase_request_id
        AND bd.status = 'completed'
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT usable_balance INTO v_usable
  FROM public.organization_gateway_wallets
  WHERE organization_id = NEW.organization_id
    AND provider = NEW.gateway_wallet_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gateway wallet not configured for provider %', NEW.gateway_wallet_provider;
  END IF;

  IF v_usable < NEW.amount THEN
    RAISE EXCEPTION 'Insufficient gateway wallet balance (provider %, available %, required %)',
      NEW.gateway_wallet_provider, v_usable, NEW.amount;
  END IF;

  UPDATE public.organization_gateway_wallets
  SET
    usable_balance = usable_balance - NEW.amount,
    total_balance = GREATEST(0, total_balance - NEW.amount),
    updated_at = now()
  WHERE organization_id = NEW.organization_id
    AND provider = NEW.gateway_wallet_provider;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Create expense + bank mutation after gateway disbursement is completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_purchase_request_gateway_payment(p_purchase_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pr public.purchase_requests%ROWTYPE;
  v_type_name text;
  v_category_name text;
  v_expense_id uuid;
  v_has_xendit boolean := false;
  v_has_brick boolean := false;
BEGIN
  SELECT * INTO v_pr FROM public.purchase_requests WHERE id = p_purchase_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase_request_not_found';
  END IF;

  IF v_pr.gateway_wallet_provider IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_gateway_payment');
  END IF;

  IF v_pr.gateway_wallet_provider = 'xendit' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.xendit_disbursements xd
      WHERE xd.source_type = 'purchase_request'
        AND xd.source_id = v_pr.id
        AND xd.status = 'completed'
    ) INTO v_has_xendit;
    IF NOT v_has_xendit THEN
      RAISE EXCEPTION 'xendit_disbursement_not_completed';
    END IF;
  ELSIF v_pr.gateway_wallet_provider = 'brick' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.brick_disbursements bd
      WHERE bd.source_type = 'purchase_request'
        AND bd.source_id = v_pr.id
        AND bd.status = 'completed'
    ) INTO v_has_brick;
    IF NOT v_has_brick THEN
      RAISE EXCEPTION 'brick_disbursement_not_completed';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported_gateway_provider';
  END IF;

  SELECT id INTO v_expense_id
  FROM public.expenses
  WHERE purchase_request_id = v_pr.id
  LIMIT 1;

  IF v_expense_id IS NOT NULL THEN
  ELSE
    SELECT name INTO v_type_name FROM public.expense_types WHERE id = v_pr.expense_type_id;
    SELECT name INTO v_category_name FROM public.expense_categories WHERE id = v_pr.expense_category_id;

    IF v_type_name IS NULL OR v_category_name IS NULL THEN
      RAISE EXCEPTION 'purchase_request_missing_expense_classification';
    END IF;

    INSERT INTO public.expenses (
      organization_id,
      expense_name,
      amount,
      expense_type,
      category,
      expense_type_id,
      expense_category_id,
      department,
      create_date,
      is_recurring,
      description,
      created_by,
      purchase_request_id,
      gateway_wallet_provider,
      bank_account_id,
      withdrawal_from_balance
    ) VALUES (
      v_pr.organization_id,
      v_pr.request_title,
      v_pr.amount_idr,
      v_type_name,
      v_category_name,
      v_pr.expense_type_id,
      v_pr.expense_category_id,
      v_pr.department_name,
      COALESCE(v_pr.paid_at::date, CURRENT_DATE),
      COALESCE(v_pr.is_recurring, false),
      v_pr.description,
      COALESCE(v_pr.paid_by_user_id, v_pr.created_by),
      v_pr.id,
      v_pr.gateway_wallet_provider,
      NULL,
      NULL
    )
    RETURNING id INTO v_expense_id;
  END IF;

  UPDATE public.purchase_requests
  SET
    payment_status = 'paid',
    paid_at = COALESCE(paid_at, now()),
    updated_at = now()
  WHERE id = v_pr.id;

  RETURN jsonb_build_object(
    'ok', true,
    'expense_id', v_expense_id,
    'organization_id', v_pr.organization_id,
    'gateway_wallet_provider', v_pr.gateway_wallet_provider
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) TO service_role;

COMMENT ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) IS
  'After Xendit/Brick disbursement completes: create expense (if missing), mark PR paid. Wallet balance synced via edge function.';
