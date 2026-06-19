-- Enrich erp_expense bank statement raw_payload with primary Xendit sub_account_id.

CREATE OR REPLACE FUNCTION public.upsert_bank_statement_from_erp_expense(p_expense_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense public.expenses%ROWTYPE;
  v_bank_id uuid;
  v_external_id text;
  v_description text;
  v_line_id uuid;
  v_provider_label text;
  v_payload jsonb;
  v_txn_at timestamptz;
  v_pr_id uuid;
  v_sub_account_id text;
BEGIN
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_expense.purchase_request_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expense.withdrawal_from_balance IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF v_expense.brick_bank_statement_line_id IS NOT NULL THEN
    RETURN v_expense.brick_bank_statement_line_id;
  END IF;

  v_bank_id := v_expense.bank_account_id;

  IF v_bank_id IS NULL AND v_expense.gateway_wallet_provider IS NOT NULL THEN
    v_bank_id := public.resolve_brick_disbursement_source_bank_account_id(v_expense.organization_id);
    IF v_bank_id IS NULL THEN
      SELECT ba.id INTO v_bank_id
      FROM public.bank_accounts ba
      WHERE ba.organization_id = v_expense.organization_id
        AND ba.is_active = true
      ORDER BY ba.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_bank_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_pr_id := v_expense.purchase_request_id;

  SELECT COALESCE(
    pr.paid_at,
    (
      SELECT xd.completed_at
      FROM public.xendit_disbursements xd
      WHERE xd.source_type = 'purchase_request'
        AND xd.source_id = v_pr_id
        AND xd.status = 'completed'
      ORDER BY xd.completed_at DESC NULLS LAST
      LIMIT 1
    ),
    v_expense.created_at,
    now()
  )
  INTO v_txn_at
  FROM public.purchase_requests pr
  WHERE pr.id = v_pr_id;

  IF v_txn_at IS NULL THEN
    v_txn_at := COALESCE(v_expense.created_at, now());
  END IF;

  v_external_id := 'erp-expense-' || v_expense.id::text;

  IF v_expense.gateway_wallet_provider = 'brick' THEN
    v_provider_label := 'Brick drawer';
  ELSIF v_expense.gateway_wallet_provider = 'xendit' THEN
    v_provider_label := 'Xendit drawer';
    SELECT xsa.xendit_sub_account_id INTO v_sub_account_id
    FROM public.xendit_sub_accounts xsa
    WHERE xsa.organization_id = v_expense.organization_id
      AND xsa.is_primary = true
      AND xsa.xendit_sub_account_id IS NOT NULL
    LIMIT 1;
  ELSE
    v_provider_label := NULL;
  END IF;

  IF v_provider_label IS NOT NULL THEN
    v_description := 'Payment Process — ' || v_provider_label || ' — ' || v_expense.expense_name;
  ELSE
    v_description := 'Payment Process — ' || v_expense.expense_name;
  END IF;

  v_payload := jsonb_build_object(
    'source', 'erp_payment_process',
    'purchase_request_id', v_expense.purchase_request_id,
    'gateway_wallet_provider', v_expense.gateway_wallet_provider
  );
  IF v_sub_account_id IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('sub_account_id', v_sub_account_id);
  END IF;

  SELECT id INTO v_line_id
  FROM public.bank_statement_lines
  WHERE organization_id = v_expense.organization_id
    AND external_id = v_external_id
  LIMIT 1;

  IF v_line_id IS NOT NULL THEN
    UPDATE public.bank_statement_lines
    SET
      amount = v_expense.amount,
      description = v_description,
      expense_id = v_expense.id,
      raw_payload = v_payload,
      transaction_date = v_txn_at,
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
      expense_id,
      synced_at
    ) VALUES (
      v_expense.organization_id,
      v_bank_id,
      v_external_id,
      v_txn_at,
      v_expense.amount,
      'debit',
      v_description,
      v_expense.purchase_request_id::text,
      v_payload,
      'erp_expense',
      v_expense.id,
      now()
    )
    RETURNING id INTO v_line_id;
  END IF;

  UPDATE public.expenses
  SET brick_bank_statement_line_id = v_line_id
  WHERE id = v_expense.id
    AND brick_bank_statement_line_id IS NULL;

  RETURN v_line_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_bank_statement_from_erp_expense(uuid) IS
  'Mirror Payment Process expense as bank_statement_lines debit. Includes sub_account_id for Xendit gateway expenses.';
