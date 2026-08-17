-- POS catalog: product categories, pos_status, payment_reference on store checkout.

CREATE TABLE IF NOT EXISTS public.catalog_product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_categories_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_product_categories_name_check CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_product_categories_org_name
  ON public.catalog_product_categories (organization_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_product_categories_org
  ON public.catalog_product_categories (organization_id, sort_order, name);

ALTER TABLE public.catalog_product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_categories_org_select" ON public.catalog_product_categories;
CREATE POLICY "catalog_product_categories_org_select"
  ON public.catalog_product_categories FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_categories_org_insert" ON public.catalog_product_categories;
CREATE POLICY "catalog_product_categories_org_insert"
  ON public.catalog_product_categories FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_categories_org_update" ON public.catalog_product_categories;
CREATE POLICY "catalog_product_categories_org_update"
  ON public.catalog_product_categories FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_categories_org_delete" ON public.catalog_product_categories;
CREATE POLICY "catalog_product_categories_org_delete"
  ON public.catalog_product_categories FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_product_categories_updated_at ON public.catalog_product_categories;
CREATE TRIGGER update_catalog_product_categories_updated_at
  BEFORE UPDATE ON public.catalog_product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_product_categories IS
  'Retail/F&B POS groups. Separate from services.sub_services (lead conversion).';

ALTER TABLE public.default_prices
  ADD COLUMN IF NOT EXISTS product_category_id uuid NULL
    REFERENCES public.catalog_product_categories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pos_status text NOT NULL DEFAULT 'available';

UPDATE public.default_prices
SET pos_status = 'available'
WHERE pos_status IS NULL OR btrim(pos_status) = '';

ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_pos_status_check;

ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_pos_status_check CHECK (
    pos_status IN ('available', 'sold_out', 'hidden')
  );

ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_pos_status_kind_check;

ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_pos_status_kind_check CHECK (
    kind <> 'service' OR pos_status = 'available'
  );

ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_product_category_kind_check;

ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_product_category_kind_check CHECK (
    kind = 'product' OR product_category_id IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_default_prices_product_category
  ON public.default_prices (product_category_id)
  WHERE product_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_default_prices_org_pos_status
  ON public.default_prices (organization_id, pos_status)
  WHERE kind = 'product';

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS payment_reference text NULL;

COMMENT ON COLUMN public.default_prices.pos_status IS
  'available = on POS; sold_out = visible but disabled; hidden = omitted from POS.';
COMMENT ON COLUMN public.sales_activities.payment_reference IS
  'Optional bank transfer / e-wallet reference for store checkout.';

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
  IF v_method NOT IN ('cash', 'bank_transfer', 'e_wallet') THEN
    RAISE EXCEPTION 'store_checkout_invalid_payment_method';
  END IF;

  v_needs_bank := v_method IN ('bank_transfer', 'e_wallet');

  v_actor := COALESCE(p_actor, v_activity.created_by);
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'store_checkout_actor_required';
  END IF;

  IF v_needs_bank THEN
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

COMMENT ON FUNCTION public.record_store_checkout_income(uuid, text) IS
  'Store POS: cash completed off-bank; bank_transfer/e_wallet credit omnichannel once. Optional payment_reference is copied onto income description.';
