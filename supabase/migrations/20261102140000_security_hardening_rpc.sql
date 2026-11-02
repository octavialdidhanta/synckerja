-- Mencatat perubahan yang sudah ada di database live.
-- Definisi fungsi disalin dari pg_get_functiondef.
-- Sudah ditandai applied di schema_migrations pada 2 November 2026 (via SQL Editor).

CREATE OR REPLACE FUNCTION public.user_has_org_role(p_org uuid, p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_org
      AND lower(role) = ANY (p_roles)
  );
$function$;

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

CREATE OR REPLACE FUNCTION public.get_payroll_disburse_preview(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT public.user_has_org_role(v_run.organization_id, ARRAY['owner','admin','hr']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.get_payroll_statutory_escrow_amounts(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run record;
  v_pph21 numeric := 0;
  v_bpjs_kes numeric := 0;
  v_bpjs_pen numeric := 0;
BEGIN
  SELECT pr.id, pr.organization_id, pr.status
  INTO v_run
  FROM public.payroll_runs pr
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

  SELECT COALESCE(SUM(pi.calculated_amount), 0)
  INTO v_pph21
  FROM public.payroll_items pi
  JOIN public.employee_payroll_calculations c ON c.id = pi.payroll_calculation_id
  WHERE c.payroll_run_id = p_run_id
    AND (
      pi.item_type = 'tax'
      OR lower(COALESCE(pi.item_category, '')) = 'pph21'
    );

  SELECT COALESCE(SUM(pi.calculated_amount), 0)
  INTO v_bpjs_kes
  FROM public.payroll_items pi
  JOIN public.employee_payroll_calculations c ON c.id = pi.payroll_calculation_id
  WHERE c.payroll_run_id = p_run_id
    AND lower(COALESCE(pi.item_category, '')) = 'bpjs_kesehatan';

  SELECT COALESCE(SUM(pi.calculated_amount), 0)
  INTO v_bpjs_pen
  FROM public.payroll_items pi
  JOIN public.employee_payroll_calculations c ON c.id = pi.payroll_calculation_id
  WHERE c.payroll_run_id = p_run_id
    AND lower(COALESCE(pi.item_category, '')) = 'bpjs_pensiun';

  RETURN jsonb_build_object(
    'success', true,
    'payroll_run_id', p_run_id,
    'organization_id', v_run.organization_id,
    'run_status', v_run.status,
    'amount_pph21', v_pph21,
    'amount_bpjs_kesehatan', v_bpjs_kes,
    'amount_bpjs_pensiun', v_bpjs_pen,
    'amount_total', v_pph21 + v_bpjs_kes + v_bpjs_pen
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.enable_pos_addon_zero_charge(p_org_id uuid, p_paid_outlet_count integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing integer;
  v_outlet_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.user_has_org_role(p_org_id, ARRAY['owner','admin']) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(os.pos_paid_outlet_count, 0)
  INTO v_existing
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization subscription not found';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_outlet_count
  FROM public.pos_outlets po
  WHERE po.organization_id = p_org_id
    AND COALESCE(po.is_deleted, false) = false;

  IF v_outlet_count > (1 + v_existing) THEN
    RAISE EXCEPTION 'active outlets (%) exceed POS quota (%)', v_outlet_count, (1 + v_existing);
  END IF;

  -- p_paid_outlet_count sengaja diabaikan: jumlah outlet berbayar
  -- hanya boleh dinaikkan dari server setelah pembayaran terverifikasi
  UPDATE public.organization_subscriptions
  SET pos_addon_active = true,
      updated_at = now()
  WHERE organization_id = p_org_id;
END;
$function$;

-- Anon dicabut. authenticated dan service_role tetap.
-- Daftar dari ops_private.anon_revoke_backup, urut sig.
-- Dua fungsi payroll di bawah ditambah sesudah daftar cadangan.

REVOKE EXECUTE ON FUNCTION public._lead_merge_execute_cluster(uuid,text,text,uuid,uuid[],uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._lead_merge_execute_cluster(uuid,text,text,uuid,uuid[],uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_ensure_lead(uuid,uuid,uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._synckerja_order_ensure_lead(uuid,uuid,uuid,text,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public._synckerja_order_fire_kitchen(uuid,uuid,uuid,uuid,text,text,jsonb,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._synckerja_order_fire_kitchen(uuid,uuid,uuid,uuid,text,text,jsonb,text,text,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.add_operational_email_recipient(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_operational_email_recipient(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_create_subscription_plan(text,numeric,jsonb,boolean,text,text,jsonb,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_subscription_plan(text,numeric,jsonb,boolean,text,text,jsonb,integer,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_delete_organization(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_organization(uuid,text,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_organization_sales_modules(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_organization_sales_modules(uuid,jsonb,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_organization_settings(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_organization_settings(uuid,boolean,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_organization_subscription(uuid,boolean,timestamp with time zone,timestamp with time zone,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_organization_subscription(uuid,boolean,timestamp with time zone,timestamp with time zone,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_plan_add_on_override(uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_plan_add_on_override(uuid,uuid,numeric,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_plan_modules(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_plan_modules(uuid,jsonb,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_subscription_add_on(uuid,numeric,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_add_on(uuid,numeric,boolean,boolean,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_subscription_plan(uuid,numeric,jsonb,integer,integer,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_plan(uuid,numeric,jsonb,integer,integer,boolean,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.apply_catalog_kitchen_commit_stock(uuid,uuid,uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_catalog_kitchen_commit_stock(uuid,uuid,uuid,jsonb,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.apply_catalog_stock_movement(uuid,uuid,text,uuid,uuid,uuid,text,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_catalog_stock_movement(uuid,uuid,text,uuid,uuid,uuid,text,numeric,text,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.apply_catalog_stock_reserve(uuid,uuid,uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_catalog_stock_reserve(uuid,uuid,uuid,jsonb,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.apply_meta_session_expired_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_meta_session_expired_conversations() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.apply_template_followup_customer_reply(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_template_followup_customer_reply(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.apply_template_followup_sent(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_template_followup_sent(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.approve_catalog_stock_transfer(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_catalog_stock_transfer(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_payroll_run_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_payroll_run_totals(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_catalog_purchase_order(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_catalog_purchase_order(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_catalog_stock_transfer(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_catalog_stock_transfer(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_social_media_scheduled_posts_for_plan(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_social_media_scheduled_posts_for_plan(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_po_update_avg_cost(uuid,uuid,text,uuid,uuid,uuid,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_po_update_avg_cost(uuid,uuid,text,uuid,uuid,uuid,numeric,numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_transfer_ensure_dest_row(uuid,uuid,text,uuid,uuid,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_ensure_dest_row(uuid,uuid,text,uuid,uuid,uuid,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.catalog_transfer_insert_event(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_insert_event(uuid,uuid,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.clear_customer_survey_assignee_target(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_customer_survey_assignee_target(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.clear_mfa_recovery_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_mfa_recovery_codes() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_bank_expense_mutation_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_bank_expense_mutation_match(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_bank_mutation_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_bank_mutation_match(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_income_bank_deposit(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_income_bank_deposit(uuid,text,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.consume_mfa_recovery_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_mfa_recovery_code(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_catalog_purchase_order(uuid,uuid,uuid,text,text,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_catalog_purchase_order(uuid,uuid,uuid,text,text,jsonb,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_catalog_stock_transfer(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_catalog_stock_transfer(uuid,uuid,uuid,text,text,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_expense_from_brick_debt_line(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_from_brick_debt_line(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_operational_email_recipient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_operational_email_recipient(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.dismiss_payroll_paid_announcement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_payroll_paid_announcement(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enable_pos_addon_zero_charge(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enable_pos_addon_zero_charge(uuid,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_google_ads_conversion_pending(uuid,uuid,uuid,timestamp with time zone,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_google_ads_conversion_pending(uuid,uuid,uuid,timestamp with time zone,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_google_contacts_sync(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_google_contacts_sync(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_pos_receipt_feedback_invitation(uuid,uuid,uuid,uuid,text,text,text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_pos_receipt_feedback_invitation(uuid,uuid,uuid,uuid,text,text,text,boolean,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_pos_shift_recap_email(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_pos_shift_recap_email(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_task_step_comment_push(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_task_step_comment_push(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_task_step_comment_reaction_push(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_task_step_comment_reaction_push(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_email_conversation_cycle(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_email_conversation_cycle(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_facebook_conversation_cycle(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_facebook_conversation_cycle(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_instagram_conversation_cycle(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_instagram_conversation_cycle(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_threads_conversation_cycle(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_threads_conversation_cycle(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_threads_dm_conversation_cycle(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_threads_dm_conversation_cycle(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_open_whatsapp_conversation_cycle(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_whatsapp_conversation_cycle(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fulfill_catalog_stock_transfer(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_catalog_stock_transfer(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_or_create_catalog_inventory_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_catalog_inventory_settings(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_or_create_operational_email_notification_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_operational_email_notification_settings(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_or_create_org_api_system_actor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_org_api_system_actor(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.insert_daily_task_assignment_notification(uuid,uuid,text,text,uuid,uuid,uuid,text,timestamp with time zone,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_daily_task_assignment_notification(uuid,uuid,text,text,uuid,uuid,uuid,text,timestamp with time zone,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.insert_daily_task_completion_notification(uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text,boolean,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_daily_task_completion_notification(uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text,boolean,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.insert_social_media_production_notification(uuid,uuid,text,uuid,text,uuid,uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_social_media_production_notification(uuid,uuid,text,uuid,text,uuid,uuid,uuid,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_auth_security_event(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_auth_security_event(text,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_bank_account_activity(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_bank_account_activity(uuid,uuid,text,text,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_brick_payment_request_paid(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_brick_payment_request_paid(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_facebook_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_facebook_conversation_read(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_instagram_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_instagram_conversation_read(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_oauth_registration_verified(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_oauth_registration_verified(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_payroll_run_paid(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_payroll_run_paid(uuid,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_social_media_production_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_social_media_production_notifications_read(uuid[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_task_step_comments_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_task_step_comments_read(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.maybe_finalize_payroll_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maybe_finalize_payroll_run(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_execute(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_execute(uuid,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_identity_graph_leads_execute(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_identity_graph_leads_execute(uuid,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_typo_email_leads_execute(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_typo_email_leads_execute(uuid,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.migrate_legacy_sku_to_catalog_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.migrate_legacy_sku_to_catalog_stock(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.payroll_calculate_employee(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_calculate_employee(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.payroll_log_audit(uuid,uuid,uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_log_audit(uuid,uuid,uuid,text,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_add_cash_movement(uuid,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_add_cash_movement(uuid,text,numeric,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_backfill_sales_item_unit_cogs(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_backfill_sales_item_unit_cogs(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_cancel_pending_checkout(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_cancel_pending_checkout(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_claim_synckerja_cashier_checkout(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_claim_synckerja_cashier_checkout(text,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_complete_synckerja_cashier_checkout(uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_complete_synckerja_cashier_checkout(uuid,uuid,uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_create_pending_checkout(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_create_pending_checkout(uuid,uuid,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_end_shift(uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_end_shift(uuid,numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_ensure_default_roles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_ensure_default_roles(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_finalize_qris_checkout(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_finalize_qris_checkout(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_invoice_cancel(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_invoice_cancel(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_mark_synckerja_cashier_kitchen_fired(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_mark_synckerja_cashier_kitchen_fired(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_refund_store_checkout(uuid,text,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_refund_store_checkout(uuid,text,uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_seed_default_payment_channels(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_seed_default_payment_channels(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_staff_clear_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_staff_clear_pin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_staff_set_outlets(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_staff_set_outlets(uuid,uuid[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_staff_set_pin(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_staff_set_pin(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_staff_sync_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_staff_sync_verified(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pos_start_shift(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_start_shift(uuid,uuid,numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_due_flow_delay_jobs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_due_flow_delay_jobs(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_payroll_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_payroll_run(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.purge_expired_google_ads_metrics_cache() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_google_ads_metrics_cache() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_xendit_disbursement_completed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_xendit_disbursement_completed(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_attendance_from_client_visit(uuid,uuid,date,uuid,uuid,timestamp with time zone,jsonb,text,text,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_attendance_from_client_visit(uuid,uuid,date,uuid,uuid,timestamp with time zone,jsonb,text,text,boolean,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_attendance_with_timezone(uuid,uuid,text,double precision,double precision,text,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_attendance_with_timezone(uuid,uuid,text,double precision,double precision,text,text,jsonb,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.recover_stale_publishing_rows(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recover_stale_publishing_rows(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_analytics_daily_click_rollups(date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_daily_click_rollups(date,date,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_budget_allocation_payout(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_budget_allocation_payout(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reject_bank_mutation_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_bank_mutation_match(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.release_catalog_stock_reserve(uuid,uuid,uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_catalog_stock_reserve(uuid,uuid,uuid,jsonb,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reply_pos_receipt_feedback(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_pos_receipt_feedback(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resign_employee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resign_employee(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_inventory_po_expense_classification(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_inventory_po_expense_classification(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resubmit_catalog_po_purchase_request(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_catalog_po_purchase_request(uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reverse_catalog_kitchen_commit(uuid,uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_catalog_kitchen_commit(uuid,uuid,text,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rollback_store_checkout_sales_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollback_store_checkout_sales_activity(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.run_bank_mutation_match_for_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_bank_mutation_match_for_org(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.seed_plan_module_access_defaults(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_plan_module_access_defaults(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.seed_sales_module_access_defaults(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_sales_module_access_defaults(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ship_catalog_stock_transfer(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ship_catalog_stock_transfer(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.start_client_visit_execution(uuid,uuid,date,uuid,uuid,timestamp with time zone,jsonb,text,uuid,jsonb,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_client_visit_execution(uuid,uuid,date,uuid,uuid,timestamp with time zone,jsonb,text,uuid,jsonb,numeric,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.store_mfa_recovery_codes(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_mfa_recovery_codes(text[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_analytics_web_access_for_web_id(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_analytics_web_access_for_web_id(uuid,text,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_catalog_po_purchase_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_catalog_po_purchase_request(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_milestones_from_payment_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_milestones_from_payment_status(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_payment_status_from_milestones(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_payment_status_from_milestones(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_pos_receipt_feedback_item_attributions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_pos_receipt_feedback_item_attributions(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_threshold_rows_from_payment_terms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_threshold_rows_from_payment_terms(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.try_acquire_social_media_publish_slot(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_acquire_social_media_publish_slot(uuid,text,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.unlink_bank_account_brick(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_bank_account_brick(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_catalog_purchase_order(uuid,uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_catalog_purchase_order(uuid,uuid,text,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_pos_shift_email_dispatch_language(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pos_shift_email_dispatch_language(uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_public_review_comment(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_public_review_comment(uuid,text,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_catalog_inventory_settings(uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_inventory_settings(uuid,text,text,jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_customer_survey_assignee_target(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_customer_survey_assignee_target(uuid,uuid,numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_kol_budget_allocation(uuid,uuid,uuid,numeric,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_kol_budget_allocation(uuid,uuid,uuid,numeric,text,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_operational_email_notification_settings(uuid,boolean,boolean,boolean,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_operational_email_notification_settings(uuid,boolean,boolean,boolean,boolean,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.verify_operational_email_recipient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_operational_email_recipient(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_payroll_disburse_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payroll_disburse_preview(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_payroll_statutory_escrow_amounts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payroll_statutory_escrow_amounts(uuid) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('mark_brick_payment_request_paid','_lead_merge_execute_cluster',
                        'payroll_calculate_employee','payroll_log_audit',
                        'calculate_payroll_run_totals','maybe_finalize_payroll_run')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
