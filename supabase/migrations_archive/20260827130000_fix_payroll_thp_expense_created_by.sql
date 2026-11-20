-- Fix created_by fallback: org role is on user_roles, not user_organizations.

CREATE OR REPLACE FUNCTION public.finalize_payroll_run_thp_expense(
  p_run_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run record;
  v_settings record;
  v_expense_id uuid;
  v_amount numeric := 0;
  v_employee_count integer := 0;
  v_unpaid integer := 0;
  v_has_xendit boolean := false;
  v_type_id uuid;
  v_type_name text;
  v_category_id uuid;
  v_category_name text;
  v_created_by uuid;
  v_reference text;
BEGIN
  SELECT pr.id, pr.organization_id, pr.status, pr.run_name, pr.paid_by
  INTO v_run
  FROM public.payroll_runs pr
  WHERE pr.id = p_run_id;

  IF v_run IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'run_not_found');
  END IF;

  IF v_run.status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'run_not_paid');
  END IF;

  SELECT id INTO v_expense_id
  FROM public.expenses
  WHERE payroll_run_id = p_run_id
  LIMIT 1;

  IF v_expense_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'expense_id', v_expense_id,
      'skipped', true,
      'reason', 'already_posted'
    );
  END IF;

  SELECT * INTO v_settings
  FROM public.organization_payroll_expense_settings
  WHERE organization_id = v_run.organization_id;

  IF NOT COALESCE(v_settings.is_enabled, false) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'expense_post_disabled');
  END IF;

  SELECT COUNT(*)::integer
  INTO v_unpaid
  FROM public.employee_payroll_calculations c
  WHERE c.payroll_run_id = p_run_id
    AND c.payment_status IS DISTINCT FROM 'paid';

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'calculations_not_all_paid');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.xendit_disbursements xd
    JOIN public.employee_payroll_calculations c ON c.id = xd.source_id
    WHERE xd.source_type = 'payroll_calculation'
      AND c.payroll_run_id = p_run_id
      AND xd.status = 'completed'
  ) INTO v_has_xendit;

  IF NOT v_has_xendit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'xendit_disbursement_not_completed');
  END IF;

  SELECT COALESCE(SUM(c.take_home_pay), 0), COUNT(*)::integer
  INTO v_amount, v_employee_count
  FROM public.employee_payroll_calculations c
  WHERE c.payroll_run_id = p_run_id
    AND c.payment_status = 'paid';

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'amount_zero', 'amount', 0);
  END IF;

  SELECT et.id, et.name
  INTO v_type_id, v_type_name
  FROM public.expense_types et
  WHERE lower(trim(et.name)) = lower(trim(COALESCE(v_settings.expense_type_name, 'Fixed Expenses')))
    AND COALESCE(et.is_active, true)
    AND (et.organization_id = v_run.organization_id OR et.organization_id IS NULL)
  ORDER BY CASE WHEN et.organization_id = v_run.organization_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'missing_expense_type',
      'expense_type_name', COALESCE(v_settings.expense_type_name, 'Fixed Expenses')
    );
  END IF;

  SELECT ec.id, ec.name
  INTO v_category_id, v_category_name
  FROM public.expense_categories ec
  WHERE lower(trim(ec.name)) = lower(trim(COALESCE(v_settings.expense_category_name, 'Gaji Karyawan Tetap')))
    AND COALESCE(ec.is_active, true)
    AND (ec.organization_id = v_run.organization_id OR ec.organization_id IS NULL)
    AND (ec.expense_type_id IS NULL OR ec.expense_type_id = v_type_id)
  ORDER BY CASE WHEN ec.organization_id = v_run.organization_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_category_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'missing_expense_category',
      'expense_category_name', COALESCE(v_settings.expense_category_name, 'Gaji Karyawan Tetap')
    );
  END IF;

  v_created_by := COALESCE(p_actor_user_id, v_run.paid_by);
  IF v_created_by IS NULL THEN
    SELECT ur.user_id INTO v_created_by
    FROM public.user_roles ur
    WHERE ur.organization_id = v_run.organization_id
      AND ur.role IN ('owner', 'admin')
    ORDER BY CASE ur.role WHEN 'owner' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_created_by IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_created_by');
  END IF;

  v_reference := format('synckerja:%s:payroll_expense:%s', v_run.organization_id, p_run_id);

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
    payroll_run_id,
    gateway_wallet_provider,
    bank_account_id,
    withdrawal_from_balance,
    transaction_reference,
    status
  )
  SELECT
    v_run.organization_id,
    format('Payroll %s — THP', v_run.run_name),
    v_amount,
    v_type_name,
    v_category_name,
    v_type_id,
    v_category_id,
    COALESCE(v_settings.department, 'Finance'),
    COALESCE(pp.pay_date::date, CURRENT_DATE),
    false,
    format('Auto-post dari payroll run · %s karyawan', v_employee_count),
    v_created_by,
    p_run_id,
    'xendit',
    NULL,
    NULL,
    v_reference,
    'active'
  FROM public.payroll_runs pr
  JOIN public.payroll_periods pp ON pp.id = pr.payroll_period_id
  WHERE pr.id = p_run_id
  RETURNING id INTO v_expense_id;

  RETURN jsonb_build_object(
    'ok', true,
    'expense_id', v_expense_id,
    'amount', v_amount,
    'employee_count', v_employee_count,
    'organization_id', v_run.organization_id
  );
END;
$$;
