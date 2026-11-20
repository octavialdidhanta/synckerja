-- Hardening 4 November 2026: payroll saat transfer berjalan (langkah 1 & 2).
-- Rollback: supabase/rollback/20261104_payroll_transfer_guards_rollback.sql
--
-- 1) process_payroll_run menghapus semua kalkulasi yang belum 'paid', termasuk
--    'processing' (sedang ditransfer Xendit/Brick). Kalkulasi baru lalu bisa
--    di-disburse lagi: karyawan dibayar dua kali, dan callback transfer pertama
--    tidak menemukan barisnya. Sekarang ditolak selama ada kalkulasi
--    'processing' atau transfer pending/processing/completed untuk kalkulasi
--    yang belum 'paid'.
-- 2) mark_payroll_run_paid mengubah semua yang belum 'paid' menjadi 'paid',
--    termasuk 'failed'. Sekarang hanya 'pending' (dibayar manual). Ditolak
--    selama ada 'processing'. Run baru 'paid' bila tidak ada 'failed' tersisa;
--    kalau ada, run tetap 'calculated' sampai transfer gagal ditangani
--    (maybe_finalize_payroll_run menutup run setelah semuanya 'paid').
-- Keduanya mengunci baris payroll_runs (FOR UPDATE) agar dua klik bersamaan
-- tidak saling menimpa. Cek org dan role tetap sama.

CREATE OR REPLACE FUNCTION public.payroll_run_transfer_in_flight(p_run_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Jumlah kalkulasi (belum 'paid') di run ini yang uangnya sedang atau sudah dikirim.
  SELECT count(*)::integer
  FROM public.employee_payroll_calculations c
  WHERE c.payroll_run_id = p_run_id
    AND c.payment_status IS DISTINCT FROM 'paid'
    AND (
      c.payment_status = 'processing'
      OR EXISTS (
        SELECT 1 FROM public.xendit_disbursements x
        WHERE x.source_type = 'payroll_calculation'
          AND x.source_id = c.id
          AND x.status IN ('pending', 'processing', 'completed')
      )
      OR EXISTS (
        SELECT 1 FROM public.brick_disbursements b
        WHERE b.source_type = 'payroll_calculation'
          AND b.source_id = c.id
          AND b.status IN ('pending', 'processing', 'completed')
      )
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.payroll_run_transfer_in_flight(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_run_transfer_in_flight(uuid) TO service_role;

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
  v_in_flight integer;
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

  -- Kunci run: proses ulang, mark paid, dan finalisasi tidak boleh berjalan bersamaan.
  PERFORM 1 FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
  v_run.status := (SELECT status FROM public.payroll_runs WHERE id = p_run_id);

  IF v_run.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot process a paid payroll run');
  END IF;

  v_in_flight := public.payroll_run_transfer_in_flight(p_run_id);
  IF v_in_flight > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format(
        'Tidak bisa proses ulang: %s transfer gaji sedang berjalan atau sudah terkirim. Tunggu sampai selesai, lalu tangani yang gagal lewat Retry.',
        v_in_flight
      ),
      'transfers_in_flight', v_in_flight
    );
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
  v_processing integer;
  v_failed integer;
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

  PERFORM 1 FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
  v_run.status := (SELECT status FROM public.payroll_runs WHERE id = p_run_id);

  IF v_run.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Payroll run already marked as paid', 'already_paid', true);
  END IF;

  SELECT
    count(*) FILTER (WHERE payment_status = 'processing'),
    count(*) FILTER (WHERE payment_status = 'failed')
  INTO v_processing, v_failed
  FROM public.employee_payroll_calculations
  WHERE payroll_run_id = p_run_id;

  IF v_processing > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('%s transfer gaji masih berjalan. Tunggu sampai selesai sebelum mark as paid.', v_processing),
      'processing', v_processing
    );
  END IF;

  v_pay_date := COALESCE(v_run.pay_date::timestamptz, now());

  -- Hanya 'pending' (dibayar manual). 'failed' tetap terlihat untuk Retry.
  UPDATE public.employee_payroll_calculations
  SET payment_status = 'paid',
      payment_date = v_pay_date,
      payment_method = COALESCE(p_payment_method, 'bank_transfer'),
      payment_reference = p_payment_reference,
      updated_at = now()
  WHERE payroll_run_id = p_run_id
    AND payment_status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_failed > 0 THEN
    PERFORM public.payroll_log_audit(
      v_run.organization_id, p_run_id, NULL, 'marked_paid',
      jsonb_build_object('payment_reference', p_payment_reference, 'calculations_updated', v_updated, 'failed_remaining', v_failed, 'partial', true)
    );
    RETURN jsonb_build_object(
      'success', true,
      'message', format('%s kalkulasi ditandai paid. %s transfer gagal belum dibayar; tangani lewat Retry. Run belum ditutup.', v_updated, v_failed),
      'calculations_updated', v_updated,
      'failed_remaining', v_failed,
      'run_paid', false
    );
  END IF;

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
    'calculations_updated', v_updated,
    'run_paid', true
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.process_payroll_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_payroll_run(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.mark_payroll_run_paid(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_payroll_run_paid(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
