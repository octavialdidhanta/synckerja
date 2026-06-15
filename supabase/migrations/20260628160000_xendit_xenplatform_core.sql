-- Xendit xenPlatform: sub-accounts, VA, disbursements, webhooks.

-- ---------------------------------------------------------------------------
-- organization_xendit_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_xendit_accounts (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  xendit_sub_account_id text NULL,
  business_name text NOT NULL,
  email text NOT NULL,
  account_type text NOT NULL DEFAULT 'OWNED',
  is_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  kyc_status text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_xendit_accounts_status_check CHECK (
    status = ANY (ARRAY['pending', 'active', 'suspended', 'failed']::text[])
  ),
  CONSTRAINT organization_xendit_accounts_account_type_check CHECK (
    account_type = ANY (ARRAY['OWNED', 'MANAGED']::text[])
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_xendit_sub_account_id
  ON public.organization_xendit_accounts (xendit_sub_account_id)
  WHERE xendit_sub_account_id IS NOT NULL;

ALTER TABLE public.organization_xendit_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_xendit_accounts_org_select ON public.organization_xendit_accounts;
CREATE POLICY organization_xendit_accounts_org_select
  ON public.organization_xendit_accounts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- xendit_platform_config (singleton row id = 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xendit_platform_config (
  id smallint NOT NULL PRIMARY KEY DEFAULT 1,
  flat_fee_amount integer NOT NULL DEFAULT 2000,
  split_rule_id text NULL,
  master_account_id text NULL,
  va_expiration_days integer NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xendit_platform_config_singleton CHECK (id = 1),
  CONSTRAINT xendit_platform_config_flat_fee_nonneg CHECK (flat_fee_amount >= 0)
);

INSERT INTO public.xendit_platform_config (id, flat_fee_amount, va_expiration_days)
VALUES (1, 2000, 3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.xendit_platform_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xendit_platform_config_select ON public.xendit_platform_config;
CREATE POLICY xendit_platform_config_select
  ON public.xendit_platform_config FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- xendit_payment_requests (Virtual Account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xendit_payment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_payment_id uuid NOT NULL REFERENCES public.sales_activity_payments (id) ON DELETE CASCADE,
  sub_account_id text NOT NULL,
  external_id text NOT NULL,
  xendit_va_id text NULL,
  bank_code text NOT NULL,
  account_number text NULL,
  expected_amount numeric NOT NULL,
  platform_fee_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz NULL,
  xendit_payment_id text NULL,
  raw_response jsonb NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xendit_payment_requests_status_check CHECK (
    status = ANY (ARRAY['pending', 'paid', 'expired', 'failed']::text[])
  ),
  CONSTRAINT xendit_payment_requests_expected_amount_positive CHECK (expected_amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_payment_requests_external_id
  ON public.xendit_payment_requests (external_id);
CREATE INDEX IF NOT EXISTS idx_xendit_payment_requests_org
  ON public.xendit_payment_requests (organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_payment_requests_active_sap
  ON public.xendit_payment_requests (sales_activity_payment_id)
  WHERE status = 'pending';

ALTER TABLE public.xendit_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xendit_payment_requests_org_select ON public.xendit_payment_requests;
CREATE POLICY xendit_payment_requests_org_select
  ON public.xendit_payment_requests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- xendit_disbursements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xendit_disbursements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  sub_account_id text NOT NULL,
  external_id text NOT NULL,
  bank_code text NOT NULL,
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  amount numeric NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'pending',
  xendit_disbursement_id text NULL,
  failure_code text NULL,
  failure_message text NULL,
  initiated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xendit_disbursements_source_type_check CHECK (
    source_type = ANY (
      ARRAY['payroll_calculation', 'purchase_request', 'debt_payment', 'payroll_run_batch']::text[]
    )
  ),
  CONSTRAINT xendit_disbursements_status_check CHECK (
    status = ANY (ARRAY['pending', 'processing', 'completed', 'failed']::text[])
  ),
  CONSTRAINT xendit_disbursements_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_disbursements_external_id
  ON public.xendit_disbursements (external_id);
CREATE INDEX IF NOT EXISTS idx_xendit_disbursements_org
  ON public.xendit_disbursements (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xendit_disbursements_source
  ON public.xendit_disbursements (source_type, source_id);

ALTER TABLE public.xendit_disbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xendit_disbursements_org_select ON public.xendit_disbursements;
CREATE POLICY xendit_disbursements_org_select
  ON public.xendit_disbursements FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- xendit_webhook_events (idempotency)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xendit_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  xendit_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_webhook_events_event_id
  ON public.xendit_webhook_events (xendit_event_id);

ALTER TABLE public.xendit_webhook_events ENABLE ROW LEVEL SECURITY;

-- No select policy for authenticated — service role only.

-- ---------------------------------------------------------------------------
-- Extensions: bank_accounts, purchase_requests, debt_payments
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS use_for_xendit_income boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bank_accounts.use_for_xendit_income IS
  'When true, Xendit VA settlements credit this bank account ledger.';

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS vendor_bank_code text NULL,
  ADD COLUMN IF NOT EXISTS vendor_bank_account_number text NULL,
  ADD COLUMN IF NOT EXISTS vendor_bank_account_holder text NULL;

ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS xendit_disbursement_id uuid NULL REFERENCES public.xendit_disbursements (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- RPC: apply Xendit VA settlement → piutang + income + bank balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_xendit_va_settlement(
  p_payment_request_id uuid,
  p_xendit_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.xendit_payment_requests%ROWTYPE;
  v_sap public.sales_activity_payments%ROWTYPE;
  v_sa public.sales_activities%ROWTYPE;
  v_bank_id uuid;
  v_income_id uuid;
  v_amount numeric;
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  SELECT * INTO v_req FROM public.xendit_payment_requests WHERE id = p_payment_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'xendit_payment_request_not_found';
  END IF;
  IF v_req.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  SELECT * INTO v_sap FROM public.sales_activity_payments WHERE id = v_req.sales_activity_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_activity_payment_not_found';
  END IF;

  SELECT * INTO v_sa FROM public.sales_activities WHERE id = v_sap.sales_activity_id;

  SELECT ba.id INTO v_bank_id
  FROM public.bank_accounts ba
  WHERE ba.organization_id = v_req.organization_id
    AND ba.use_for_xendit_income = true
    AND ba.is_active = true
  ORDER BY ba.created_at ASC
  LIMIT 1;

  IF v_bank_id IS NULL THEN
    SELECT ba.id INTO v_bank_id
    FROM public.bank_accounts ba
    WHERE ba.organization_id = v_req.organization_id
      AND ba.is_active = true
    ORDER BY ba.created_at ASC
    LIMIT 1;
  END IF;

  v_amount := v_sap.payment_amount;

  UPDATE public.xendit_payment_requests
  SET status = 'paid', paid_at = now(), xendit_payment_id = COALESCE(p_xendit_payment_id, xendit_payment_id), updated_at = now()
  WHERE id = v_req.id;

  UPDATE public.sales_activity_payments
  SET
    transfer_verification_status = 'approved',
    transfer_verified_at = now(),
    payment_method = 'xendit_va',
    notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END || 'Paid via Xendit VA'
  WHERE id = v_sap.id;

  SELECT id INTO v_income_id
  FROM public.income_transactions
  WHERE organization_id = v_req.organization_id
    AND sales_activity_payment_id = v_sap.id
  LIMIT 1;

  IF v_income_id IS NULL THEN
    INSERT INTO public.income_transactions (
      organization_id, user_id, transaction_date, amount, customer_name, payment_method,
      description, bank_account_id, sales_activity_payment_id, status, created_by
    )
    VALUES (
      v_req.organization_id,
      v_sap.created_by,
      CURRENT_DATE,
      v_amount,
      COALESCE(v_sa.client_name, 'Customer'),
      'xendit_va',
      'Xendit VA - Piutang payment',
      v_bank_id,
      v_sap.id,
      'completed',
      v_sap.created_by
    )
    RETURNING id INTO v_income_id;
  ELSE
    UPDATE public.income_transactions
    SET status = 'completed', bank_account_id = COALESCE(bank_account_id, v_bank_id), payment_method = 'xendit_va'
    WHERE id = v_income_id;
  END IF;

  IF v_bank_id IS NOT NULL AND v_amount > 0 THEN
    INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
    VALUES (v_bank_id, v_req.organization_id, 0)
    ON CONFLICT (bank_account_id) DO NOTHING;

    SELECT balance INTO v_balance_before
    FROM public.bank_account_balances
    WHERE bank_account_id = v_bank_id
    FOR UPDATE;

    v_balance_after := COALESCE(v_balance_before, 0) + v_amount;

    UPDATE public.bank_account_balances
    SET balance = v_balance_after, updated_at = now()
    WHERE bank_account_id = v_bank_id;

    INSERT INTO public.bank_account_balance_history (
      bank_account_id, organization_id, transaction_type, transaction_id,
      amount, balance_before, balance_after, description, created_by
    ) VALUES (
      v_bank_id,
      v_req.organization_id,
      'income',
      v_income_id,
      v_amount,
      COALESCE(v_balance_before, 0),
      v_balance_after,
      'Xendit VA settlement',
      v_sap.created_by
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'income_id', v_income_id, 'bank_account_id', v_bank_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_xendit_va_settlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_xendit_va_settlement(uuid, text) TO service_role;
