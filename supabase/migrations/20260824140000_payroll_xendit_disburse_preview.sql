-- Payroll Xendit disburse: preview RPC, auto-finalize run, audit action extension.

ALTER TABLE public.payroll_audit_log
  DROP CONSTRAINT IF EXISTS payroll_audit_log_action_check;

ALTER TABLE public.payroll_audit_log
  ADD CONSTRAINT payroll_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'calculated'::text,
    'reprocessed'::text,
    'marked_paid'::text,
    'export_bank'::text,
    'payslip_generated'::text,
    'xendit_disburse_batch'::text
  ]::text[]));

-- ---------------------------------------------------------------------------
-- Preview pending payroll disbursements for a run (read-only).
-- ---------------------------------------------------------------------------
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
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Auto-close payroll run when all calculations are paid.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maybe_finalize_payroll_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run record;
  v_pending integer;
  v_processing integer;
  v_failed integer;
  v_paid integer;
  v_total integer;
BEGIN
  SELECT pr.id, pr.organization_id, pr.status, pp.pay_date
  INTO v_run
  FROM public.payroll_runs pr
  JOIN public.payroll_periods pp ON pp.id = pr.payroll_period_id
  WHERE pr.id = p_run_id;

  IF v_run IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Payroll run not found');
  END IF;

  IF v_run.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'finalized', false, 'already_paid', true);
  END IF;

  SELECT
    count(*) FILTER (WHERE payment_status = 'pending'),
    count(*) FILTER (WHERE payment_status = 'processing'),
    count(*) FILTER (WHERE payment_status = 'failed'),
    count(*) FILTER (WHERE payment_status = 'paid'),
    count(*)
  INTO v_pending, v_processing, v_failed, v_paid, v_total
  FROM public.employee_payroll_calculations
  WHERE payroll_run_id = p_run_id;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', true, 'finalized', false, 'message', 'No calculations');
  END IF;

  IF v_pending > 0 OR v_processing > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'finalized', false,
      'pending', v_pending,
      'processing', v_processing,
      'failed', v_failed,
      'paid', v_paid
    );
  END IF;

  IF v_failed > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'finalized', false,
      'has_failures', true,
      'failed', v_failed,
      'paid', v_paid
    );
  END IF;

  IF v_paid = v_total THEN
    UPDATE public.payroll_runs
    SET status = 'paid',
        paid_at = COALESCE(v_run.pay_date::timestamptz, now()),
        paid_by = auth.uid(),
        updated_at = now()
    WHERE id = p_run_id;

    PERFORM public.payroll_log_audit(
      v_run.organization_id,
      p_run_id,
      NULL,
      'marked_paid',
      jsonb_build_object('source', 'auto_finalize', 'calculations_paid', v_paid)
    );

    RETURN jsonb_build_object(
      'success', true,
      'finalized', true,
      'paid', v_paid
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'finalized', false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_disburse_preview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.maybe_finalize_payroll_run(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_payroll_disburse_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_finalize_payroll_run(uuid) TO authenticated;
