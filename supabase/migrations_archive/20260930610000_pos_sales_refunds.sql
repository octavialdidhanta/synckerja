-- Soft-refund ledger for Store Checkout + update sales summary report

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_by uuid,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_pos_shift_id uuid,
  ADD COLUMN IF NOT EXISTS refund_reverse_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_activities_refund_status_check'
  ) THEN
    ALTER TABLE public.sales_activities
      ADD CONSTRAINT sales_activities_refund_status_check
      CHECK (refund_status = ANY (ARRAY['none'::text, 'full'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pos_cashier_shifts'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_activities_refund_pos_shift_id_fkey'
  ) THEN
    ALTER TABLE public.sales_activities
      ADD CONSTRAINT sales_activities_refund_pos_shift_id_fkey
      FOREIGN KEY (refund_pos_shift_id)
      REFERENCES public.pos_cashier_shifts (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_activities_refunded_at
  ON public.sales_activities (organization_id, refunded_at)
  WHERE refund_status = 'full';

CREATE TABLE IF NOT EXISTS public.pos_sales_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  reason text,
  pos_shift_id uuid,
  refunded_by uuid,
  reverse_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pos_cashier_shifts'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pos_sales_refunds_pos_shift_id_fkey'
  ) THEN
    ALTER TABLE public.pos_sales_refunds
      ADD CONSTRAINT pos_sales_refunds_pos_shift_id_fkey
      FOREIGN KEY (pos_shift_id)
      REFERENCES public.pos_cashier_shifts (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pos_sales_refunds_org_created
  ON public.pos_sales_refunds (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_sales_refunds_activity
  ON public.pos_sales_refunds (sales_activity_id);

ALTER TABLE public.pos_sales_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_sales_refunds_org_select" ON public.pos_sales_refunds;
CREATE POLICY "pos_sales_refunds_org_select"
  ON public.pos_sales_refunds FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_sales_refunds_org_insert" ON public.pos_sales_refunds;
CREATE POLICY "pos_sales_refunds_org_insert"
  ON public.pos_sales_refunds FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- Soft-refund RPC: reverse income + mark activity refunded (stock reverse stays on client)
CREATE OR REPLACE FUNCTION public.pos_refund_store_checkout(
  p_activity_id uuid,
  p_reason text DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_reverse_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.sales_activities%ROWTYPE;
  v_actor uuid;
  v_amount numeric;
  v_reverse_id text;
  v_payment_id uuid;
  v_income public.income_transactions%ROWTYPE;
  v_balance_before numeric;
  v_balance_after numeric;
  v_refund_id uuid;
BEGIN
  v_actor := COALESCE(p_actor, auth.uid());
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_activity_id IS NULL THEN
    RAISE EXCEPTION 'pos_refund_activity_required';
  END IF;

  SELECT * INTO v_activity
  FROM public.sales_activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_checkout_not_found';
  END IF;

  IF v_activity.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  IF v_activity.activity_type IS DISTINCT FROM 'Store Checkout'
     OR v_activity.status IS DISTINCT FROM 'Converted' THEN
    RAISE EXCEPTION 'store_checkout_wrong_type';
  END IF;

  IF COALESCE(v_activity.refund_status, 'none') = 'full' THEN
    RAISE EXCEPTION 'already_refunded';
  END IF;

  v_amount := COALESCE(v_activity.total_paid_amount, v_activity.total_amount, 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'store_checkout_invalid_amount';
  END IF;

  v_reverse_id := COALESCE(NULLIF(btrim(p_reverse_id), ''), 'refund-' || p_activity_id::text);

  SELECT sap.id INTO v_payment_id
  FROM public.sales_activity_payments sap
  WHERE sap.sales_activity_id = p_activity_id
  ORDER BY sap.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    SELECT * INTO v_income
    FROM public.income_transactions it
    WHERE it.sales_activity_payment_id = v_payment_id
    ORDER BY it.created_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND COALESCE(v_income.status, '') IS DISTINCT FROM 'cancelled' THEN
      IF v_income.deposit_confirmed_at IS NOT NULL
         AND v_income.bank_account_id IS NOT NULL
         AND COALESCE(v_income.amount, 0) > 0 THEN
        INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
        VALUES (v_income.bank_account_id, v_income.organization_id, 0)
        ON CONFLICT (bank_account_id) DO NOTHING;

        SELECT balance INTO v_balance_before
        FROM public.bank_account_balances
        WHERE bank_account_id = v_income.bank_account_id
        FOR UPDATE;

        v_balance_after := COALESCE(v_balance_before, 0) - COALESCE(v_income.amount, 0);

        UPDATE public.bank_account_balances
        SET balance = v_balance_after, updated_at = now()
        WHERE bank_account_id = v_income.bank_account_id;

        INSERT INTO public.bank_account_balance_history (
          bank_account_id, organization_id, transaction_type, transaction_id,
          amount, balance_before, balance_after, description, created_by
        ) VALUES (
          v_income.bank_account_id,
          v_income.organization_id,
          'income',
          v_income.id,
          -COALESCE(v_income.amount, 0),
          COALESCE(v_balance_before, 0),
          v_balance_after,
          'Store checkout refund reversal',
          v_actor
        );
      END IF;

      UPDATE public.income_transactions
      SET
        status = 'cancelled',
        updated_at = now()
      WHERE id = v_income.id;
    END IF;
  END IF;

  UPDATE public.sales_activities
  SET
    refund_status = 'full',
    refund_amount = v_amount,
    refunded_at = now(),
    refunded_by = v_actor,
    refund_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
    refund_pos_shift_id = p_shift_id,
    refund_reverse_id = v_reverse_id,
    updated_at = now()
  WHERE id = p_activity_id;

  INSERT INTO public.pos_sales_refunds (
    organization_id,
    sales_activity_id,
    amount,
    reason,
    pos_shift_id,
    refunded_by,
    reverse_id
  )
  VALUES (
    v_activity.organization_id,
    p_activity_id,
    v_amount,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    p_shift_id,
    v_actor,
    v_reverse_id
  )
  RETURNING id INTO v_refund_id;

  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'activity_id', p_activity_id,
    'amount', v_amount,
    'reverse_id', v_reverse_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_refund_store_checkout(uuid, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_refund_store_checkout(uuid, text, uuid, uuid, text) TO authenticated;

-- Sales summary: sales metrics exclude refunded; refunds by refunded_at
CREATE OR REPLACE FUNCTION public.pos_sales_summary_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  gross_sales numeric,
  discounts numeric,
  refunds numeric,
  net_sales numeric,
  gratuity numeric,
  tax numeric,
  rounding numeric,
  total_collected numeric,
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric := 0;
  v_discounts numeric := 0;
  v_gratuity numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_count bigint := 0;
  v_refunds numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(sa.checkout_subtotal, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_discount_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_gratuity_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_tax_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0),
    COUNT(*)::bigint
  INTO v_net, v_discounts, v_gratuity, v_tax, v_total, v_count
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND (p_from IS NULL OR sa.created_at >= p_from)
    AND (p_to IS NULL OR sa.created_at < p_to);

  SELECT COALESCE(SUM(COALESCE(sa.refund_amount, 0)), 0)
  INTO v_refunds
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'full'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND sa.refunded_at IS NOT NULL
    AND (p_from IS NULL OR sa.refunded_at >= p_from)
    AND (p_to IS NULL OR sa.refunded_at < p_to);

  RETURN QUERY
  SELECT
    (v_net + v_discounts)::numeric AS gross_sales,
    v_discounts::numeric AS discounts,
    v_refunds::numeric AS refunds,
    v_net::numeric AS net_sales,
    v_gratuity::numeric AS gratuity,
    v_tax::numeric AS tax,
    0::numeric AS rounding,
    v_total::numeric AS total_collected,
    v_count;
END;
$$;
