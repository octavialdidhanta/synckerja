-- Payroll THP auto-post to expenses dashboard (Xendit disburse only, default OFF per org).

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
    'payroll_escrow_transfer_skipped'::text,
    'payroll_expense_posted'::text,
    'payroll_expense_post_skipped'::text,
    'payroll_expense_post_failed'::text
  ]::text[]));

-- ---------------------------------------------------------------------------
-- Org settings (default OFF per tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_payroll_expense_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  expense_type_name text NOT NULL DEFAULT 'Fixed Expenses',
  expense_category_name text NOT NULL DEFAULT 'Gaji Karyawan Tetap',
  department text NOT NULL DEFAULT 'Finance',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.organization_payroll_expense_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_payroll_expense_settings_org_select
  ON public.organization_payroll_expense_settings;
CREATE POLICY organization_payroll_expense_settings_org_select
  ON public.organization_payroll_expense_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- expenses.payroll_run_id (1:1 idempotency per run)
-- ---------------------------------------------------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payroll_run_id uuid NULL REFERENCES public.payroll_runs (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_payroll_run_id
  ON public.expenses (payroll_run_id)
  WHERE payroll_run_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Block mutation of auto-posted payroll expenses
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_payroll_expense_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.payroll_run_id IS NOT NULL THEN
      RAISE EXCEPTION 'payroll_expense_readonly'
        USING ERRCODE = 'P0001',
              DETAIL = 'Payroll THP expenses cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.payroll_run_id IS NOT NULL THEN
    IF NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id
      OR NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.expense_name IS DISTINCT FROM OLD.expense_name
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'payroll_expense_readonly'
        USING ERRCODE = 'P0001',
              DETAIL = 'Payroll THP expenses are read-only.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payroll_expense_mutation ON public.expenses;
CREATE TRIGGER trg_prevent_payroll_expense_mutation
  BEFORE UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payroll_expense_mutation();

-- ---------------------------------------------------------------------------
-- Skip internal wallet debit when THP already left via Xendit disbursement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_expense_gateway_wallet_debit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usable numeric;
BEGIN
  IF NEW.gateway_wallet_provider IS NULL OR NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.purchase_request_id IS NOT NULL THEN
    IF NEW.gateway_wallet_provider = 'xendit' AND EXISTS (
      SELECT 1 FROM public.xendit_disbursements xd
      WHERE xd.source_type = 'purchase_request'
        AND xd.source_id = NEW.purchase_request_id
        AND xd.status = 'completed'
    ) THEN
      RETURN NEW;
    END IF;

    IF NEW.gateway_wallet_provider = 'brick' AND EXISTS (
      SELECT 1 FROM public.brick_disbursements bd
      WHERE bd.source_type = 'purchase_request'
        AND bd.source_id = NEW.purchase_request_id
        AND bd.status = 'completed'
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.payroll_run_id IS NOT NULL AND NEW.gateway_wallet_provider = 'xendit' AND EXISTS (
    SELECT 1 FROM public.xendit_disbursements xd
    JOIN public.employee_payroll_calculations c ON c.id = xd.source_id
    WHERE xd.source_type = 'payroll_calculation'
      AND c.payroll_run_id = NEW.payroll_run_id
      AND xd.status = 'completed'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT usable_balance INTO v_usable
  FROM public.organization_gateway_wallets
  WHERE organization_id = NEW.organization_id
    AND provider = NEW.gateway_wallet_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gateway wallet not configured for provider %', NEW.gateway_wallet_provider;
  END IF;

  IF v_usable < NEW.amount THEN
    RAISE EXCEPTION 'Insufficient gateway wallet balance (provider %, available %, required %)',
      NEW.gateway_wallet_provider, v_usable, NEW.amount;
  END IF;

  UPDATE public.organization_gateway_wallets
  SET
    usable_balance = usable_balance - NEW.amount,
    total_balance = GREATEST(0, total_balance - NEW.amount),
    updated_at = now()
  WHERE organization_id = NEW.organization_id
    AND provider = NEW.gateway_wallet_provider;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Finalize: insert one THP expense per paid payroll run (idempotent)
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) IS
  'After payroll run finalized paid via Xendit: insert one THP expense row (idempotent per run).';
