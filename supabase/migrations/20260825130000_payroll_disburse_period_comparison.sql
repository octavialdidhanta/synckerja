-- Extend payroll disburse preview with calendar previous-period THP comparison.

CREATE OR REPLACE FUNCTION public.get_payroll_disburse_preview(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run record;
  v_employees jsonb := '[]'::jsonb;
  v_row record;
  v_issues jsonb;
  v_snapshot jsonb;
  v_live_bank text;
  v_live_acct text;
  v_live_holder text;
  v_count_pending integer := 0;
  v_count_invalid integer := 0;
  v_count_processing integer := 0;
  v_count_failed integer := 0;
  v_count_paid integer := 0;
  v_total_thp_pending numeric := 0;
  v_total_thp_all numeric := 0;
  v_current_period record;
  v_prev_period record;
  v_prev_run record;
  v_prev_total_thp numeric := 0;
  v_prev_employee_count integer := 0;
  v_matched_count integer := 0;
  v_matched_prev_thp numeric := 0;
  v_matched_curr_thp numeric := 0;
  v_delta_amount numeric := 0;
  v_delta_percent numeric := NULL;
  v_matched_delta_amount numeric := 0;
  v_matched_delta_percent numeric := NULL;
  v_severity text := 'unavailable';
  v_requires_ack boolean := false;
  v_period_comparison jsonb;
BEGIN
  SELECT pr.id, pr.organization_id, pr.status, pr.run_name
  INTO v_run
  FROM public.payroll_runs pr
  WHERE pr.id = p_run_id;

  IF v_run IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Payroll run not found');
  END IF;

  IF NOT (v_run.organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT
      c.id AS calculation_id,
      c.take_home_pay,
      c.payment_status,
      c.payout_snapshot,
      e.full_name AS employee_name,
      e.employee_id AS employee_code,
      epi.bank_name AS live_bank_name,
      epi.bank_account_number AS live_account_number,
      epi.bank_account_holder AS live_account_holder
    FROM public.employee_payroll_calculations c
    JOIN public.employees e ON e.id = c.employee_id
    JOIN public.employee_payroll_info epi ON epi.id = c.employee_payroll_info_id
    WHERE c.payroll_run_id = p_run_id
    ORDER BY e.full_name NULLS LAST, e.employee_id
  LOOP
    v_snapshot := COALESCE(v_row.payout_snapshot, '{}'::jsonb);
    v_issues := '[]'::jsonb;

    IF COALESCE(trim(v_snapshot->>'account_number'), '') = ''
      OR COALESCE(trim(v_snapshot->>'account_holder'), '') = ''
      OR COALESCE(trim(v_snapshot->>'bank_name'), '') = '' THEN
      v_issues := v_issues || to_jsonb('missing_bank'::text);
    END IF;

    IF COALESCE(v_row.take_home_pay, 0) <= 0 THEN
      v_issues := v_issues || to_jsonb('invalid_amount'::text);
    END IF;

    IF v_row.payment_status = 'processing' THEN
      v_issues := v_issues || to_jsonb('already_processing'::text);
      v_count_processing := v_count_processing + 1;
    ELSIF v_row.payment_status = 'failed' THEN
      v_issues := v_issues || to_jsonb('failed_previous'::text);
      v_count_failed := v_count_failed + 1;
    ELSIF v_row.payment_status = 'paid' THEN
      v_issues := v_issues || to_jsonb('already_paid'::text);
      v_count_paid := v_count_paid + 1;
    END IF;

    v_live_bank := COALESCE(trim(v_row.live_bank_name), '');
    v_live_acct := COALESCE(trim(v_row.live_account_number), '');
    v_live_holder := COALESCE(trim(v_row.live_account_holder), '');
    IF v_live_bank <> COALESCE(trim(v_snapshot->>'bank_name'), '')
      OR v_live_acct <> COALESCE(trim(v_snapshot->>'account_number'), '')
      OR v_live_holder <> COALESCE(trim(v_snapshot->>'account_holder'), '') THEN
      v_issues := v_issues || to_jsonb('snapshot_drift'::text);
    END IF;

    IF v_row.payment_status = 'pending'
      AND jsonb_array_length(v_issues) = 0 THEN
      v_count_pending := v_count_pending + 1;
      v_total_thp_pending := v_total_thp_pending + COALESCE(v_row.take_home_pay, 0);
    ELSIF v_row.payment_status = 'pending' THEN
      v_count_invalid := v_count_invalid + 1;
    END IF;

    v_total_thp_all := v_total_thp_all + COALESCE(v_row.take_home_pay, 0);

    v_employees := v_employees || jsonb_build_array(jsonb_build_object(
      'calculation_id', v_row.calculation_id,
      'employee_name', v_row.employee_name,
      'employee_code', v_row.employee_code,
      'bank_name', v_snapshot->>'bank_name',
      'account_number', v_snapshot->>'account_number',
      'account_holder', v_snapshot->>'account_holder',
      'take_home_pay', COALESCE(v_row.take_home_pay, 0),
      'payment_status', v_row.payment_status,
      'issues', v_issues,
      'eligible', (v_row.payment_status = 'pending' AND jsonb_array_length(v_issues) = 0)
    ));
  END LOOP;

  SELECT pp.id, pp.period_name, pp.start_date
  INTO v_current_period
  FROM public.payroll_runs pr
  JOIN public.payroll_periods pp ON pp.id = pr.payroll_period_id
  WHERE pr.id = p_run_id;

  SELECT pp.id, pp.period_name, pp.start_date
  INTO v_prev_period
  FROM public.payroll_periods pp
  WHERE pp.organization_id = v_run.organization_id
    AND pp.start_date < v_current_period.start_date
  ORDER BY pp.start_date DESC
  LIMIT 1;

  IF v_prev_period IS NULL THEN
    v_period_comparison := jsonb_build_object(
      'available', false,
      'severity', 'unavailable',
      'requires_review_ack', false
    );
  ELSE
    SELECT pr.id, pr.status
    INTO v_prev_run
    FROM public.payroll_runs pr
    WHERE pr.payroll_period_id = v_prev_period.id
      AND pr.status IN ('paid', 'calculated')
    ORDER BY
      CASE pr.status WHEN 'paid' THEN 0 WHEN 'calculated' THEN 1 ELSE 2 END,
      COALESCE(pr.paid_at, pr.calculated_at, pr.created_at) DESC
    LIMIT 1;

    IF v_prev_run IS NULL THEN
      v_period_comparison := jsonb_build_object(
        'available', false,
        'previous_period_id', v_prev_period.id,
        'previous_period_name', v_prev_period.period_name,
        'severity', 'unavailable',
        'requires_review_ack', false
      );
    ELSE
      SELECT
        COALESCE(round(SUM(c.take_home_pay)), 0),
        COUNT(*)::integer
      INTO v_prev_total_thp, v_prev_employee_count
      FROM public.employee_payroll_calculations c
      WHERE c.payroll_run_id = v_prev_run.id;

      SELECT
        COUNT(*)::integer,
        COALESCE(round(SUM(curr.take_home_pay)), 0),
        COALESCE(round(SUM(prev.take_home_pay)), 0)
      INTO v_matched_count, v_matched_curr_thp, v_matched_prev_thp
      FROM public.employee_payroll_calculations curr
      JOIN public.employee_payroll_calculations prev
        ON prev.employee_id = curr.employee_id
       AND prev.payroll_run_id = v_prev_run.id
      WHERE curr.payroll_run_id = p_run_id
        AND curr.payment_status = 'pending'
        AND COALESCE(curr.take_home_pay, 0) > 0
        AND COALESCE(trim(curr.payout_snapshot->>'account_number'), '') <> ''
        AND COALESCE(trim(curr.payout_snapshot->>'account_holder'), '') <> ''
        AND COALESCE(trim(curr.payout_snapshot->>'bank_name'), '') <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM public.employee_payroll_info epi
          WHERE epi.id = curr.employee_payroll_info_id
            AND (
              COALESCE(trim(epi.bank_name), '') <> COALESCE(trim(curr.payout_snapshot->>'bank_name'), '')
              OR COALESCE(trim(epi.bank_account_number), '') <> COALESCE(trim(curr.payout_snapshot->>'account_number'), '')
              OR COALESCE(trim(epi.bank_account_holder), '') <> COALESCE(trim(curr.payout_snapshot->>'account_holder'), '')
            )
        );

      v_delta_amount := round(v_total_thp_pending) - v_prev_total_thp;
      IF v_prev_total_thp > 0 THEN
        v_delta_percent := round((v_delta_amount / v_prev_total_thp) * 100, 2);
      END IF;

      v_matched_delta_amount := v_matched_curr_thp - v_matched_prev_thp;
      IF v_matched_prev_thp > 0 THEN
        v_matched_delta_percent := round((v_matched_delta_amount / v_matched_prev_thp) * 100, 2);
      END IF;

      IF v_delta_percent IS NULL THEN
        v_severity := 'unavailable';
        v_requires_ack := false;
      ELSIF v_delta_percent >= 15 THEN
        v_severity := 'significant_increase';
        v_requires_ack := true;
      ELSIF v_delta_percent <= -15 THEN
        v_severity := 'significant_decrease';
        v_requires_ack := true;
      ELSIF abs(v_delta_percent) >= 5 THEN
        v_severity := 'moderate';
        v_requires_ack := false;
      ELSE
        v_severity := 'stable';
        v_requires_ack := false;
      END IF;

      v_period_comparison := jsonb_build_object(
        'available', true,
        'previous_period_id', v_prev_period.id,
        'previous_period_name', v_prev_period.period_name,
        'previous_run_id', v_prev_run.id,
        'previous_run_status', v_prev_run.status,
        'previous_total_thp', v_prev_total_thp,
        'previous_employee_count', v_prev_employee_count,
        'current_total_thp', round(v_total_thp_pending),
        'current_employee_count', v_count_pending,
        'matched_employee_count', v_matched_count,
        'matched_previous_thp', v_matched_prev_thp,
        'matched_current_thp', v_matched_curr_thp,
        'delta_amount', v_delta_amount,
        'delta_percent', v_delta_percent,
        'matched_delta_amount', v_matched_delta_amount,
        'matched_delta_percent', v_matched_delta_percent,
        'severity', v_severity,
        'requires_review_ack', v_requires_ack
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'run_id', v_run.id,
    'run_name', v_run.run_name,
    'run_status', v_run.status,
    'employees', v_employees,
    'summary', jsonb_build_object(
      'count_pending', v_count_pending,
      'count_invalid', v_count_invalid,
      'count_processing', v_count_processing,
      'count_failed', v_count_failed,
      'count_paid', v_count_paid,
      'total_thp_pending', round(v_total_thp_pending),
      'total_thp_all', round(v_total_thp_all),
      'has_active_disbursement', (v_count_processing > 0)
    ),
    'period_comparison', v_period_comparison
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_disburse_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_disburse_preview(uuid) TO authenticated;
