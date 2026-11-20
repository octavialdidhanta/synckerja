-- Payroll calculation RPCs: helpers + process_payroll_run + calculate_payroll_run_totals
-- Mirrors src/shared/lib/payroll/* (annualized PPh21, prorate, components, penalties, overtime)

-- ---------------------------------------------------------------------------
-- PTKP lookup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_ptkp_amount(p_ptkp_status text, p_custom numeric DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(p_custom, 0),
    CASE COALESCE(p_ptkp_status, 'TK/0')
      WHEN 'TK/0' THEN 54000000
      WHEN 'TK/1' THEN 58500000
      WHEN 'TK/2' THEN 63000000
      WHEN 'TK/3' THEN 67500000
      WHEN 'K/0' THEN 58500000
      WHEN 'K/1' THEN 63000000
      WHEN 'K/2' THEN 67500000
      WHEN 'K/3' THEN 72000000
      ELSE 54000000
    END
  );
$$;

-- ---------------------------------------------------------------------------
-- Count working days in a date range
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_count_working_days(
  p_org_id uuid,
  p_start date,
  p_end date,
  p_working_days integer[],
  p_count_holiday_as_working boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count integer := 0;
  v_d date;
  v_dow integer;
  v_is_holiday boolean;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start > p_end THEN
    RETURN 0;
  END IF;

  v_d := p_start;
  WHILE v_d <= p_end LOOP
    v_dow := EXTRACT(DOW FROM v_d)::integer;
    IF v_dow = ANY (COALESCE(p_working_days, ARRAY[1, 2, 3, 4, 5])) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.national_holidays nh
        WHERE nh.date = v_d
          AND nh.is_active IS NOT DISTINCT FROM true
          AND nh.applies_to_attendance IS NOT DISTINCT FROM true
          AND (nh.organization_id IS NULL OR nh.organization_id = p_org_id)
      ) INTO v_is_holiday;

      IF p_count_holiday_as_working OR NOT v_is_holiday THEN
        v_count := v_count + 1;
      END IF;
    END IF;
    v_d := v_d + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Prorate ratio for employee in payroll period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_employee_prorate_ratio(
  p_org_id uuid,
  p_period_start date,
  p_period_end date,
  p_employee_id uuid,
  p_count_holiday_as_working boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_working_days integer[];
  v_join date;
  v_total integer;
  v_effective integer;
  v_eff_start date;
  v_eff_end date;
BEGIN
  SELECT COALESCE(ws.working_days, ARRAY[1, 2, 3, 4, 5])
  INTO v_working_days
  FROM public.work_schedule_settings ws
  WHERE ws.organization_id = p_org_id
    AND ws.is_active IS NOT DISTINCT FROM true
  ORDER BY ws.is_default DESC NULLS LAST, ws.created_at
  LIMIT 1;

  IF v_working_days IS NULL THEN
    v_working_days := ARRAY[1, 2, 3, 4, 5];
  END IF;

  SELECT COALESCE(e.join_date, e.hire_date)
  INTO v_join
  FROM public.employees e
  WHERE e.id = p_employee_id;

  v_eff_start := p_period_start;
  v_eff_end := p_period_end;

  IF v_join IS NOT NULL AND v_join > v_eff_start THEN
    v_eff_start := v_join;
  END IF;

  IF v_eff_start > v_eff_end THEN
    RETURN 0;
  END IF;

  v_total := public.payroll_count_working_days(
    p_org_id, p_period_start, p_period_end, v_working_days, p_count_holiday_as_working
  );

  v_effective := public.payroll_count_working_days(
    p_org_id, v_eff_start, v_eff_end, v_working_days, p_count_holiday_as_working
  );

  IF v_total <= 0 THEN
    RETURN 1;
  END IF;

  RETURN LEAST(1, v_effective::numeric / v_total::numeric);
END;
$$;

-- ---------------------------------------------------------------------------
-- Annualized PPh21 (mirrors pph21Calculator.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_calculate_pph21_annualized(
  p_monthly_gross numeric,
  p_ptkp_status text DEFAULT 'TK/0',
  p_custom_ptkp numeric DEFAULT NULL,
  p_non_taxable_annual numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_gross numeric := GREATEST(COALESCE(p_monthly_gross, 0), 0);
  v_annual_gross numeric;
  v_professional numeric;
  v_bpjs_k_annual numeric := 0;
  v_bpjs_p_annual numeric := 0;
  v_bpjs_k_monthly numeric := 0;
  v_bpjs_p_monthly numeric := 0;
  v_net_income numeric;
  v_ptkp numeric;
  v_pkp numeric;
  v_remaining numeric;
  v_tax numeric := 0;
  v_bracket_tax numeric;
  v_bracket_size numeric;
  v_taxable numeric;
  v_breakdown jsonb := '[]'::jsonb;
  v_i integer;
  v_min numeric;
  v_max numeric;
  v_rate numeric;
BEGIN
  v_annual_gross := v_gross * 12;
  v_professional := LEAST(v_annual_gross * 0.05, 6000000);

  v_bpjs_k_monthly := LEAST(v_gross, 12000000) * 0.02;
  v_bpjs_p_monthly := LEAST(v_gross, 8930600) * 0.01;
  v_bpjs_k_annual := v_bpjs_k_monthly * 12;
  v_bpjs_p_annual := v_bpjs_p_monthly * 12;

  v_net_income := v_annual_gross - v_professional - v_bpjs_k_annual - v_bpjs_p_annual;
  v_ptkp := public.payroll_ptkp_amount(p_ptkp_status, p_custom_ptkp);
  v_pkp := GREATEST(0, v_net_income - v_ptkp - GREATEST(COALESCE(p_non_taxable_annual, 0), 0));
  v_remaining := v_pkp;

  FOR v_i IN 1..4 LOOP
    EXIT WHEN v_remaining <= 0;
    CASE v_i
      WHEN 1 THEN v_min := 0; v_max := 60000000; v_rate := 0.05;
      WHEN 2 THEN v_min := 60000000; v_max := 250000000; v_rate := 0.15;
      WHEN 3 THEN v_min := 250000000; v_max := 500000000; v_rate := 0.25;
      ELSE v_min := 500000000; v_max := 999999999999; v_rate := 0.30;
    END CASE;
    v_bracket_size := v_max - v_min;
    IF v_i = 4 THEN
      v_taxable := v_remaining;
    ELSE
      v_taxable := LEAST(v_remaining, v_bracket_size);
    END IF;
    IF v_taxable > 0 THEN
      v_bracket_tax := v_taxable * v_rate;
      v_tax := v_tax + v_bracket_tax;
      v_breakdown := v_breakdown || jsonb_build_array(
        jsonb_build_object(
          'bracket', v_min::text || ' - ' || CASE WHEN v_i = 4 THEN '∞' ELSE v_max::text END,
          'amount', round(v_taxable),
          'tax', round(v_bracket_tax),
          'rate', v_rate * 100
        )
      );
      v_remaining := v_remaining - v_taxable;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'annualGross', round(v_annual_gross),
    'professionalAllowance', round(v_professional),
    'bpjsKesehatanEmployee', round(v_bpjs_k_annual),
    'bpjsPensiunEmployee', round(v_bpjs_p_annual),
    'monthlyBpjsKesehatan', round(v_bpjs_k_monthly),
    'monthlyBpjsPensiun', round(v_bpjs_p_monthly),
    'netIncome', round(v_net_income),
    'ptkpAmount', round(v_ptkp),
    'pkpAmount', round(v_pkp),
    'annualTax', round(v_tax),
    'monthlyTax', round(v_tax / 12),
    'takeHomePay', round(v_gross - (v_tax / 12) - v_bpjs_k_monthly - v_bpjs_p_monthly),
    'taxBreakdown', v_breakdown
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Tax by method (gross / netto / gross_up) — binary search imputed gross
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_calculate_tax_by_method(
  p_gross numeric,
  p_ptkp_status text,
  p_tax_method text,
  p_custom_ptkp numeric DEFAULT NULL,
  p_non_taxable_annual numeric DEFAULT 0,
  p_target_take_home numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_method text := COALESCE(p_tax_method, 'gross');
  v_result jsonb;
  v_target numeric;
  v_low numeric;
  v_high numeric;
  v_mid numeric;
  v_thp numeric;
  v_i integer;
  v_imputed numeric;
  v_monthly_tax numeric;
BEGIN
  IF v_method = 'gross' THEN
    v_result := public.payroll_calculate_pph21_annualized(
      p_gross, p_ptkp_status, p_custom_ptkp, p_non_taxable_annual
    );
    RETURN v_result || jsonb_build_object(
      'taxMethod', 'gross',
      'imputedMonthlyGross', round(p_gross),
      'employerTaxCost', 0
    );
  END IF;

  v_target := COALESCE(p_target_take_home, p_gross);
  v_low := GREATEST(v_target, 0);
  v_high := GREATEST(v_target * 2, v_target + 1000000);

  FOR v_i IN 1..20 LOOP
    v_mid := (v_low + v_high) / 2;
    v_result := public.payroll_calculate_pph21_annualized(
      v_mid, p_ptkp_status, p_custom_ptkp, p_non_taxable_annual
    );
    IF v_method = 'gross_up' THEN
      v_thp := v_mid
        - (v_result->>'monthlyBpjsKesehatan')::numeric
        - (v_result->>'monthlyBpjsPensiun')::numeric;
    ELSE
      v_thp := (v_result->>'takeHomePay')::numeric;
    END IF;

    IF abs(v_thp - v_target) <= 100 THEN
      EXIT;
    ELSIF v_thp < v_target THEN
      v_low := v_mid;
    ELSE
      v_high := v_mid;
    END IF;
  END LOOP;

  v_imputed := v_mid;
  v_result := public.payroll_calculate_pph21_annualized(
    v_imputed, p_ptkp_status, p_custom_ptkp, p_non_taxable_annual
  );
  v_monthly_tax := (v_result->>'monthlyTax')::numeric;

  IF v_method = 'gross_up' THEN
    RETURN v_result || jsonb_build_object(
      'taxMethod', 'gross_up',
      'imputedMonthlyGross', round(v_imputed),
      'employerTaxCost', round(v_monthly_tax),
      'monthlyTax', 0,
      'takeHomePay', round(
        v_imputed
        - (v_result->>'monthlyBpjsKesehatan')::numeric
        - (v_result->>'monthlyBpjsPensiun')::numeric
      )
    );
  END IF;

  RETURN v_result || jsonb_build_object(
    'taxMethod', 'netto',
    'imputedMonthlyGross', round(v_imputed),
    'employerTaxCost', 0
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Overtime pay for employee in period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_calculate_overtime_pay(
  p_org_id uuid,
  p_employee_id uuid,
  p_period_start date,
  p_period_end date,
  p_basic_salary numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hourly numeric;
  v_total_minutes integer := 0;
  v_total_pay numeric := 0;
  v_scheduled_end time;
  v_threshold integer := 0;
  v_rec record;
  v_raw_minutes integer;
  v_hours numeric;
  v_first_hour numeric;
  v_next_hours numeric;
  v_pay numeric;
BEGIN
  v_hourly := COALESCE(p_basic_salary, 0) / 173;

  SELECT COALESCE(s.end_time::time, ws.end_time::time, '17:00:00'::time),
         COALESCE(ws.overtime_threshold_minutes, 0)
  INTO v_scheduled_end, v_threshold
  FROM public.work_schedule_settings ws
  LEFT JOIN public.employee_shifts es
    ON es.employee_id = p_employee_id
   AND es.is_active IS NOT DISTINCT FROM true
   AND es.effective_from_date <= p_period_end
   AND (es.effective_to_date IS NULL OR es.effective_to_date >= p_period_start)
  LEFT JOIN public.shifts s ON s.id = es.shift_id
  WHERE ws.organization_id = p_org_id
    AND ws.is_active IS NOT DISTINCT FROM true
  ORDER BY es.effective_from_date DESC NULLS LAST, ws.is_default DESC NULLS LAST
  LIMIT 1;

  IF v_scheduled_end IS NULL THEN
    v_scheduled_end := '17:00:00'::time;
  END IF;

  FOR v_rec IN
    SELECT ar.attendance_date,
           ar.check_out_time,
           ar.check_out_at
    FROM public.attendance_records ar
    WHERE ar.employee_id = p_employee_id
      AND ar.organization_id = p_org_id
      AND COALESCE(ar.attendance_date, ar.check_in_at::date) BETWEEN p_period_start AND p_period_end
      AND (ar.check_out_time IS NOT NULL OR ar.check_out_at IS NOT NULL)
  LOOP
    v_raw_minutes := GREATEST(
      0,
      (
        EXTRACT(EPOCH FROM (
          COALESCE(v_rec.check_out_time, v_rec.check_out_at::time)
          - v_scheduled_end
        )) / 60
      )::integer - v_threshold
    );

    IF v_raw_minutes > 0 THEN
      v_total_minutes := v_total_minutes + v_raw_minutes;
    END IF;
  END LOOP;

  IF v_total_minutes <= 0 THEN
    RETURN jsonb_build_object('overtimePay', 0, 'totalMinutes', 0);
  END IF;

  v_hours := v_total_minutes / 60.0;
  v_first_hour := LEAST(1, v_hours);
  v_next_hours := GREATEST(0, v_hours - 1);
  v_total_pay := round(v_first_hour * v_hourly * 1.5 + v_next_hours * v_hourly * 2);

  RETURN jsonb_build_object(
    'overtimePay', v_total_pay,
    'totalMinutes', v_total_minutes
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Calculate one employee payroll → jsonb result
-- ---------------------------------------------------------------------------
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
  v_ratio numeric;
  v_basic_prorated numeric;
  v_allowances numeric := 0;
  v_deductions numeric := 0;
  v_penalties numeric := 0;
  v_overtime_pay numeric := 0;
  v_gross numeric;
  v_non_taxable_annual numeric := 0;
  v_tax jsonb;
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
BEGIN
  SELECT pr.*, pp.start_date, pp.end_date, pp.id AS period_id, pp.pay_date
  INTO v_run
  FROM public.payroll_runs pr
  JOIN public.payroll_periods pp ON pp.id = pr.payroll_period_id
  WHERE pr.id = p_run_id;

  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT epi.*, e.full_name
  INTO v_info
  FROM public.employee_payroll_info epi
  JOIN public.employees e ON e.id = epi.employee_id
  WHERE epi.employee_id = p_employee_id
    AND epi.organization_id = v_run.organization_id;

  IF v_info IS NULL OR COALESCE(v_info.basic_salary, 0) <= 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'missing payroll info');
  END IF;

  v_ratio := public.payroll_employee_prorate_ratio(
    v_run.organization_id,
    v_run.start_date,
    v_run.end_date,
    p_employee_id,
    COALESCE(v_info.count_national_holiday_as_working_day, false)
  );

  IF v_ratio <= 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'zero effective working days');
  END IF;

  v_basic_prorated := round(COALESCE(v_info.basic_salary, 0) * v_ratio);

  -- Fixed allowances first (non-percentage)
  FOR v_comp IN
    SELECT c.*
    FROM public.employee_payroll_components c
    WHERE c.employee_payroll_info_id = v_info.id
      AND c.is_active IS NOT DISTINCT FROM true
      AND c.component_type = 'allowance'
      AND COALESCE(c.is_percentage, false) = false
      AND (
        (COALESCE(c.is_recurring, true) = true AND c.payroll_period_id IS NULL)
        OR c.payroll_period_id = v_run.payroll_period_id
      )
  LOOP
    v_resolved := round(COALESCE(v_comp.amount, 0));
    v_allowances := v_allowances + v_resolved;
    v_fixed_allowance := v_fixed_allowance + v_resolved;
    IF COALESCE(v_comp.is_taxable, true) = false THEN
      v_non_taxable_annual := v_non_taxable_annual + v_resolved * 12;
    END IF;
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'component_id', v_comp.id,
      'item_name', v_comp.component_name,
      'item_type', 'allowance',
      'item_category', v_comp.component_category,
      'calculated_amount', v_resolved
    ));
  END LOOP;

  -- Percentage allowances
  FOR v_comp IN
    SELECT c.*
    FROM public.employee_payroll_components c
    WHERE c.employee_payroll_info_id = v_info.id
      AND c.is_active IS NOT DISTINCT FROM true
      AND c.component_type = 'allowance'
      AND COALESCE(c.is_percentage, false) = true
      AND (
        (COALESCE(c.is_recurring, true) = true AND c.payroll_period_id IS NULL)
        OR c.payroll_period_id = v_run.payroll_period_id
      )
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
      'component_id', v_comp.id,
      'item_name', v_comp.component_name,
      'item_type', 'allowance',
      'item_category', v_comp.component_category,
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
        'item_name', 'Lembur',
        'item_type', 'allowance',
        'item_category', 'overtime',
        'calculated_amount', v_overtime_pay
      ));
    END IF;
  END IF;

  -- Deduction components
  FOR v_comp IN
    SELECT c.*
    FROM public.employee_payroll_components c
    WHERE c.employee_payroll_info_id = v_info.id
      AND c.is_active IS NOT DISTINCT FROM true
      AND c.component_type = 'deduction'
      AND (
        (COALESCE(c.is_recurring, true) = true AND c.payroll_period_id IS NULL)
        OR c.payroll_period_id = v_run.payroll_period_id
      )
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
      'component_id', v_comp.id,
      'item_name', v_comp.component_name,
      'item_type', 'deduction',
      'item_category', v_comp.component_category,
      'calculated_amount', v_resolved
    ));
  END LOOP;

  -- Penalties
  FOR v_comp IN
    SELECT ap.id, ap.penalty_amount, ap.penalty_reason
    FROM public.attendance_penalties ap
    WHERE ap.employee_id = p_employee_id
      AND ap.organization_id = v_run.organization_id
      AND ap.status = 'active'
      AND (
        ap.payroll_periods_id = v_run.payroll_period_id
        OR (
          ap.payroll_periods_id IS NULL
          AND ap.applied_date BETWEEN v_run.start_date AND v_run.end_date
        )
      )
  LOOP
    v_penalties := v_penalties + COALESCE(v_comp.penalty_amount, 0);
    v_penalty_ids := array_append(v_penalty_ids, v_comp.id);
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', COALESCE(v_comp.penalty_reason, 'Penalty'),
      'item_type', 'deduction',
      'item_category', 'penalty',
      'calculated_amount', round(COALESCE(v_comp.penalty_amount, 0))
    ));
  END LOOP;

  v_gross := v_basic_prorated + v_allowances;
  v_target := GREATEST(0, v_gross - v_deductions - v_penalties);

  v_tax := public.payroll_calculate_tax_by_method(
    v_gross,
    COALESCE(v_info.ptkp_status, 'TK/0'),
    COALESCE(v_info.tax_method, 'gross'),
    NULL,
    v_non_taxable_annual,
    CASE WHEN COALESCE(v_info.tax_method, 'gross') IN ('netto', 'gross_up') THEN v_target ELSE NULL END
  );

  v_monthly_tax := COALESCE((v_tax->>'monthlyTax')::numeric, 0);
  v_employer_tax := COALESCE((v_tax->>'employerTaxCost')::numeric, 0);
  v_bpjs_k := COALESCE((v_tax->>'monthlyBpjsKesehatan')::numeric, 0);
  v_bpjs_p := COALESCE((v_tax->>'monthlyBpjsPensiun')::numeric, 0);

  IF v_bpjs_k > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', 'BPJS Kesehatan',
      'item_type', 'deduction',
      'item_category', 'bpjs_kesehatan',
      'calculated_amount', round(v_bpjs_k)
    ));
  END IF;

  IF v_bpjs_p > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', 'BPJS Pensiun',
      'item_type', 'deduction',
      'item_category', 'bpjs_pensiun',
      'calculated_amount', round(v_bpjs_p)
    ));
  END IF;

  IF v_monthly_tax + v_employer_tax > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'item_name', CASE WHEN COALESCE(v_info.tax_method, 'gross') = 'gross_up'
        THEN 'PPh 21 (Ditanggung Perusahaan)' ELSE 'PPh 21' END,
      'item_type', 'tax',
      'item_category', 'pph21',
      'calculated_amount', round(v_monthly_tax + v_employer_tax)
    ));
  END IF;

  IF COALESCE(v_info.tax_method, 'gross') = 'gross_up' THEN
    v_take_home := v_target;
  ELSE
    v_take_home := round(
      COALESCE((v_tax->>'takeHomePay')::numeric, v_gross - v_monthly_tax - v_bpjs_k - v_bpjs_p)
      - v_deductions - v_penalties
    );
  END IF;

  INSERT INTO public.employee_payroll_calculations (
    organization_id, employee_id, employee_payroll_info_id,
    payroll_period_id, payroll_run_id, tax_configuration_id,
    basic_salary, total_allowances, total_deductions, total_penalties,
    total_tax_deductions, gross_pay, net_pay, take_home_pay,
    total_taxes, total_tax_amount, tax_breakdown, calculation_details,
    calculation_status, payment_status
  ) VALUES (
    v_run.organization_id, p_employee_id, v_info.id,
    v_run.payroll_period_id, p_run_id, v_info.tax_configuration_id,
    v_basic_prorated, round(v_allowances), round(v_deductions + v_bpjs_k + v_bpjs_p + v_monthly_tax),
    round(v_penalties), round(v_monthly_tax + v_employer_tax),
    round(CASE WHEN COALESCE(v_info.tax_method, 'gross') = 'gross'
      THEN v_gross ELSE (v_tax->>'imputedMonthlyGross')::numeric END),
    v_take_home, v_take_home,
    (round(v_monthly_tax + v_employer_tax))::text,
    round(v_monthly_tax + v_employer_tax),
    v_tax->'taxBreakdown',
    jsonb_build_object(
      'taxMethod', COALESCE(v_info.tax_method, 'gross'),
      'prorateRatio', v_ratio,
      'overtimePay', v_overtime_pay,
      'penaltyIds', to_jsonb(v_penalty_ids)
    ),
    'calculated', 'pending'
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
    calculation_status = 'calculated',
    updated_at = now()
  RETURNING id INTO v_calc_id;

  DELETE FROM public.payroll_items WHERE payroll_calculation_id = v_calc_id;

  INSERT INTO public.payroll_items (
    organization_id, payroll_calculation_id, component_id,
    item_name, item_type, item_category, calculated_amount
  )
  SELECT
    v_run.organization_id,
    v_calc_id,
    NULLIF(elem->>'component_id', '')::uuid,
    elem->>'item_name',
    elem->>'item_type',
    elem->>'item_category',
    (elem->>'calculated_amount')::numeric
  FROM jsonb_array_elements(v_line_items) AS elem;

  IF array_length(v_penalty_ids, 1) IS NOT NULL THEN
    UPDATE public.attendance_penalties ap
    SET status = 'paid',
        payment_date = COALESCE(v_run.pay_date, CURRENT_DATE),
        updated_at = now()
    WHERE ap.id = ANY (v_penalty_ids)
      AND ap.status = 'active';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'calculationId', v_calc_id,
    'takeHomePay', v_take_home,
    'grossPay', v_gross
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Aggregate run totals
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_payroll_run_totals(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.payroll_runs WHERE id = p_run_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (v_org IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.payroll_runs pr
  SET
    total_employees = sub.cnt,
    total_gross_pay = sub.gross,
    total_net_pay = sub.net,
    total_deductions = sub.deductions,
    total_penalties = sub.penalties,
    total_taxes = sub.taxes,
    updated_at = now()
  FROM (
    SELECT
      COUNT(*)::integer AS cnt,
      COALESCE(SUM(gross_pay), 0) AS gross,
      COALESCE(SUM(take_home_pay), 0) AS net,
      COALESCE(SUM(total_deductions), 0) AS deductions,
      COALESCE(SUM(total_penalties), 0) AS penalties,
      COALESCE(SUM(total_tax_deductions), 0) AS taxes
    FROM public.employee_payroll_calculations
    WHERE payroll_run_id = p_run_id
  ) sub
  WHERE pr.id = p_run_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Main process payroll run
-- ---------------------------------------------------------------------------
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

  -- Re-process: remove non-paid calculations + items
  SELECT array_agg(id) INTO v_calc_ids
  FROM public.employee_payroll_calculations
  WHERE payroll_run_id = p_run_id
    AND payment_status IS DISTINCT FROM 'paid';

  IF v_calc_ids IS NOT NULL THEN
    DELETE FROM public.payroll_items WHERE payroll_calculation_id = ANY (v_calc_ids);
    DELETE FROM public.employee_payroll_calculations WHERE id = ANY (v_calc_ids);
  END IF;

  FOR v_emp IN
    SELECT e.id
    FROM public.employees e
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
        WHERE ec.payroll_run_id = p_run_id
          AND ec.employee_id = e.id
          AND ec.payment_status = 'paid'
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
  SET status = 'calculated',
      calculated_at = now(),
      calculated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_run_id;

  PERFORM public.calculate_payroll_run_totals(p_run_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Payroll processed: %s employee(s) calculated, %s skipped', v_created, v_skipped),
    'calculations_created', v_created,
    'calculations_skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_ptkp_amount(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_count_working_days(uuid, date, date, integer[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_employee_prorate_ratio(uuid, date, date, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_calculate_pph21_annualized(numeric, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_calculate_tax_by_method(numeric, text, text, numeric, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_calculate_overtime_pay(uuid, uuid, date, date, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_calculate_employee(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_payroll_run_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_payroll_run(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_payroll_run_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payroll_run(uuid) TO authenticated;
