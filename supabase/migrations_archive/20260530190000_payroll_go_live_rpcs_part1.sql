-- Payroll go-live RPCs: TER v2, THR auto, audit log, mark paid, bank export log

-- ---------------------------------------------------------------------------
-- Internal audit helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_log_audit(
  p_org_id uuid,
  p_run_id uuid,
  p_calc_id uuid,
  p_action text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payroll_audit_log (
    organization_id, payroll_run_id, employee_calculation_id,
    action, actor_user_id, metadata
  ) VALUES (
    p_org_id, p_run_id, p_calc_id,
    p_action, auth.uid(), COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- TER category mapping (PP 58/2023)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_ter_category_for_employee(
  p_employee_tax_status text,
  p_ptkp_status text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_employee_tax_status, '') IN ('pegawai_tidak_tetap', 'freelancer') THEN 'C'
    WHEN COALESCE(p_ptkp_status, 'TK/0') IN ('TK/0', 'TK/1') THEN 'A'
    WHEN COALESCE(p_ptkp_status, 'TK/0') IN ('TK/2', 'TK/3', 'K/0') THEN 'B'
    ELSE 'C'
  END;
$$;

-- ---------------------------------------------------------------------------
-- THR amount for bonus period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_calculate_thr_amount(
  p_org_id uuid,
  p_employee_id uuid,
  p_basic_salary numeric,
  p_period_end date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_mode text;
  v_join date;
  v_year integer;
  v_months integer;
  v_year_start date;
BEGIN
  SELECT COALESCE(o.payroll_thr_calculation_mode, 'proportional')
  INTO v_mode
  FROM public.organizations o
  WHERE o.id = p_org_id;

  IF v_mode = 'manual_only' THEN
    RETURN 0;
  END IF;

  IF v_mode = 'full_month_salary' THEN
    RETURN round(GREATEST(COALESCE(p_basic_salary, 0), 0));
  END IF;

  SELECT COALESCE(e.join_date, e.hire_date)
  INTO v_join
  FROM public.employees e
  WHERE e.id = p_employee_id;

  v_year := EXTRACT(YEAR FROM p_period_end)::integer;
  v_year_start := make_date(v_year, 1, 1);

  IF v_join IS NULL OR v_join <= v_year_start THEN
    v_months := 12;
  ELSIF EXTRACT(YEAR FROM v_join)::integer > v_year THEN
    RETURN 0;
  ELSE
    v_months := GREATEST(
      1,
      (EXTRACT(YEAR FROM p_period_end)::integer * 12 + EXTRACT(MONTH FROM p_period_end)::integer)
      - (EXTRACT(YEAR FROM v_join)::integer * 12 + EXTRACT(MONTH FROM v_join)::integer)
      + 1
    );
    v_months := LEAST(12, v_months);
  END IF;

  RETURN round(GREATEST(COALESCE(p_basic_salary, 0), 0) * v_months / 12.0);
END;
$$;

-- ---------------------------------------------------------------------------
-- TER v2 with bracket lookup + BPJS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payroll_calculate_pph21_ter_v2(
  p_monthly_gross numeric,
  p_employee_tax_status text DEFAULT 'pegawai_tetap',
  p_ptkp_status text DEFAULT 'TK/0',
  p_effective_year integer DEFAULT 2024
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_gross numeric := GREATEST(COALESCE(p_monthly_gross, 0), 0);
  v_category text;
  v_rate numeric := 0;
  v_bracket record;
  v_tax numeric;
  v_bpjs_k numeric;
  v_bpjs_p numeric;
BEGIN
  v_category := public.payroll_ter_category_for_employee(p_employee_tax_status, p_ptkp_status);

  SELECT b.ter_rate, b.min_monthly_income, b.max_monthly_income
  INTO v_bracket
  FROM public.payroll_ter_brackets b
  WHERE b.category_code = v_category
    AND b.effective_year = p_effective_year
    AND v_gross >= b.min_monthly_income
    AND (b.max_monthly_income IS NULL OR v_gross <= b.max_monthly_income)
  ORDER BY b.min_monthly_income DESC
  LIMIT 1;

  v_rate := COALESCE(v_bracket.ter_rate, 0);
  v_tax := round(v_gross * v_rate);
  v_bpjs_k := round(LEAST(v_gross, 12000000) * 0.02);
  v_bpjs_p := round(LEAST(v_gross, 8930600) * 0.01);

  RETURN jsonb_build_object(
    'taxMethod', 'ter',
    'calculationMode', 'ter',
    'terCategory', v_category,
    'terRate', v_rate,
    'bracketMin', v_bracket.min_monthly_income,
    'bracketMax', v_bracket.max_monthly_income,
    'monthlyTax', v_tax,
    'monthlyBpjsKesehatan', v_bpjs_k,
    'monthlyBpjsPensiun', v_bpjs_p,
    'takeHomePay', round(v_gross - v_tax - v_bpjs_k - v_bpjs_p),
    'imputedMonthlyGross', round(v_gross),
    'employerTaxCost', 0,
    'taxBreakdown', jsonb_build_array(
      jsonb_build_object(
        'bracket', COALESCE(v_bracket.min_monthly_income::text, '0') || ' - ' || COALESCE(v_bracket.max_monthly_income::text, '∞'),
        'amount', round(v_gross),
        'tax', v_tax,
        'rate', v_rate * 100
      )
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Mark payroll run as paid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_payroll_run_paid(
  p_run_id uuid,
  p_payment_reference text,
  p_payment_method text DEFAULT 'bank_transfer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run record;
  v_pay_date timestamptz;
  v_updated integer;
BEGIN
  SELECT pr.*, pp.pay_date
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
    RETURN jsonb_build_object('success', true, 'message', 'Payroll run already marked as paid', 'already_paid', true);
  END IF;

  v_pay_date := COALESCE(v_run.pay_date::timestamptz, now());

  UPDATE public.employee_payroll_calculations
  SET payment_status = 'paid',
      payment_date = v_pay_date,
      payment_method = COALESCE(p_payment_method, 'bank_transfer'),
      payment_reference = p_payment_reference,
      updated_at = now()
  WHERE payroll_run_id = p_run_id
    AND payment_status IS DISTINCT FROM 'paid';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.payroll_runs
  SET status = 'paid',
      paid_at = now(),
      paid_by = auth.uid(),
      updated_at = now()
  WHERE id = p_run_id;

  PERFORM public.payroll_log_audit(
    v_run.organization_id, p_run_id, NULL, 'marked_paid',
    jsonb_build_object('payment_reference', p_payment_reference, 'calculations_updated', v_updated)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Marked %s calculation(s) as paid', v_updated),
    'calculations_updated', v_updated
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Log bank export from client
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_payroll_bank_export(
  p_run_id uuid,
  p_row_count integer DEFAULT 0
)
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
  PERFORM public.payroll_log_audit(
    v_org, p_run_id, NULL, 'export_bank',
    jsonb_build_object('row_count', COALESCE(p_row_count, 0))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_log_audit(uuid, uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_ter_category_for_employee(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_calculate_thr_amount(uuid, uuid, numeric, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_calculate_pph21_ter_v2(numeric, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_payroll_run_paid(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_payroll_bank_export(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mark_payroll_run_paid(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_payroll_bank_export(uuid, integer) TO authenticated;
