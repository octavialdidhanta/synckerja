-- Payroll statutory escrow: PPh21 + BPJS auto-transfer to dedicated Xendit sub-account.

-- ---------------------------------------------------------------------------
-- Audit actions
-- ---------------------------------------------------------------------------
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
    'xendit_disburse_batch'::text,
    'payslip_notified'::text,
    'payroll_escrow_transfer'::text,
    'payroll_escrow_transfer_failed'::text,
    'payroll_escrow_transfer_skipped'::text
  ]::text[]));

-- ---------------------------------------------------------------------------
-- Org settings (default OFF per tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_payroll_escrow_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  escrow_sub_account_row_id uuid NULL REFERENCES public.xendit_sub_accounts (id) ON DELETE SET NULL,
  require_xendit_disburse boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.organization_payroll_escrow_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_payroll_escrow_settings_org_select
  ON public.organization_payroll_escrow_settings;
CREATE POLICY organization_payroll_escrow_settings_org_select
  ON public.organization_payroll_escrow_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Transfer ledger (one row per payroll run)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_xendit_escrow_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  payroll_run_id uuid NOT NULL UNIQUE REFERENCES public.payroll_runs (id) ON DELETE CASCADE,
  source_sub_account_row_id uuid NOT NULL REFERENCES public.xendit_sub_accounts (id) ON DELETE RESTRICT,
  dest_sub_account_row_id uuid NOT NULL REFERENCES public.xendit_sub_accounts (id) ON DELETE RESTRICT,
  amount_pph21 numeric NOT NULL DEFAULT 0,
  amount_bpjs_kesehatan numeric NOT NULL DEFAULT 0,
  amount_bpjs_pensiun numeric NOT NULL DEFAULT 0,
  amount_total numeric NOT NULL DEFAULT 0,
  xendit_transfer_id text NULL,
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  failure_code text NULL,
  failure_message text NULL,
  initiated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_xendit_escrow_transfers_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'skipped'::text])
  ),
  CONSTRAINT payroll_xendit_escrow_transfers_amount_nonneg CHECK (
    amount_pph21 >= 0
    AND amount_bpjs_kesehatan >= 0
    AND amount_bpjs_pensiun >= 0
    AND amount_total >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_xendit_escrow_transfers_reference
  ON public.payroll_xendit_escrow_transfers (reference);

CREATE INDEX IF NOT EXISTS idx_payroll_xendit_escrow_transfers_org
  ON public.payroll_xendit_escrow_transfers (organization_id, created_at DESC);

ALTER TABLE public.payroll_xendit_escrow_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_xendit_escrow_transfers_org_select
  ON public.payroll_xendit_escrow_transfers;
CREATE POLICY payroll_xendit_escrow_transfers_org_select
  ON public.payroll_xendit_escrow_transfers FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Statutory escrow amounts for a run (PPh21 + BPJS employee portions only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payroll_statutory_escrow_amounts(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_payroll_statutory_escrow_amounts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payroll_statutory_escrow_amounts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payroll_statutory_escrow_amounts(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Block manual mark paid when escrow requires Xendit disburse
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
$$;

COMMENT ON TABLE public.organization_payroll_escrow_settings IS
  'Per-org payroll statutory escrow (PPh21 + BPJS). Default disabled.';
COMMENT ON TABLE public.payroll_xendit_escrow_transfers IS
  'Xendit xenPlatform transfer from primary sub-account to escrow sub-account after payroll run paid.';
