-- Payment Methods report: channel config + sales_activities.payment_channel_id + aggregation RPC

CREATE TABLE IF NOT EXISTS public.pos_payment_method_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  pos_outlet_id uuid REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  legacy_payment_method text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_payment_method_channels_category_check CHECK (
    category IN ('cash', 'e_wallet', 'edc', 'e_commerce', 'integration', 'other')
  ),
  CONSTRAINT pos_payment_method_channels_slug_org_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pos_payment_channels_org
  ON public.pos_payment_method_channels (organization_id, category, sort_order);

CREATE INDEX IF NOT EXISTS idx_pos_payment_channels_outlet
  ON public.pos_payment_method_channels (organization_id, pos_outlet_id, category);

ALTER TABLE public.pos_payment_method_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_payment_channels_org_select" ON public.pos_payment_method_channels;
CREATE POLICY "pos_payment_channels_org_select"
  ON public.pos_payment_method_channels FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_payment_channels_org_insert" ON public.pos_payment_method_channels;
CREATE POLICY "pos_payment_channels_org_insert"
  ON public.pos_payment_method_channels FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_payment_channels_org_update" ON public.pos_payment_method_channels;
CREATE POLICY "pos_payment_channels_org_update"
  ON public.pos_payment_method_channels FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_payment_channels_org_delete" ON public.pos_payment_method_channels;
CREATE POLICY "pos_payment_channels_org_delete"
  ON public.pos_payment_method_channels FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_payment_method_channels IS
  'Configurable payment channels grouped by category for POS checkout and Payment Methods report.';

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS payment_channel_id uuid REFERENCES public.pos_payment_method_channels (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_activities_payment_channel
  ON public.sales_activities (organization_id, payment_channel_id)
  WHERE payment_channel_id IS NOT NULL;

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

REVOKE ALL ON FUNCTION public.pos_seed_default_payment_channels(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_seed_default_payment_channels(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_seed_default_payment_channels(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pos_payment_methods_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  category text,
  channel_id uuid,
  channel_name text,
  channel_slug text,
  transaction_count bigint,
  total_collected numeric,
  summary_total_collected numeric,
  summary_transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary_total numeric := 0;
  v_summary_count bigint := 0;
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

  PERFORM public.pos_seed_default_payment_channels(p_organization_id);

  SELECT
    COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0),
    COUNT(*)::bigint
  INTO v_summary_total, v_summary_count
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND (p_from IS NULL OR sa.created_at >= p_from)
    AND (p_to IS NULL OR sa.created_at < p_to);

  RETURN QUERY
  WITH sales AS (
    SELECT
      sa.id,
      sa.payment_method,
      sa.payment_reference,
      sa.payment_channel_id,
      COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
  ),
  resolved AS (
    SELECT
      s.id,
      s.collected,
      COALESCE(
        ch.category,
        CASE lower(COALESCE(s.payment_method, ''))
          WHEN 'cash' THEN 'cash'
          WHEN 'e_wallet' THEN 'e_wallet'
          WHEN 'bank_transfer' THEN 'edc'
          WHEN 'transfer' THEN 'edc'
          WHEN 'credit_card' THEN 'edc'
          ELSE 'other'
        END
      ) AS category,
      ch.id AS channel_id,
      COALESCE(
        ch.name,
        NULLIF(TRIM(s.payment_reference), ''),
        CASE lower(COALESCE(s.payment_method, ''))
          WHEN 'cash' THEN 'Cash'
          WHEN 'e_wallet' THEN 'E-Wallet'
          WHEN 'bank_transfer' THEN 'Bank Transfer'
          WHEN 'transfer' THEN 'Bank Transfer'
          ELSE COALESCE(s.payment_method, 'Other')
        END
      ) AS channel_name,
      COALESCE(ch.slug, NULLIF(TRIM(s.payment_reference), ''), lower(COALESCE(s.payment_method, 'other'))) AS channel_slug
    FROM sales s
    LEFT JOIN public.pos_payment_method_channels ch ON ch.id = s.payment_channel_id
  ),
  grouped AS (
    SELECT
      r.category,
      r.channel_id,
      r.channel_name,
      r.channel_slug,
      COUNT(*)::bigint AS transaction_count,
      COALESCE(SUM(r.collected), 0)::numeric AS total_collected
    FROM resolved r
    GROUP BY r.category, r.channel_id, r.channel_name, r.channel_slug
  )
  SELECT
    g.category,
    g.channel_id,
    g.channel_name,
    g.channel_slug,
    g.transaction_count,
    g.total_collected,
    v_summary_total AS summary_total_collected,
    v_summary_count AS summary_transaction_count
  FROM grouped g
  ORDER BY
    CASE g.category
      WHEN 'cash' THEN 1
      WHEN 'e_wallet' THEN 2
      WHEN 'edc' THEN 3
      WHEN 'e_commerce' THEN 4
      WHEN 'integration' THEN 5
      ELSE 6
    END,
    g.channel_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_payment_methods_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_payment_methods_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_payment_methods_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_payment_methods_report(uuid, uuid, timestamptz, timestamptz) IS
  'Payment Methods report: txn count and total collected by category/channel for Store Checkout sales.';

-- Backfill payment_channel_id for existing checkouts using legacy payment_method + reference slug match
DO $$
DECLARE
  v_org uuid;
BEGIN
  FOR v_org IN SELECT DISTINCT organization_id FROM public.sales_activities WHERE activity_type = 'Store Checkout'
  LOOP
    PERFORM public.pos_seed_default_payment_channels(v_org);

    UPDATE public.sales_activities sa
    SET payment_channel_id = ch.id
    FROM public.pos_payment_method_channels ch
    WHERE sa.organization_id = v_org
      AND sa.activity_type = 'Store Checkout'
      AND sa.payment_channel_id IS NULL
      AND ch.organization_id = v_org
      AND ch.pos_outlet_id IS NULL
      AND (
        (lower(COALESCE(sa.payment_method, '')) = 'cash' AND ch.slug = 'cash')
        OR (
          lower(COALESCE(sa.payment_method, '')) IN ('bank_transfer', 'transfer')
          AND ch.slug = COALESCE(NULLIF(lower(TRIM(sa.payment_reference)), ''), 'bank-transfer')
        )
        OR (
          lower(COALESCE(sa.payment_method, '')) = 'e_wallet'
          AND ch.slug = COALESCE(NULLIF(lower(TRIM(sa.payment_reference)), ''), 'gopay')
        )
      );
  END LOOP;
END $$;
