-- POS QRIS payments: pending checkout, extend xendit_payment_requests, settlement RPCs.

-- ---------------------------------------------------------------------------
-- pos_pending_checkouts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_pending_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  pos_outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  pos_shift_id uuid NULL REFERENCES public.pos_cashier_shifts (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,
  sales_activity_id uuid NULL REFERENCES public.sales_activities (id) ON DELETE SET NULL,
  xendit_payment_request_id uuid NULL,
  session_id uuid NULL REFERENCES public.pos_table_sessions (id) ON DELETE SET NULL,
  keep_session_open boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  cancelled_at timestamptz NULL,
  paid_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_pending_checkouts_status_check CHECK (
    status = ANY (
      ARRAY['pending', 'paid', 'cancelled', 'expired', 'finalizing', 'failed']::text[]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_pending_checkouts_org
  ON public.pos_pending_checkouts (organization_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_pending_checkouts_active_session
  ON public.pos_pending_checkouts (organization_id, session_id)
  WHERE status = 'pending' AND session_id IS NOT NULL;

ALTER TABLE public.pos_pending_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pos_pending_checkouts_org_select ON public.pos_pending_checkouts;
CREATE POLICY pos_pending_checkouts_org_select
  ON public.pos_pending_checkouts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Extend xendit_payment_requests for QRIS
-- ---------------------------------------------------------------------------
ALTER TABLE public.xendit_payment_requests
  ALTER COLUMN sales_activity_payment_id DROP NOT NULL;

ALTER TABLE public.xendit_payment_requests
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'va',
  ADD COLUMN IF NOT EXISTS pos_pending_checkout_id uuid NULL REFERENCES public.pos_pending_checkouts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_activity_id uuid NULL REFERENCES public.sales_activities (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS xendit_qr_id text NULL,
  ADD COLUMN IF NOT EXISTS qr_string text NULL;

ALTER TABLE public.xendit_payment_requests
  DROP CONSTRAINT IF EXISTS xendit_payment_requests_payment_type_check;

ALTER TABLE public.xendit_payment_requests
  ADD CONSTRAINT xendit_payment_requests_payment_type_check CHECK (
    payment_type = ANY (ARRAY['va', 'qris']::text[])
  );

ALTER TABLE public.xendit_payment_requests
  DROP CONSTRAINT IF EXISTS xendit_payment_requests_bank_code_required;

-- VA rows keep bank_code; QRIS uses placeholder
ALTER TABLE public.xendit_payment_requests
  ALTER COLUMN bank_code DROP NOT NULL;

DROP INDEX IF EXISTS idx_xendit_payment_requests_active_sap;
CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_payment_requests_active_sap
  ON public.xendit_payment_requests (sales_activity_payment_id)
  WHERE status = 'pending' AND sales_activity_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_payment_requests_active_pending
  ON public.xendit_payment_requests (pos_pending_checkout_id)
  WHERE status = 'pending' AND pos_pending_checkout_id IS NOT NULL;

ALTER TABLE public.pos_pending_checkouts
  DROP CONSTRAINT IF EXISTS pos_pending_checkouts_xendit_fk;

ALTER TABLE public.pos_pending_checkouts
  ADD CONSTRAINT pos_pending_checkouts_xendit_fk
  FOREIGN KEY (xendit_payment_request_id)
  REFERENCES public.xendit_payment_requests (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Payment channel category: qris
-- ---------------------------------------------------------------------------
ALTER TABLE public.pos_payment_method_channels
  DROP CONSTRAINT IF EXISTS pos_payment_method_channels_category_check;

ALTER TABLE public.pos_payment_method_channels
  ADD CONSTRAINT pos_payment_method_channels_category_check CHECK (
    category IN ('cash', 'e_wallet', 'edc', 'e_commerce', 'integration', 'other', 'qris')
  );

CREATE OR REPLACE FUNCTION public.pos_seed_default_payment_channels(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.pos_payment_method_channels (
    organization_id, pos_outlet_id, category, name, slug, legacy_payment_method, sort_order
  )
  SELECT p_organization_id, NULL, v.category, v.name, v.slug, v.legacy_payment_method, v.sort_order
  FROM (
    VALUES
      ('cash', 'Cash', 'cash', 'cash', 10),
      ('qris', 'QRIS', 'qris', 'qris', 15),
      ('e_wallet', 'GOPAY', 'gopay', 'e_wallet', 20),
      ('e_wallet', 'OVO', 'ovo', 'e_wallet', 21),
      ('e_wallet', 'DANA', 'dana', 'e_wallet', 22),
      ('e_wallet', 'ShopeePay', 'shopeepay', 'e_wallet', 23),
      ('edc', 'BCA', 'bca', 'bank_transfer', 30),
      ('edc', 'Mandiri', 'mandiri', 'bank_transfer', 31),
      ('edc', 'Bank Transfer', 'bank-transfer', 'bank_transfer', 32),
      ('e_commerce', 'Tokopedia', 'tokopedia', NULL, 40),
      ('integration', 'Online Order', 'online-order', NULL, 50),
      ('integration', 'GoStore - GoPay', 'gostore-gopay', NULL, 51),
      ('other', 'Other', 'other', NULL, 90)
  ) AS v(category, name, slug, legacy_payment_method, sort_order)
  ON CONFLICT (organization_id, slug) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- apply_store_checkout_income: allow qris (xendit income bank, net handled by settlement)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_store_checkout_income(
  p_activity_id uuid,
  p_payment_method text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.sales_activities%ROWTYPE;
  v_payment_id uuid;
  v_income_id uuid;
  v_income_amount numeric;
  v_income_bank uuid;
  v_income_deposit_at timestamptz;
  v_income_status text;
  v_method text;
  v_needs_bank boolean;
  v_amount numeric;
  v_bank_id uuid;
  v_actor uuid;
  v_client_name text;
  v_tx_date date;
  v_description text;
  v_payment_notes text;
  v_ref text;
  v_credited boolean := false;
BEGIN
  IF p_activity_id IS NULL THEN
    RAISE EXCEPTION 'store_checkout_not_found';
  END IF;

  SELECT * INTO v_activity
  FROM public.sales_activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_checkout_not_found';
  END IF;

  IF v_activity.activity_type IS DISTINCT FROM 'Store Checkout' THEN
    RAISE EXCEPTION 'store_checkout_wrong_type';
  END IF;

  v_amount := COALESCE(v_activity.total_amount, 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'store_checkout_invalid_amount';
  END IF;

  v_method := lower(btrim(COALESCE(NULLIF(p_payment_method, ''), v_activity.payment_method, 'cash')));
  IF v_method = 'transfer' THEN
    v_method := 'bank_transfer';
  END IF;
  IF v_method NOT IN ('cash', 'bank_transfer', 'e_wallet', 'qris') THEN
    RAISE EXCEPTION 'store_checkout_invalid_payment_method';
  END IF;

  v_needs_bank := v_method IN ('bank_transfer', 'e_wallet', 'qris');

  v_actor := COALESCE(p_actor, v_activity.created_by);
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'store_checkout_actor_required';
  END IF;

  IF v_needs_bank THEN
    IF v_method = 'qris' THEN
      SELECT ba.id INTO v_bank_id
      FROM public.bank_accounts ba
      WHERE ba.organization_id = v_activity.organization_id
        AND ba.use_for_xendit_income = true
        AND ba.is_active = true
      ORDER BY ba.created_at ASC
      LIMIT 1;

      IF v_bank_id IS NULL THEN
        SELECT ba.id INTO v_bank_id
        FROM public.bank_accounts ba
        WHERE ba.organization_id = v_activity.organization_id
          AND ba.is_active = true
        ORDER BY ba.created_at ASC
        LIMIT 1;
      END IF;
    ELSE
      SELECT ba.id INTO v_bank_id
      FROM public.bank_accounts ba
      WHERE ba.organization_id = v_activity.organization_id
        AND ba.use_for_omnichannel_income = true
        AND ba.is_active = true
      ORDER BY ba.created_at ASC
      LIMIT 1;

      IF v_bank_id IS NULL THEN
        RAISE EXCEPTION 'store_checkout_omnichannel_bank_missing';
      END IF;
    END IF;
  END IF;

  v_ref := NULLIF(btrim(COALESCE(v_activity.payment_reference, '')), '');
  v_payment_notes := 'Store checkout';
  IF v_ref IS NOT NULL THEN
    v_payment_notes := v_payment_notes || ' · ' || v_ref;
  END IF;

  SELECT id INTO v_payment_id
  FROM public.sales_activity_payments
  WHERE sales_activity_id = v_activity.id
  ORDER BY created_at ASC, payment_sequence ASC
  LIMIT 1
  FOR UPDATE;

  IF v_payment_id IS NULL THEN
    INSERT INTO public.sales_activity_payments (
      sales_activity_id,
      organization_id,
      payment_amount,
      payment_date,
      payment_method,
      payment_type,
      payment_sequence,
      notes,
      receipt_url,
      created_by,
      transfer_verification_status,
      transfer_verified_at,
      transfer_verified_by
    )
    VALUES (
      v_activity.id,
      v_activity.organization_id,
      v_amount,
      COALESCE(v_activity.date, CURRENT_DATE),
      v_method,
      'final_payment',
      1,
      v_payment_notes,
      NULL,
      v_actor,
      'approved',
      now(),
      v_actor
    )
    RETURNING id INTO v_payment_id;
  END IF;

  -- QRIS income amount/net is recorded by apply_xendit_qris_settlement
  IF v_method = 'qris' THEN
    UPDATE public.sales_activities
    SET
      payment_method = v_method,
      total_paid_amount = v_amount,
      remaining_amount = 0,
      updated_at = now()
    WHERE id = v_activity.id;

    RETURN jsonb_build_object(
      'ok', true,
      'already_recorded', false,
      'payment_id', v_payment_id,
      'income_deferred', true,
      'status', 'completed'
    );
  END IF;

  SELECT
    it.id,
    it.amount,
    it.bank_account_id,
    it.deposit_confirmed_at,
    it.status
  INTO
    v_income_id,
    v_income_amount,
    v_income_bank,
    v_income_deposit_at,
    v_income_status
  FROM public.income_transactions it
  WHERE it.organization_id = v_activity.organization_id
    AND it.sales_activity_payment_id = v_payment_id
  LIMIT 1
  FOR UPDATE;

  IF v_income_id IS NOT NULL AND (
    NOT v_needs_bank
    OR v_income_deposit_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_recorded', true,
      'income_id', v_income_id,
      'payment_id', v_payment_id,
      'status', v_income_status
    );
  END IF;

  v_client_name := COALESCE(NULLIF(btrim(v_activity.client_name), ''), 'Walk-in');
  v_tx_date := COALESCE(v_activity.date, CURRENT_DATE);
  v_description := 'Store checkout - ' || v_client_name;
  IF v_ref IS NOT NULL THEN
    v_description := v_description || ' · ' || v_ref;
  END IF;

  IF v_income_id IS NULL THEN
    INSERT INTO public.income_transactions (
      organization_id,
      user_id,
      transaction_date,
      amount,
      customer_name,
      payment_method,
      description,
      bank_account_id,
      income_type_id,
      category_id,
      service_id,
      sub_service_id,
      sales_activity_payment_id,
      status,
      created_by
    )
    VALUES (
      v_activity.organization_id,
      v_actor,
      v_tx_date,
      v_amount,
      v_client_name,
      v_method,
      v_description,
      CASE WHEN v_needs_bank THEN v_bank_id ELSE NULL END,
      NULL,
      NULL,
      v_activity.service_id,
      v_activity.sub_service_id,
      v_payment_id,
      CASE WHEN v_needs_bank THEN 'pending' ELSE 'completed' END,
      v_actor
    )
    RETURNING id, amount, bank_account_id INTO v_income_id, v_income_amount, v_income_bank;
  END IF;

  IF v_needs_bank AND v_income_deposit_at IS NULL THEN
    UPDATE public.income_transactions
    SET
      bank_account_id = COALESCE(bank_account_id, v_bank_id),
      deposit_confirmed_at = now(),
      deposit_confirmed_by = v_actor,
      deposit_source = 'store_checkout',
      status = 'completed',
      updated_at = now()
    WHERE id = v_income_id;

    PERFORM public.credit_income_bank_deposit(
      v_income_id,
      COALESCE(v_income_bank, v_bank_id),
      v_activity.organization_id,
      COALESCE(v_income_amount, v_amount),
      v_actor,
      'Store checkout deposit'
    );
    v_credited := true;
  END IF;

  UPDATE public.sales_activities
  SET
    payment_method = v_method,
    total_paid_amount = v_amount,
    remaining_amount = 0,
    updated_at = now()
  WHERE id = v_activity.id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_recorded', false,
    'income_id', v_income_id,
    'payment_id', v_payment_id,
    'status', 'completed',
    'credited', v_credited
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- pos_create_pending_checkout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_create_pending_checkout(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_amount numeric;
  v_session_id uuid;
  v_shift_id uuid;
  v_lead_id uuid;
  v_actor uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'pos_outlet_required';
  END IF;

  v_amount := COALESCE((p_payload -> 'checkoutTotals' ->> 'grandTotal')::numeric, 0);
  IF v_amount < 1500 THEN
    RAISE EXCEPTION 'pos_qris_amount_too_low';
  END IF;
  IF v_amount > 10000000 THEN
    RAISE EXCEPTION 'pos_qris_amount_too_high';
  END IF;

  v_session_id := NULLIF(p_payload ->> 'sessionId', '')::uuid;
  IF v_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pos_pending_checkouts
    WHERE organization_id = p_organization_id
      AND session_id = v_session_id
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'pos_qris_pending_exists';
  END IF;

  v_shift_id := NULLIF(p_payload ->> 'posShiftId', '')::uuid;
  v_lead_id := NULLIF(p_payload ->> 'leadId', '')::uuid;
  v_actor := auth.uid();

  INSERT INTO public.pos_pending_checkouts (
    organization_id,
    pos_outlet_id,
    pos_shift_id,
    status,
    payload,
    lead_id,
    session_id,
    keep_session_open,
    expires_at,
    created_by
  )
  VALUES (
    p_organization_id,
    p_outlet_id,
    v_shift_id,
    'pending',
    p_payload,
    v_lead_id,
    v_session_id,
    COALESCE((p_payload ->> 'keepSessionOpen')::boolean, false),
    now() + interval '15 minutes',
    v_actor
  )
  RETURNING * INTO v_pending;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_checkout_id', v_pending.id,
    'expires_at', v_pending.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_create_pending_checkout(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_create_pending_checkout(uuid, uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- pos_cancel_pending_checkout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_cancel_pending_checkout(
  p_pending_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_is_service boolean := false;
BEGIN
  v_is_service := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') = 'service_role';

  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE id = p_pending_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pos_pending_checkout_not_found';
  END IF;

  IF NOT v_is_service THEN
    IF auth.uid() IS NULL
       OR v_pending.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
      RAISE EXCEPTION 'forbidden_org';
    END IF;
  END IF;

  IF v_pending.status IN ('paid', 'finalizing') THEN
    RETURN jsonb_build_object('ok', true, 'already_final', true);
  END IF;

  IF v_pending.status IN ('cancelled', 'expired', 'failed') THEN
    RETURN jsonb_build_object('ok', true, 'already_cancelled', true);
  END IF;

  UPDATE public.pos_pending_checkouts
  SET
    status = CASE
      WHEN p_reason = 'expired' THEN 'expired'
      WHEN p_reason = 'failed' THEN 'failed'
      ELSE 'cancelled'
    END,
    cancelled_at = now(),
    error_message = NULLIF(btrim(COALESCE(p_reason, '')), ''),
    updated_at = now()
  WHERE id = p_pending_id;

  IF v_pending.xendit_payment_request_id IS NOT NULL THEN
    UPDATE public.xendit_payment_requests
    SET
      status = CASE
        WHEN p_reason = 'failed' THEN 'failed'
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE id = v_pending.xendit_payment_request_id
      AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.pos_cancel_pending_checkout(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_cancel_pending_checkout(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_cancel_pending_checkout(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- pos_expire_stale_pending_checkouts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_expire_stale_pending_checkouts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT id FROM public.pos_pending_checkouts
    WHERE status = 'pending' AND expires_at <= now()
  LOOP
    PERFORM public.pos_cancel_pending_checkout(v_row.id, 'expired');
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'expired', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.pos_expire_stale_pending_checkouts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_expire_stale_pending_checkouts() TO service_role;

-- ---------------------------------------------------------------------------
-- pos_finalize_qris_checkout (service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_finalize_qris_checkout(
  p_pending_id uuid,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_activity jsonb;
  v_items jsonb;
  v_modifiers jsonb;
  v_discounts jsonb;
  v_stock_lines jsonb;
  v_activity_id uuid;
  v_payment_id uuid;
  v_actor uuid;
  v_outlet uuid;
  v_line jsonb;
  v_line_idx integer := 0;
  v_line_key text;
  v_scope text;
  v_item_id uuid;
  v_item_ids uuid[] := ARRAY[]::uuid[];
  v_mod jsonb;
  v_disc jsonb;
  v_idx integer;
BEGIN
  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE id = p_pending_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pos_pending_checkout_not_found';
  END IF;

  IF v_pending.status = 'paid' AND v_pending.sales_activity_id IS NOT NULL THEN
    SELECT id INTO v_payment_id
    FROM public.sales_activity_payments
    WHERE sales_activity_id = v_pending.sales_activity_id
    ORDER BY created_at ASC
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'already_finalized', true,
      'sales_activity_id', v_pending.sales_activity_id,
      'payment_id', v_payment_id
    );
  END IF;

  IF v_pending.status NOT IN ('pending', 'finalizing') THEN
    RAISE EXCEPTION 'pos_pending_checkout_invalid_status';
  END IF;

  UPDATE public.pos_pending_checkouts
  SET status = 'finalizing', updated_at = now()
  WHERE id = p_pending_id;

  v_activity := v_pending.payload -> 'activity';
  v_items := COALESCE(v_pending.payload -> 'items', '[]'::jsonb);
  v_modifiers := COALESCE(v_pending.payload -> 'modifiers', '[]'::jsonb);
  v_discounts := COALESCE(v_pending.payload -> 'discounts', '[]'::jsonb);
  v_stock_lines := COALESCE(v_pending.payload -> 'catalogStockLines', '[]'::jsonb);
  v_actor := COALESCE(p_actor, v_pending.created_by, NULLIF(v_activity ->> 'created_by', '')::uuid);
  v_outlet := v_pending.pos_outlet_id;

  IF v_activity IS NULL THEN
    RAISE EXCEPTION 'pos_pending_checkout_missing_activity';
  END IF;

  INSERT INTO public.sales_activities (
    organization_id,
    lead_id,
    client_name,
    client_phone,
    client_email,
    activity_type,
    status,
    date,
    created_by,
    service_id,
    sub_service_id,
    total_amount,
    total_paid_amount,
    remaining_amount,
    is_down_payment,
    payment_method,
    payment_reference,
    payment_channel_id,
    cash_tendered,
    customer_visit_id,
    table_number,
    pos_table_id,
    table_duration_minutes,
    pos_outlet_id,
    catalog_sales_type_id,
    pos_shift_id,
    served_by_user_id,
    checkout_subtotal,
    checkout_tax_amount,
    checkout_gratuity_amount,
    checkout_application_method,
    checkout_discount_amount,
    description
  )
  VALUES (
    v_pending.organization_id,
    COALESCE(v_pending.lead_id, NULLIF(v_activity ->> 'lead_id', '')::uuid),
    COALESCE(NULLIF(v_activity ->> 'client_name', ''), 'Walk-in'),
    NULLIF(v_activity ->> 'client_phone', ''),
    NULLIF(v_activity ->> 'client_email', ''),
    'Store Checkout',
    'Converted',
    COALESCE(NULLIF(v_activity ->> 'date', '')::date, CURRENT_DATE),
    v_actor,
    NULLIF(v_activity ->> 'service_id', '')::uuid,
    NULLIF(v_activity ->> 'sub_service_id', '')::uuid,
    COALESCE((v_activity ->> 'total_amount')::numeric, 0),
    COALESCE((v_activity ->> 'total_amount')::numeric, 0),
    0,
    false,
    'qris',
    NULLIF(v_activity ->> 'payment_reference', ''),
    NULLIF(v_activity ->> 'payment_channel_id', '')::uuid,
    NULL,
    NULLIF(v_activity ->> 'customer_visit_id', '')::uuid,
    NULLIF(v_activity ->> 'table_number', ''),
    NULLIF(v_activity ->> 'pos_table_id', '')::uuid,
    NULLIF(v_activity ->> 'table_duration_minutes', '')::integer,
    v_outlet,
    NULLIF(v_activity ->> 'catalog_sales_type_id', '')::uuid,
    v_pending.pos_shift_id,
    NULLIF(v_activity ->> 'served_by_user_id', '')::uuid,
    COALESCE((v_activity ->> 'checkout_subtotal')::numeric, 0),
    COALESCE((v_activity ->> 'checkout_tax_amount')::numeric, 0),
    COALESCE((v_activity ->> 'checkout_gratuity_amount')::numeric, 0),
    NULLIF(v_activity ->> 'checkout_application_method', ''),
    COALESCE((v_activity ->> 'checkout_discount_amount')::numeric, 0),
    COALESCE(NULLIF(v_activity ->> 'description', ''), 'Store checkout')
  )
  RETURNING id INTO v_activity_id;

  v_idx := 0;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.sales_activity_items (
      sales_activity_id,
      organization_id,
      service_id,
      sub_service_id,
      service_name,
      sub_service_name,
      quantity,
      unit_price,
      total_price,
      notes,
      item_kind,
      inventory_sku_id,
      track_stock,
      catalog_product_id,
      catalog_variant_id,
      catalog_bundle_id,
      catalog_sales_type_id,
      unit_cogs,
      cogs_source
    )
    VALUES (
      v_activity_id,
      v_pending.organization_id,
      NULLIF(v_line ->> 'service_id', '')::uuid,
      NULLIF(v_line ->> 'sub_service_id', '')::uuid,
      NULLIF(v_line ->> 'service_name', ''),
      NULLIF(v_line ->> 'sub_service_name', ''),
      COALESCE((v_line ->> 'quantity')::numeric, 1),
      COALESCE((v_line ->> 'unit_price')::numeric, 0),
      COALESCE((v_line ->> 'total_price')::numeric, 0),
      NULLIF(v_line ->> 'notes', ''),
      COALESCE(NULLIF(v_line ->> 'item_kind', ''), 'product'),
      NULLIF(v_line ->> 'inventory_sku_id', '')::uuid,
      COALESCE((v_line ->> 'track_stock')::boolean, false),
      NULLIF(v_line ->> 'catalog_product_id', '')::uuid,
      NULLIF(v_line ->> 'catalog_variant_id', '')::uuid,
      NULLIF(v_line ->> 'catalog_bundle_id', '')::uuid,
      NULLIF(v_line ->> 'catalog_sales_type_id', '')::uuid,
      NULLIF(v_line ->> 'unit_cogs', '')::numeric,
      COALESCE(NULLIF(v_line ->> 'cogs_source', ''), 'none')
    )
    RETURNING id INTO v_item_id;
    v_item_ids := array_append(v_item_ids, v_item_id);
  END LOOP;

  v_idx := 0;
  FOR v_mod IN SELECT value FROM jsonb_array_elements(v_modifiers)
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.sales_activity_item_modifiers (
      organization_id,
      sales_activity_id,
      sales_activity_item_id,
      modifier_group_id,
      modifier_option_id,
      group_name,
      option_name,
      extra_price,
      quantity,
      line_quantity,
      gross_sales,
      discount_amount
    )
    VALUES (
      v_pending.organization_id,
      v_activity_id,
      CASE
        WHEN (v_mod ->> 'item_index') IS NOT NULL
          THEN v_item_ids[GREATEST(1, ((v_mod ->> 'item_index')::integer + 1))]
        ELSE NULL
      END,
      NULLIF(v_mod ->> 'modifier_group_id', '')::uuid,
      NULLIF(v_mod ->> 'modifier_option_id', '')::uuid,
      COALESCE(NULLIF(v_mod ->> 'group_name', ''), 'Unknown'),
      COALESCE(NULLIF(v_mod ->> 'option_name', ''), 'Unknown'),
      COALESCE((v_mod ->> 'extra_price')::numeric, 0),
      COALESCE((v_mod ->> 'quantity')::numeric, 1),
      COALESCE((v_mod ->> 'line_quantity')::numeric, 1),
      COALESCE((v_mod ->> 'gross_sales')::numeric, 0),
      COALESCE((v_mod ->> 'discount_amount')::numeric, 0)
    );
  END LOOP;

  FOR v_disc IN SELECT value FROM jsonb_array_elements(v_discounts)
  LOOP
    INSERT INTO public.sales_activity_line_discounts (
      organization_id,
      sales_activity_id,
      sales_activity_item_id,
      catalog_discount_id,
      discount_name,
      amount_rp,
      line_quantity,
      input_configuration,
      amount_unit,
      amount_value,
      value_label
    )
    VALUES (
      v_pending.organization_id,
      v_activity_id,
      CASE
        WHEN (v_disc ->> 'item_index') IS NOT NULL
          THEN v_item_ids[GREATEST(1, ((v_disc ->> 'item_index')::integer + 1))]
        ELSE NULL
      END,
      NULLIF(v_disc ->> 'catalog_discount_id', '')::uuid,
      COALESCE(NULLIF(v_disc ->> 'discount_name', ''), 'Unknown'),
      COALESCE((v_disc ->> 'amount_rp')::numeric, 0),
      COALESCE((v_disc ->> 'line_quantity')::numeric, 0),
      NULLIF(v_disc ->> 'input_configuration', ''),
      NULLIF(v_disc ->> 'amount_unit', ''),
      NULLIF(v_disc ->> 'amount_value', '')::numeric,
      COALESCE(NULLIF(v_disc ->> 'value_label', ''), '—')
    );
  END LOOP;

  v_line_idx := 0;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_stock_lines)
  LOOP
    v_line_idx := v_line_idx + 1;
    v_line_key := COALESCE(NULLIF(btrim(v_line ->> 'line_key'), ''), 'L' || v_line_idx::text);
    v_scope := COALESCE(NULLIF(btrim(v_line ->> 'stock_scope'), ''), 'full');
    IF v_scope NOT IN ('full', 'recipe_only', 'finished_goods_only') THEN
      v_scope := 'full';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.catalog_stock_movements
      WHERE organization_id = v_pending.organization_id
        AND reference_type = 'store_checkout'
        AND reference_id LIKE v_activity_id::text || ':' || v_line_key || ':%'
    ) THEN
      PERFORM public._apply_catalog_stock_lines(
        v_pending.organization_id,
        v_outlet,
        'store_checkout',
        v_activity_id::text,
        jsonb_build_array(v_line || jsonb_build_object('line_key', v_line_key)),
        v_scope
      );
    END IF;
  END LOOP;

  PERFORM public.apply_store_checkout_income(v_activity_id, 'qris', v_actor);

  SELECT id INTO v_payment_id
  FROM public.sales_activity_payments
  WHERE sales_activity_id = v_activity_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_pending.session_id IS NOT NULL THEN
    IF v_pending.keep_session_open THEN
      UPDATE public.pos_table_sessions
      SET cart_snapshot = COALESCE(v_pending.payload -> 'remainderCartLines', '[]'::jsonb)
      WHERE id = v_pending.session_id AND status = 'open';
    ELSE
      UPDATE public.pos_table_sessions
      SET
        status = 'paid',
        closed_at = now(),
        sales_activity_id = v_activity_id,
        closed_by = v_actor
      WHERE id = v_pending.session_id AND status = 'open';
    END IF;
  END IF;

  UPDATE public.pos_pending_checkouts
  SET
    status = 'paid',
    sales_activity_id = v_activity_id,
    paid_at = now(),
    updated_at = now()
  WHERE id = p_pending_id;

  UPDATE public.xendit_payment_requests
  SET sales_activity_id = v_activity_id
  WHERE pos_pending_checkout_id = p_pending_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sales_activity_id', v_activity_id,
    'payment_id', v_payment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_finalize_qris_checkout(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_finalize_qris_checkout(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- apply_xendit_qris_settlement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_xendit_qris_settlement(
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
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_sap public.sales_activity_payments%ROWTYPE;
  v_sa public.sales_activities%ROWTYPE;
  v_bank_id uuid;
  v_income_id uuid;
  v_income public.income_transactions%ROWTYPE;
  v_finalize jsonb;
  v_gross numeric;
  v_platform_fee integer;
  v_net numeric;
  v_new_status text;
  v_fee_note text;
  v_payment_id uuid;
  v_activity_id uuid;
BEGIN
  SELECT * INTO v_req
  FROM public.xendit_payment_requests
  WHERE id = p_payment_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'xendit_payment_request_not_found';
  END IF;

  IF v_req.payment_type IS DISTINCT FROM 'qris' THEN
    RAISE EXCEPTION 'xendit_payment_request_not_qris';
  END IF;

  IF v_req.status = 'paid' AND v_req.sales_activity_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'sales_activity_id', v_req.sales_activity_id);
  END IF;

  IF v_req.pos_pending_checkout_id IS NULL THEN
    RAISE EXCEPTION 'pos_pending_checkout_missing';
  END IF;

  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE id = v_req.pos_pending_checkout_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pos_pending_checkout_not_found';
  END IF;

  v_finalize := public.pos_finalize_qris_checkout(v_req.pos_pending_checkout_id, v_pending.created_by);
  v_activity_id := (v_finalize ->> 'sales_activity_id')::uuid;
  v_payment_id := (v_finalize ->> 'payment_id')::uuid;

  SELECT * INTO v_sap FROM public.sales_activity_payments WHERE id = v_payment_id FOR UPDATE;
  SELECT * INTO v_sa FROM public.sales_activities WHERE id = v_activity_id;

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

  v_gross := COALESCE(v_req.expected_amount, v_sa.total_amount, 0);
  v_platform_fee := GREATEST(COALESCE(v_req.platform_fee_amount, 0), 0);
  v_net := GREATEST(v_gross - v_platform_fee, 0);
  v_fee_note := CASE
    WHEN v_platform_fee > 0 THEN ' | Platform fee Rp ' || v_platform_fee::text
    ELSE ''
  END;

  UPDATE public.xendit_payment_requests
  SET
    status = 'paid',
    paid_at = now(),
    xendit_payment_id = COALESCE(p_xendit_payment_id, xendit_payment_id),
    sales_activity_id = v_activity_id,
    updated_at = now()
  WHERE id = v_req.id;

  UPDATE public.sales_activity_payments
  SET
    transfer_verification_status = 'approved',
    transfer_verified_at = now(),
    payment_method = 'qris',
    notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END
      || 'Paid via QRIS' || v_fee_note
  WHERE id = v_payment_id;

  SELECT id INTO v_income_id
  FROM public.income_transactions
  WHERE organization_id = v_req.organization_id
    AND sales_activity_payment_id = v_payment_id
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
      v_net,
      COALESCE(v_sa.client_name, 'Customer'),
      'qris',
      'POS QRIS payment' || v_fee_note,
      v_bank_id,
      v_payment_id,
      'pending',
      v_sap.created_by
    )
    RETURNING id INTO v_income_id;
  ELSE
    UPDATE public.income_transactions
    SET
      amount = v_net,
      bank_account_id = COALESCE(bank_account_id, v_bank_id),
      payment_method = 'qris',
      description = COALESCE(description, 'POS QRIS payment') || v_fee_note
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
      deposit_source = 'xendit_qris',
      status = v_new_status,
      bank_account_id = COALESCE(bank_account_id, v_bank_id),
      updated_at = now()
    WHERE id = v_income_id;

    PERFORM public.credit_income_bank_deposit(
      v_income_id,
      COALESCE(v_income.bank_account_id, v_bank_id),
      v_req.organization_id,
      v_net,
      v_sap.created_by,
      'POS QRIS settlement' || v_fee_note
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sales_activity_id', v_activity_id,
    'payment_id', v_payment_id,
    'income_id', v_income_id,
    'gross_amount', v_gross,
    'platform_fee_amount', v_platform_fee,
    'net_amount', v_net
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_xendit_qris_settlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_xendit_qris_settlement(uuid, text) TO service_role;

COMMENT ON TABLE public.pos_pending_checkouts IS
  'POS QRIS: checkout snapshot held until Xendit qr.payment webhook confirms payment.';
