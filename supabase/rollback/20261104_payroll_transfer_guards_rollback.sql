-- Rollback 20261104110000_payroll_transfer_guards.sql.
-- Bukan migration. Jalankan di SQL Editor.
-- Mengembalikan process_payroll_run dan mark_payroll_run_paid ke definisi
-- 2 November 2026 (disalin dari 20261102140000_security_hardening_rpc.sql,
-- sama dengan pg_get_functiondef live sebelum 4 November), lalu menghapus helper.

BEGIN;

CREATE OR REPLACE FUNCTION public.process_payroll_run(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT public.user_has_org_role(v_run.organization_id, ARRAY['owner','admin','hr']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_payroll_run_paid(p_run_id uuid, p_payment_reference text, p_payment_method text DEFAULT 'bank_transfer'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run record;
  v_pay_date timestamptz;
  v_updated integer;
  v_escrow record;
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

  IF NOT public.user_has_org_role(v_run.organization_id, ARRAY['owner','admin','hr']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_escrow
  FROM public.organization_payroll_escrow_settings
  WHERE organization_id = v_run.organization_id;

  IF COALESCE(v_escrow.is_enabled, false)
    AND COALESCE(v_escrow.require_xendit_disburse, true) THEN
    RAISE EXCEPTION 'payroll_escrow_requires_xendit_disburse'
      USING ERRCODE = 'P0001',
            DETAIL = 'Manual mark paid is disabled while payroll escrow requires Xendit disbursement.';
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
$function$;

DROP FUNCTION IF EXISTS public.payroll_run_transfer_in_flight(uuid);

COMMIT;
NOTIFY pgrst, 'reload schema';
