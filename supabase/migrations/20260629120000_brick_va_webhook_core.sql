-- Brick VA v2: payment requests, webhook idempotency, settlement RPC, statement upsert.

-- ---------------------------------------------------------------------------
-- organization_brick_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_brick_settings (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  auto_confirm_on_completed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_brick_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_brick_settings_org_select ON public.organization_brick_settings;
CREATE POLICY organization_brick_settings_org_select
  ON public.organization_brick_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- brick_payment_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brick_payment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_payment_id uuid NOT NULL REFERENCES public.sales_activity_payments (id) ON DELETE CASCADE,
  reference_id text NOT NULL,
  brick_va_id text NULL,
  brick_payment_id text NULL,
  bank_short_code text NOT NULL,
  account_no text NULL,
  expected_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz NULL,
  completed_at timestamptz NULL,
  raw_response jsonb NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brick_payment_requests_status_check CHECK (
    status = ANY (ARRAY['pending', 'paid', 'completed', 'expired', 'failed']::text[])
  ),
  CONSTRAINT brick_payment_requests_expected_amount_positive CHECK (expected_amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brick_payment_requests_reference_id
  ON public.brick_payment_requests (reference_id);
CREATE INDEX IF NOT EXISTS idx_brick_payment_requests_org
  ON public.brick_payment_requests (organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brick_payment_requests_active_sap
  ON public.brick_payment_requests (sales_activity_payment_id)
  WHERE status IN ('pending', 'paid');

ALTER TABLE public.brick_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brick_payment_requests_org_select ON public.brick_payment_requests;
CREATE POLICY brick_payment_requests_org_select
  ON public.brick_payment_requests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- brick_webhook_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brick_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brick_event_id text NOT NULL,
  event_type text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brick_webhook_events_event_id
  ON public.brick_webhook_events (brick_event_id);

ALTER TABLE public.brick_webhook_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- deposit_source: brick_va
-- ---------------------------------------------------------------------------
ALTER TABLE public.income_transactions
  DROP CONSTRAINT IF EXISTS income_transactions_deposit_source_check;

ALTER TABLE public.income_transactions
  ADD CONSTRAINT income_transactions_deposit_source_check CHECK (
    deposit_source IS NULL
    OR deposit_source = ANY (
      ARRAY[
        'manual_verification'::text,
        'xendit_va'::text,
        'manual_admin'::text,
        'brick_mutasi'::text,
        'brick_va'::text
      ]
    )
  );

COMMENT ON COLUMN public.income_transactions.deposit_source IS
  'manual_verification | xendit_va | manual_admin | brick_mutasi | brick_va';

-- ---------------------------------------------------------------------------
-- Resolve linked bank account for Brick VA settlement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_brick_va_bank_account_id(p_organization_id uuid, p_bank_short_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id uuid;
  v_code text := upper(trim(p_bank_short_code));
BEGIN
  SELECT ba.id INTO v_bank_id
  FROM public.bank_accounts ba
  WHERE ba.organization_id = p_organization_id
    AND ba.is_active = true
    AND ba.brick_link_status = 'linked'
    AND (
      upper(ba.bank_name) LIKE '%' || replace(v_code, 'MANDIRI', 'MANDIRI') || '%'
      OR (v_code = 'MANDIRI' AND upper(ba.bank_name) LIKE '%MANDIRI%')
      OR (v_code = 'BRI' AND upper(ba.bank_name) LIKE '%BRI%')
      OR (v_code = 'BCA' AND upper(ba.bank_name) LIKE '%BCA%')
    )
  ORDER BY ba.use_for_omnichannel_income DESC, ba.created_at ASC
  LIMIT 1;

  IF v_bank_id IS NOT NULL THEN
    RETURN v_bank_id;
  END IF;

  SELECT ba.id INTO v_bank_id
  FROM public.bank_accounts ba
  WHERE ba.organization_id = p_organization_id
    AND ba.use_for_omnichannel_income = true
    AND ba.is_active = true
  ORDER BY ba.created_at ASC
  LIMIT 1;

  IF v_bank_id IS NOT NULL THEN
    RETURN v_bank_id;
  END IF;

  SELECT ba.id INTO v_bank_id
  FROM public.bank_accounts ba
  WHERE ba.organization_id = p_organization_id
    AND ba.is_active = true
  ORDER BY ba.created_at ASC
  LIMIT 1;

  RETURN v_bank_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_brick_va_bank_account_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_brick_va_bank_account_id(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Upsert bank statement line from Brick callback
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_bank_statement_from_brick_callback(
  p_organization_id uuid,
  p_bank_account_id uuid,
  p_external_id text,
  p_transaction_date timestamptz,
  p_amount numeric,
  p_description text,
  p_reference text,
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line_id uuid;
BEGIN
  IF p_external_id IS NULL OR btrim(p_external_id) = '' THEN
    RAISE EXCEPTION 'brick_statement_external_id_required';
  END IF;

  SELECT id INTO v_line_id
  FROM public.bank_statement_lines
  WHERE organization_id = p_organization_id
    AND external_id = p_external_id
  LIMIT 1;

  IF v_line_id IS NOT NULL THEN
    UPDATE public.bank_statement_lines
    SET
      amount = p_amount,
      description = COALESCE(p_description, description),
      reference = COALESCE(p_reference, reference),
      raw_payload = p_raw_payload,
      synced_at = now()
    WHERE id = v_line_id;
    RETURN v_line_id;
  END IF;

  INSERT INTO public.bank_statement_lines (
    organization_id,
    bank_account_id,
    external_id,
    transaction_date,
    amount,
    direction,
    description,
    reference,
    raw_payload,
    synced_at
  ) VALUES (
    p_organization_id,
    p_bank_account_id,
    p_external_id,
    p_transaction_date,
    p_amount,
    'credit',
    p_description,
    p_reference,
    p_raw_payload,
    now()
  )
  RETURNING id INTO v_line_id;

  RETURN v_line_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_bank_statement_from_brick_callback(
  uuid, uuid, text, timestamptz, numeric, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_brick_callback(
  uuid, uuid, text, timestamptz, numeric, text, text, jsonb
) TO service_role;

-- ---------------------------------------------------------------------------
-- apply_brick_va_settlement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_brick_va_settlement(
  p_brick_payment_request_id uuid,
  p_brick_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.brick_payment_requests%ROWTYPE;
  v_sap public.sales_activity_payments%ROWTYPE;
  v_sa public.sales_activities%ROWTYPE;
  v_bank_id uuid;
  v_income_id uuid;
  v_income public.income_transactions%ROWTYPE;
  v_amount numeric;
  v_new_status text;
  v_auto_confirm boolean := true;
BEGIN
  SELECT * INTO v_req FROM public.brick_payment_requests WHERE id = p_brick_payment_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'brick_payment_request_not_found';
  END IF;
  IF v_req.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true);
  END IF;

  SELECT COALESCE(obs.auto_confirm_on_completed, true) INTO v_auto_confirm
  FROM public.organization_brick_settings obs
  WHERE obs.organization_id = v_req.organization_id;
  IF NOT FOUND THEN
    v_auto_confirm := true;
  END IF;

  SELECT * INTO v_sap FROM public.sales_activity_payments WHERE id = v_req.sales_activity_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales_activity_payment_not_found';
  END IF;

  SELECT * INTO v_sa FROM public.sales_activities WHERE id = v_sap.sales_activity_id;

  v_bank_id := public.resolve_brick_va_bank_account_id(v_req.organization_id, v_req.bank_short_code);
  v_amount := v_sap.payment_amount;

  UPDATE public.brick_payment_requests
  SET
    status = 'completed',
    brick_payment_id = COALESCE(p_brick_payment_id, brick_payment_id),
    paid_at = COALESCE(paid_at, now()),
    completed_at = now(),
    updated_at = now()
  WHERE id = v_req.id;

  IF v_auto_confirm THEN
    UPDATE public.sales_activity_payments
    SET
      transfer_verification_status = 'approved',
      transfer_verified_at = now(),
      payment_method = 'bank_transfer',
      notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END || 'Paid via Brick VA'
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
        'bank_transfer',
        'Brick VA - Piutang payment',
        v_bank_id,
        v_sap.id,
        'pending',
        v_sap.created_by
      )
      RETURNING id INTO v_income_id;
    ELSE
      UPDATE public.income_transactions
      SET
        bank_account_id = COALESCE(bank_account_id, v_bank_id),
        payment_method = 'bank_transfer'
      WHERE id = v_income_id;
    END IF;

    SELECT * INTO v_income FROM public.income_transactions WHERE id = v_income_id FOR UPDATE;

    IF v_income.deposit_confirmed_at IS NULL THEN
      v_new_status := public.income_status_after_deposit(
        v_income.income_type_id,
        v_income.category_id,
        COALESCE(v_income.bank_account_id, v_bank_id)
      );

      UPDATE public.income_transactions
      SET
        deposit_confirmed_at = now(),
        deposit_confirmed_by = v_sap.created_by,
        deposit_source = 'brick_va',
        status = v_new_status,
        bank_account_id = COALESCE(bank_account_id, v_bank_id),
        updated_at = now()
      WHERE id = v_income_id;

      PERFORM public.credit_income_bank_deposit(
        v_income_id,
        COALESCE(v_income.bank_account_id, v_bank_id),
        v_req.organization_id,
        v_amount,
        v_sap.created_by,
        'Brick VA settlement'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'income_id', v_income_id,
    'bank_account_id', v_bank_id,
    'auto_confirmed', v_auto_confirm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_brick_va_settlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_brick_va_settlement(uuid, text) TO service_role;

-- Mark paid (without full settlement) for callback paid status
CREATE OR REPLACE FUNCTION public.mark_brick_payment_request_paid(
  p_brick_payment_request_id uuid,
  p_brick_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.brick_payment_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.brick_payment_requests WHERE id = p_brick_payment_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'brick_payment_request_not_found';
  END IF;
  IF v_req.status IN ('paid', 'completed') THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  UPDATE public.brick_payment_requests
  SET
    status = 'paid',
    brick_payment_id = COALESCE(p_brick_payment_id, brick_payment_id),
    paid_at = now(),
    updated_at = now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true, 'status', 'paid');
END;
$$;

REVOKE ALL ON FUNCTION public.mark_brick_payment_request_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_brick_payment_request_paid(uuid, text) TO service_role;
