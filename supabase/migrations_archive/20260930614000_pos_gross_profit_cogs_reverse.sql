-- Full-refund COGS reverse ledger (schema ready for future partial line refunds).
-- GP report formula stays restatement (exclude refund_status=full). This persists
-- what COGS was removed for audit / email / future partial.

ALTER TABLE public.pos_sales_refunds
  ADD COLUMN IF NOT EXISTS cogs_reversed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cogs_incomplete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pos_sales_refunds.cogs_reversed IS
  'Sum of resolved unit_cogs × qty for product lines at full refund time.';
COMMENT ON COLUMN public.pos_sales_refunds.cogs_incomplete IS
  'True if any product line had no resolvable unit_cogs at refund time.';

CREATE TABLE IF NOT EXISTS public.pos_sales_refund_cogs_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  refund_id uuid NOT NULL REFERENCES public.pos_sales_refunds (id) ON DELETE CASCADE,
  sales_activity_item_id uuid REFERENCES public.sales_activity_items (id) ON DELETE SET NULL,
  catalog_product_id uuid,
  catalog_variant_id uuid,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cogs numeric,
  cogs_source text,
  line_cogs numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_sales_refund_cogs_lines_cogs_source_check CHECK (
    cogs_source IS NULL
    OR cogs_source = ANY (
      ARRAY[
        'finished_goods'::text,
        'recipe_bom'::text,
        'estimated'::text,
        'none'::text,
        'snapshot'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_sales_refund_cogs_lines_refund
  ON public.pos_sales_refund_cogs_lines (refund_id);

CREATE INDEX IF NOT EXISTS idx_pos_sales_refund_cogs_lines_org
  ON public.pos_sales_refund_cogs_lines (organization_id, created_at DESC);

ALTER TABLE public.pos_sales_refund_cogs_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_sales_refund_cogs_lines_org_select" ON public.pos_sales_refund_cogs_lines;
CREATE POLICY "pos_sales_refund_cogs_lines_org_select"
  ON public.pos_sales_refund_cogs_lines FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_sales_refund_cogs_lines_org_insert" ON public.pos_sales_refund_cogs_lines;
CREATE POLICY "pos_sales_refund_cogs_lines_org_insert"
  ON public.pos_sales_refund_cogs_lines FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_sales_refund_cogs_lines IS
  'Per-line COGS reversed on refund. Full refund today; future partial refunds attach qty here.';

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
  v_cogs_reversed numeric := 0;
  v_cogs_incomplete boolean := false;
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

  -- Resolve COGS for product lines (snapshot else estimate) before insert refund row
  SELECT
    COALESCE(SUM(COALESCE(x.resolved_unit_cogs, 0) * COALESCE(x.quantity, 0)), 0),
    COALESCE(BOOL_OR(x.resolved_unit_cogs IS NULL), false)
  INTO v_cogs_reversed, v_cogs_incomplete
  FROM (
    SELECT
      sai.quantity,
      CASE
        WHEN sai.unit_cogs IS NOT NULL THEN sai.unit_cogs
        WHEN sai.catalog_product_id IS NOT NULL AND v_activity.pos_outlet_id IS NOT NULL THEN
          public.pos_estimate_line_unit_cogs(
            v_activity.organization_id,
            v_activity.pos_outlet_id,
            sai.catalog_product_id,
            sai.catalog_variant_id
          )
        ELSE NULL
      END AS resolved_unit_cogs
    FROM public.sales_activity_items sai
    WHERE sai.sales_activity_id = p_activity_id
      AND sai.item_kind = 'product'
  ) x;

  INSERT INTO public.pos_sales_refunds (
    organization_id,
    sales_activity_id,
    amount,
    reason,
    pos_shift_id,
    refunded_by,
    reverse_id,
    cogs_reversed,
    cogs_incomplete
  )
  VALUES (
    v_activity.organization_id,
    p_activity_id,
    v_amount,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    p_shift_id,
    v_actor,
    v_reverse_id,
    v_cogs_reversed,
    v_cogs_incomplete
  )
  RETURNING id INTO v_refund_id;

  INSERT INTO public.pos_sales_refund_cogs_lines (
    organization_id,
    refund_id,
    sales_activity_item_id,
    catalog_product_id,
    catalog_variant_id,
    quantity,
    unit_cogs,
    cogs_source,
    line_cogs
  )
  SELECT
    v_activity.organization_id,
    v_refund_id,
    sai.id,
    sai.catalog_product_id,
    sai.catalog_variant_id,
    COALESCE(sai.quantity, 0),
    CASE
      WHEN sai.unit_cogs IS NOT NULL THEN sai.unit_cogs
      WHEN sai.catalog_product_id IS NOT NULL AND v_activity.pos_outlet_id IS NOT NULL THEN
        public.pos_estimate_line_unit_cogs(
          v_activity.organization_id,
          v_activity.pos_outlet_id,
          sai.catalog_product_id,
          sai.catalog_variant_id
        )
      ELSE NULL
    END,
    CASE
      WHEN sai.unit_cogs IS NOT NULL THEN COALESCE(sai.cogs_source, 'snapshot')
      WHEN sai.catalog_product_id IS NOT NULL AND v_activity.pos_outlet_id IS NOT NULL
           AND public.pos_estimate_line_unit_cogs(
             v_activity.organization_id,
             v_activity.pos_outlet_id,
             sai.catalog_product_id,
             sai.catalog_variant_id
           ) IS NOT NULL
        THEN 'estimated'
      ELSE 'none'
    END,
    COALESCE(
      (
        CASE
          WHEN sai.unit_cogs IS NOT NULL THEN sai.unit_cogs
          WHEN sai.catalog_product_id IS NOT NULL AND v_activity.pos_outlet_id IS NOT NULL THEN
            public.pos_estimate_line_unit_cogs(
              v_activity.organization_id,
              v_activity.pos_outlet_id,
              sai.catalog_product_id,
              sai.catalog_variant_id
            )
          ELSE NULL
        END
      ) * COALESCE(sai.quantity, 0),
      0
    )
  FROM public.sales_activity_items sai
  WHERE sai.sales_activity_id = p_activity_id
    AND sai.item_kind = 'product';

  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'activity_id', p_activity_id,
    'amount', v_amount,
    'reverse_id', v_reverse_id,
    'cogs_reversed', v_cogs_reversed,
    'cogs_incomplete', v_cogs_incomplete
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_refund_store_checkout(uuid, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_refund_store_checkout(uuid, text, uuid, uuid, text) TO authenticated;
