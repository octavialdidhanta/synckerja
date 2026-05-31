-- Payroll go-live: updated payroll_calculate_employee (TER, THR, payout snapshot) + process audit

CREATE OR REPLACE FUNCTION public.payroll_calculate_employee(
  p_run_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run record;
  v_info record;
  v_tax_config record;
  v_ratio numeric;
  v_basic_prorated numeric;
  v_allowances numeric := 0;
  v_deductions numeric := 0;
  v_penalties numeric := 0;
  v_overtime_pay numeric := 0;
  v_thr_amount numeric := 0;
  v_has_thr_component boolean := false;
  v_gross numeric;
  v_non_taxable_annual numeric := 0;
  v_tax jsonb;
  v_calc_mode text := 'annualized';
  v_effective_year integer;
  v_monthly_tax numeric;
  v_employer_tax numeric;
  v_bpjs_k numeric;
  v_bpjs_p numeric;
  v_take_home numeric;
  v_target numeric;
  v_comp record;
  v_fixed_allowance numeric := 0;
  v_resolved numeric;
  v_calc_id uuid;
  v_line_items jsonb := '[]'::jsonb;
  v_penalty_ids uuid[] := ARRAY[]::uuid[];
  v_payout_snapshot jsonb;
BEGIN
  SELECT pr.*, pp.start_date, pp.end_date, pp.id AS period_id, pp.pay_date,
         COALESCE(pp.is_bonus_period, false) AS is_bonus_period
  INTO v_run
  FROM public.payroll_runs pr
  JOIN public.payroll_periods pp ON pp.id = pr.payroll_period_id
  WHERE pr.id = p_run_id;

  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT epi.*, e.full_name, e.join_date, e.hire_date
  INTO v_info
  FROM public.employee_payroll_info epi
  JOIN public.employees e ON e.id = epi.employee_id
  WHERE epi.employee_id = p_employee_id
    AND epi.organization_id = v_run.organization_id;

  IF v_info IS NULL OR COALESCE(v_info.basic_salary, 0) <= 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'missing payroll info');
  END IF;

  IF v_info.tax_configuration_id IS NOT NULL THEN
    SELECT tc.calculation_mode INTO v_calc_mode
    FROM public.tax_configurations tc
    WHERE tc.id = v_info.tax_configuration_id;
  END IF;
  v_calc_mode := COALESCE(v_calc_mode, 'annualized');
  v_effective_year := EXTRACT(YEAR FROM v_run.end_date)::integer;

  v_ratio := public.payroll_employee_prorate_ratio(
    v_run.organization_id, v_run.start_date, v_run.end_date, p_employee_id,
    COALESCE(v_info.count_national_holiday_as_working_day, false)
  );

  IF v_ratio <= 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'zero effective working days');
  END IF;

  v_basic_prorated := round(COALESCE(v_info.basic_salary, 0) * v_ratio);

  SELECT EXISTS (
    SELECT 1 FROM public.employee_payroll_components c
    WHERE c.employee_payroll_info_id = v_info.id
      AND c.is_active IS NOT DISTINCT FROM true
      AND c.component_type = 'allowance'
      AND lower(COALESCE(c.component_category, c.component_name, '')) LIKE '%thr%'
      AND (c.payroll_period_id IS NULL OR c.payroll_period_id = v_run.payroll_period_id)
  ) INTO v_has_thr_component;

  IF v_run.is_bonus_period AND NOT v_has_thr_component THEN
    v_thr_amount := public.payroll_calculate_thr_amount(
      v_run.organization_id, p_employee_id, COALESCE(v_info.basic_salary, 0), v_run.end_date
    );
    IF v_thr_amount > 0 THEN
      v_allowances := v_allowances + v_thr_amount;
      v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
        'item_name', 'THR',
        'item_type', 'allowance',
        'item_category', 'thr',
        'calculated_amount', v_thr_amount
      ));
    END IF;
  END IF;

  FOR v_comp IN
    SELECT c.* FROM public.employee_payroll_components c
    WHERE c.employee_payroll_info_id = v_info.id
      AND c.is_active IS NOT DISTINCT FROM true
      AND c.component_type = 'allowance'
      AND COALESCE(c.is_percentage, false) = false
      AND ((COALESCE(c.is_recurring, true) = true AND c.payroll_period_id IS NULL)
           OR c.payroll_period_id = v_run.payroll_period_id)
  LOOP
    v_resolved := round(COALESCE(v_comp.amount, 0));
    v_allowances := v_allowances + v_resolved;
    v_fixed_allowance := v_fixed_allowance + v_resolved;
    IF COALESCE(v_comp.is_taxable, true) = false THEN
      v_non_taxable_annual := v_non_taxable_annual + v_resolved * 12;
    END IF;
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'component_id', v_comp.id, 'item_name', v_comp.component_name,
      'item_type', 'allowance', 'item_category', v_comp.component_category,
      'calculated_amount', v_resolved
    ));
  END LOOP;

  FOR v_comp IN
    SELECT c.* FROM public.employee_payroll_components c
    WHERE c.employee_payroll_info_id = v_info.id
      AND c.is_active IS NOT DISTINCT FROM true
      AND c.component_type = 'allowance'
      AND COALESCE(c.is_percentage, false) = true
      AND ((COALESCE(c.is_recurring, true) = true AND c.payroll_period_id IS NULL)
           OR c.payroll_period_id = v_run.payroll_period_id)
  LOOP
    IF COALESCE(v_comp.percentage_base, 'basic_salary') = 'gross_salary' THEN
      v_resolved := round((COALESCE(v_comp.amount, 0) / 100.0) * (v_basic_prorated + v_fixed_allowance));
    ELSE
      v_resolved := round((COALESCE(v_comp.amount, 0) / 100.0) * v_basic_prorated);
    END IF;
    v_allowances := v_allowances + v_resolved;
    IF COALESCE(v_comp.is_taxable, true) = false THEN
      v_non_taxable_annual := v_non_taxable_annual + v_resolved * 12;
    END IF;
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'component_id', v_comp.id, 'item_name', v_comp.component_name,
      'item_type', 'allowance', 'item_category', v_comp.component_category,
      'calculated_amount', v_resolved
    ));
  END LOOP;

  IF COALESCE(v_info.overtime_eligible, false) THEN
    v_overtime_pay := (public.payroll_calculate_overtime_pay(
      v_run.organization_id, p_employee_id, v_run.start_date, v_run.end_date, v_basic_prorated
    )->>'overtimePay')::numeric;
    v_allowances := v_allowances + v_overtime_pay;
    IF v_overtime_pay > 0 THEN
      v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
        'item_name', 'Lembur', 'item_type', 'allowance',
        'item_category', 'overtime', 'calculated_amount', v_overtime_pay
      ));
    END IF;
  END IF;

  FOR v_comp IN
    SELECT c.* FROM public.employee_payroll_components c
    WHERE c.employee_payroll_info_id = v_info.id
      AND c.is_active IS NOT DISTINCT FROM true
      AND c.component_type = 'deduction'
      AND ((COALESCE(c.is_recurring, true) = true AND c.payroll_period_id IS NULL)
           OR c.payroll_period_id = v_run.payroll_period_id)
  LOOP
    IF COALESCE(v_comp.is_percentage, false) THEN
      IF COALESCE(v_comp.percentage_base, 'basic_salary') = 'gross_salary' THEN
        v_resolved := round((COALESCE(v_comp.amount, 0) / 100.0) * (v_basic_prorated + v_allowances));
      ELSE
        v_resolved := round((COALESCE(v_comp.amount, 0) / 100.0) * v_basic_prorated);
      END IF;
    ELSE
      v_resolved := round(COALESCE(v_comp.amount, 0));
    END IF;
    v_deductions := v_deductions + v_resolved;
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'component_id', v_comp.id, 'item_name', v_comp.component_name,
      'item_type', 'deduction', 'item_category', v_comp.component_category,
      'calculated_amount', v_resolved
    ));
  END LOOP;

  FOR v_comp IN
    SELECT ap.id, ap.penalty_amount, ap.penalty_reason
    FROM public.attendance_penalties ap
    WHERE ap.employee_id = p_employee_id
      AND ap.organization_id = v_run.organization_id
      AND ap.status = 'active'
      AND (ap.payroll_periods_id = v_run.payroll_period_id
           OR (ap.payroll_periods_id IS NULL
               AND ap.applied_date BETWEEN v_run.start_date AND v_run.end_date))
  LOOP
    v_penalties := v_penalties + COALESCE(v_comp.penalty_amount, 0);
    v_penalty_ids := array_append(v_penalty_ids, v_comp.id);
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', COALESCE(v_comp.penalty_reason, 'Penalty'),
      'item_type', 'deduction', 'item_category', 'penalty',
      'calculated_amount', round(COALESCE(v_comp.penalty_amount, 0))
    ));
  END LOOP;

  v_gross := v_basic_prorated + v_allowances;
  v_target := GREATEST(0, v_gross - v_deductions - v_penalties);

  IF v_calc_mode = 'ter' THEN
    v_tax := public.payroll_calculate_pph21_ter_v2(
      v_gross,
      COALESCE(v_info.employee_tax_status, 'pegawai_tetap'),
      COALESCE(v_info.ptkp_status, 'TK/0'),
      v_effective_year
    );
  ELSE
    v_tax := public.payroll_calculate_tax_by_method(
      v_gross,
      COALESCE(v_info.ptkp_status, 'TK/0'),
      COALESCE(v_info.tax_method, 'gross'),
      NULL,
      v_non_taxable_annual,
      CASE WHEN COALESCE(v_info.tax_method, 'gross') IN ('netto', 'gross_up') THEN v_target ELSE NULL END
    );
    v_tax := v_tax || jsonb_build_object('calculationMode', 'annualized');
  END IF;

  v_monthly_tax := COALESCE((v_tax->>'monthlyTax')::numeric, 0);
  v_employer_tax := COALESCE((v_tax->>'employerTaxCost')::numeric, 0);
  v_bpjs_k := COALESCE((v_tax->>'monthlyBpjsKesehatan')::numeric, 0);
  v_bpjs_p := COALESCE((v_tax->>'monthlyBpjsPensiun')::numeric, 0);

  IF v_bpjs_k > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', 'BPJS Kesehatan', 'item_type', 'deduction',
      'item_category', 'bpjs_kesehatan', 'calculated_amount', round(v_bpjs_k)
    ));
  END IF;
  IF v_bpjs_p > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', 'BPJS Pensiun', 'item_type', 'deduction',
      'item_category', 'bpjs_pensiun', 'calculated_amount', round(v_bpjs_p)
    ));
  END IF;
  IF v_monthly_tax + v_employer_tax > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', CASE WHEN COALESCE(v_info.tax_method, 'gross') = 'gross_up'
        THEN 'PPh 21 (Ditanggung Perusahaan)' ELSE 'PPh 21' END,
      'item_type', 'tax', 'item_category', 'pph21',
      'calculated_amount', round(v_monthly_tax + v_employer_tax)
    ));
  END IF;

  IF COALESCE(v_info.tax_method, 'gross') = 'gross_up' AND v_calc_mode <> 'ter' THEN
    v_take_home := v_target;
  ELSE
    v_take_home := round(
      COALESCE((v_tax->>'takeHomePay')::numeric, v_gross - v_monthly_tax - v_bpjs_k - v_bpjs_p)
      - v_deductions - v_penalties
    );
  END IF;

  v_payout_snapshot := jsonb_build_object(
    'bank_name', v_info.bank_name,
    'account_number', v_info.bank_account_number,
    'account_holder', v_info.bank_account_holder
  );

  INSERT INTO public.employee_payroll_calculations (
    organization_id, employee_id, employee_payroll_info_id,
    payroll_period_id, payroll_run_id, tax_configuration_id,
    basic_salary, total_allowances, total_deductions, total_penalties,
    total_tax_deductions, gross_pay, net_pay, take_home_pay,
    total_taxes, total_tax_amount, tax_breakdown, calculation_details,
    payout_snapshot, calculation_status, payment_status
  ) VALUES (
    v_run.organization_id, p_employee_id, v_info.id,
    v_run.payroll_period_id, p_run_id, v_info.tax_configuration_id,
    v_basic_prorated, round(v_allowances), round(v_deductions + v_bpjs_k + v_bpjs_p + v_monthly_tax),
    round(v_penalties), round(v_monthly_tax + v_employer_tax),
    round(CASE WHEN COALESCE(v_info.tax_method, 'gross') = 'gross' OR v_calc_mode = 'ter'
      THEN v_gross ELSE COALESCE((v_tax->>'imputedMonthlyGross')::numeric, v_gross) END),
    v_take_home, v_take_home,
    (round(v_monthly_tax + v_employer_tax))::text,
    round(v_monthly_tax + v_employer_tax),
    v_tax->'taxBreakdown',
    jsonb_build_object(
      'taxMethod', COALESCE(v_info.tax_method, 'gross'),
      'calculationMode', v_calc_mode,
      'terCategory', v_tax->>'terCategory',
      'terRate', v_tax->>'terRate',
      'prorateRatio', v_ratio,
      'overtimePay', v_overtime_pay,
      'thrAmount', v_thr_amount,
      'penaltyIds', to_jsonb(v_penalty_ids)
    ),
    v_payout_snapshot, 'calculated', 'pending'
  )
  ON CONFLICT (employee_payroll_info_id, payroll_run_id)
  DO UPDATE SET
    basic_salary = EXCLUDED.basic_salary,
    total_allowances = EXCLUDED.total_allowances,
    total_deductions = EXCLUDED.total_deductions,
    total_penalties = EXCLUDED.total_penalties,
    total_tax_deductions = EXCLUDED.total_tax_deductions,
    gross_pay = EXCLUDED.gross_pay,
    net_pay = EXCLUDED.net_pay,
    take_home_pay = EXCLUDED.take_home_pay,
    total_taxes = EXCLUDED.total_taxes,
    total_tax_amount = EXCLUDED.total_tax_amount,
    tax_breakdown = EXCLUDED.tax_breakdown,
    calculation_details = EXCLUDED.calculation_details,
    payout_snapshot = EXCLUDED.payout_snapshot,
    calculation_status = 'calculated',
    updated_at = now()
  RETURNING id INTO v_calc_id;

  DELETE FROM public.payroll_items WHERE payroll_calculation_id = v_calc_id;

  INSERT INTO public.payroll_items (
    organization_id, payroll_calculation_id, component_id,
    item_name, item_type, item_category, calculated_amount
  )
  SELECT v_run.organization_id, v_calc_id,
    NULLIF(elem->>'component_id', '')::uuid,
    elem->>'item_name', elem->>'item_type', elem->>'item_category',
    (elem->>'calculated_amount')::numeric
  FROM jsonb_array_elements(v_line_items) AS elem;

  IF array_length(v_penalty_ids, 1) IS NOT NULL THEN
    UPDATE public.attendance_penalties ap
    SET status = 'paid', payment_date = COALESCE(v_run.pay_date, CURRENT_DATE), updated_at = now()
    WHERE ap.id = ANY (v_penalty_ids) AND ap.status = 'active';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'calculationId', v_calc_id,
    'takeHomePay', v_take_home, 'grossPay', v_gross
  );
END;
$$;

-- Update process_payroll_run to log audit
CREATE OR REPLACE FUNCTION public.process_payroll_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run record;
  v_emp record;
  v_created integer := 0;
  v_skipped integer := 0;
  v_result jsonb;
  v_calc_ids uuid[];
  v_was_reprocess boolean := false;
BEGIN
  SELECT pr.*, pp.start_date, pp.end_date
  INTO v_run
  FROM public.payroll_runs pr
  JOIN public.payroll_periods pp ON pp.id = pr.payroll_period_id
  WHERE pr.id = p_run_id;

  IF v_run IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Payroll run not found');
  END IF;

  IF NOT (v_run.organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_run.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot process a paid payroll run');
  END IF;

  SELECT array_agg(id) INTO v_calc_ids
  FROM public.employee_payroll_calculations
  WHERE payroll_run_id = p_run_id AND payment_status IS DISTINCT FROM 'paid';

  IF v_calc_ids IS NOT NULL THEN
    v_was_reprocess := true;
    DELETE FROM public.payroll_items WHERE payroll_calculation_id = ANY (v_calc_ids);
    DELETE FROM public.employee_payroll_calculations WHERE id = ANY (v_calc_ids);
  END IF;

  FOR v_emp IN
    SELECT e.id FROM public.employees e
    JOIN public.employee_statuses es ON es.id = e.employee_status_id
    JOIN public.employee_payroll_info epi ON epi.employee_id = e.id
    WHERE e.organization_id = v_run.organization_id
      AND COALESCE(e.pending_removal, false) = false
      AND lower(es.name) IN ('active', 'probation')
      AND COALESCE(epi.basic_salary, 0) > 0
      AND epi.ptkp_status IS NOT NULL
      AND epi.tax_configuration_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.employee_payroll_calculations ec
        WHERE ec.payroll_run_id = p_run_id AND ec.employee_id = e.id AND ec.payment_status = 'paid'
      )
  LOOP
    v_result := public.payroll_calculate_employee(p_run_id, v_emp.id);
    IF COALESCE((v_result->>'skipped')::boolean, false) THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_created := v_created + 1;
    END IF;
  END LOOP;

  UPDATE public.payroll_runs
  SET status = 'calculated', calculated_at = now(), calculated_by = auth.uid(), updated_at = now()
  WHERE id = p_run_id;

  PERFORM public.calculate_payroll_run_totals(p_run_id);

  PERFORM public.payroll_log_audit(
    v_run.organization_id, p_run_id, NULL,
    CASE WHEN v_was_reprocess THEN 'reprocessed' ELSE 'calculated' END,
    jsonb_build_object('calculations_created', v_created, 'calculations_skipped', v_skipped)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Payroll processed: %s employee(s) calculated, %s skipped', v_created, v_skipped),
    'calculations_created', v_created,
    'calculations_skipped', v_skipped
  );
END;
$$;
