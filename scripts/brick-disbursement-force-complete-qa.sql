-- QA only: force Brick disbursement completion when callback is delayed (mirror VA force script).
-- Updates brick_disbursements + source entities + debit mutasi manually.

SELECT id, reference_id, brick_disbursement_id, status, source_type, source_id, amount, source_bank_account_id
FROM public.brick_disbursements
ORDER BY created_at DESC
LIMIT 1;

DO $$
DECLARE
  v_row public.brick_disbursements%ROWTYPE;
  v_external_id text;
BEGIN
  SELECT * INTO v_row
  FROM public.brick_disbursements
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No brick_disbursements row found';
  END IF;

  v_external_id := COALESCE(v_row.brick_disbursement_id, v_row.reference_id);

  UPDATE public.brick_disbursements
  SET
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  WHERE id = v_row.id;

  IF v_row.source_bank_account_id IS NOT NULL AND v_external_id IS NOT NULL THEN
    PERFORM public.upsert_bank_statement_from_brick_disbursement_callback(
      v_row.organization_id,
      v_row.source_bank_account_id,
      v_external_id,
      now(),
      v_row.amount,
      'Brick disbursement QA force-complete',
      v_row.reference_id,
      '{}'::jsonb
    );
  END IF;

  IF v_row.source_type = 'purchase_request' THEN
    UPDATE public.purchase_requests
    SET payment_status = 'paid', paid_at = now(), updated_at = now()
    WHERE id = v_row.source_id;
  ELSIF v_row.source_type = 'debt_payment' THEN
    UPDATE public.debt_payments
    SET transaction_reference = v_external_id
    WHERE id = v_row.source_id;
  ELSIF v_row.source_type = 'payroll_calculation' THEN
    UPDATE public.employee_payroll_calculations
    SET payment_status = 'paid', payment_reference = v_external_id, payment_date = current_date
    WHERE id = v_row.source_id;
  END IF;

  RAISE NOTICE 'Force-completed disbursement %', v_row.id;
END $$;

SELECT status, completed_at FROM public.brick_disbursements ORDER BY created_at DESC LIMIT 1;
