-- Lead Magnet flat add-on entitlement for mandiri (self-service) tenants.
-- Grace 14 days for orgs with active/paused campaigns at migration time.

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS lead_magnet_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS lead_magnet_grace_until timestamptz NULL;

COMMENT ON COLUMN public.organization_subscriptions.lead_magnet_active IS
  'Purchased Lead Magnet add-on entitlement (flat per organization).';

COMMENT ON COLUMN public.organization_subscriptions.lead_magnet_grace_until IS
  'Temporary free access until this timestamp (launch grace for existing campaigns).';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS lead_magnet_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bundled_lead_magnet_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payments.lead_magnet_applied IS
  'When true, webhook has already activated lead_magnet for standalone add-on payment (idempotency).';

COMMENT ON COLUMN public.payments.bundled_lead_magnet_applied IS
  'When true, webhook has already activated lead_magnet from bundled HR checkout (idempotency).';

-- Grace backfill: orgs with active or paused campaigns get 14 days free access.
UPDATE public.organization_subscriptions os
SET lead_magnet_grace_until = now() + interval '14 days'
WHERE lead_magnet_grace_until IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.lead_magnet_campaigns c
    WHERE c.organization_id = os.organization_id
      AND c.status IN ('active', 'paused')
  );

-- ---------------------------------------------------------------------------
-- Amount for purchasing Lead Magnet add-on only (Midtrans gross). Flat per org.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_lead_magnet_addon_amount_service(
  p_org_id uuid,
  p_billing_cycle text,
  p_verified_user_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle text;
  v_plan_id uuid;
  v_unit numeric;
  v_follows_plan_discount boolean;
  v_annual_pct numeric;
  v_yearly numeric;
BEGIN
  IF p_verified_user_id IS NULL THEN
    RAISE EXCEPTION 'verified user required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = p_verified_user_id AND uo.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_cycle := lower(trim(coalesce(p_billing_cycle, 'monthly')));
  IF v_cycle NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'billing_cycle must be monthly or yearly';
  END IF;

  SELECT os.subscription_plan_id
  INTO v_plan_id
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_org_id
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'no organization subscription';
  END IF;

  SELECT
    coalesce(ppao.unit_price_override_per_month, sa.default_unit_price_per_month),
    sa.follows_plan_annual_discount,
    sp.annual_discount_percentage
  INTO v_unit, v_follows_plan_discount, v_annual_pct
  FROM public.subscription_plan_add_ons ppao
  INNER JOIN public.subscription_add_ons sa ON sa.id = ppao.add_on_id
  INNER JOIN public.subscription_plans sp ON sp.id = ppao.subscription_plan_id
  WHERE ppao.subscription_plan_id = v_plan_id
    AND sa.code = 'lead_magnet'
    AND sa.is_active = true
    AND sp.is_active = true
  LIMIT 1;

  IF v_unit IS NULL THEN
    RAISE EXCEPTION 'lead magnet add-on not available for current plan';
  END IF;

  IF v_cycle = 'monthly' THEN
    RETURN round(greatest(0::numeric, v_unit));
  END IF;

  v_annual_pct := case
    when coalesce(v_follows_plan_discount, true) then coalesce(v_annual_pct, 20::numeric)
    else 20::numeric
  end;

  v_yearly := greatest(0::numeric, v_unit) * 12 * (1 - coalesce(v_annual_pct, 20) / 100::numeric);
  RETURN round(v_yearly);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_lead_magnet_addon_amount_service(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_lead_magnet_addon_amount_service(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.compute_lead_magnet_addon_amount(
  p_org_id uuid,
  p_billing_cycle text
)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.compute_lead_magnet_addon_amount_service(
    p_org_id,
    p_billing_cycle,
    auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.compute_lead_magnet_addon_amount(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_lead_magnet_addon_amount(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_subscription_status: expose lead magnet entitlement + grace
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os record;
  v_employee_count integer;
  v_member_limit integer;
  v_plan_name text;
  v_base_price numeric;
  v_now timestamptz := now();
  v_end timestamptz;
  v_days int;
  v_is_trial boolean;
  v_is_expired boolean;
  v_is_active boolean;
  v_status text;
  v_over boolean;
  v_next_payment timestamptz;
  v_paid_omni integer;
  v_roster_cap integer;
  v_lm_active boolean;
  v_lm_grace timestamptz;
  v_lm_entitled boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid() AND uo.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT os.*, sp.name AS sp_name, sp.base_price_per_member AS sp_bpp
  INTO v_os
  FROM public.organization_subscriptions os
  LEFT JOIN public.subscription_plans sp ON sp.id = os.subscription_plan_id
  WHERE os.organization_id = p_org_id
  LIMIT 1;

  IF v_os.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_member_limit := COALESCE(v_os.member_count, 1);
  v_plan_name := COALESCE(v_os.sp_name, 'Plan');
  v_base_price := COALESCE(v_os.sp_bpp, 0);
  v_is_trial := COALESCE(v_os.is_trial, false);
  v_paid_omni := COALESCE(v_os.omnichannel_paid_seat_count, 0);
  v_roster_cap := LEAST(COALESCE(v_os.member_count, 0), v_paid_omni);
  v_lm_active := COALESCE(v_os.lead_magnet_active, false);
  v_lm_grace := v_os.lead_magnet_grace_until;
  v_lm_entitled := v_lm_active OR (v_lm_grace IS NOT NULL AND v_lm_grace > v_now);

  v_employee_count := public.count_active_employees_for_org(p_org_id);
  v_over := v_employee_count > v_member_limit;

  IF v_is_trial THEN
    v_end := v_os.trial_end_date;
  ELSE
    v_end := v_os.subscription_end_date;
  END IF;

  IF v_end IS NOT NULL AND v_end < v_now THEN
    v_is_expired := true;
    v_days := 0;
  ELSIF v_end IS NOT NULL THEN
    v_is_expired := false;
    v_days := GREATEST(0, FLOOR(EXTRACT(epoch FROM (v_end - v_now)) / 86400.0)::integer);
  ELSE
    v_is_expired := false;
    v_days := 9999;
  END IF;

  v_status := COALESCE(v_os.status, 'trial');
  IF v_is_expired THEN
    v_status := 'expired';
  END IF;

  v_is_active := NOT v_is_expired AND (
    (v_is_trial AND (v_os.trial_end_date IS NULL OR v_os.trial_end_date > v_now))
    OR (
      NOT v_is_trial
      AND v_os.status = 'active'
      AND (v_os.subscription_end_date IS NULL OR v_os.subscription_end_date > v_now)
    )
  );

  SELECT p.subscription_end_date INTO v_next_payment
  FROM public.payments p
  WHERE p.organization_id = p_org_id
    AND p.status IN ('success', 'settlement', 'paid')
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_next_payment IS NULL THEN
    v_next_payment := v_os.subscription_end_date;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'plan_name', v_plan_name,
    'is_trial', v_is_trial,
    'is_active', v_is_active,
    'is_expired', v_is_expired,
    'employee_count', v_employee_count,
    'member_limit', v_member_limit,
    'is_over_limit', v_over,
    'days_remaining', v_days,
    'end_date', v_end,
    'subscription_start_date', v_os.subscription_start_date,
    'subscription_end_date', v_os.subscription_end_date,
    'trial_end_date', v_os.trial_end_date,
    'billing_cycle', COALESCE(v_os.billing_cycle, 'monthly'),
    'base_price_per_member', v_base_price,
    'next_payment_date', v_next_payment,
    'omnichannel_paid_seat_count', v_paid_omni,
    'omnichannel_roster_seat_cap', v_roster_cap,
    'lead_magnet_active', v_lm_active,
    'lead_magnet_grace_until', v_lm_grace,
    'lead_magnet_entitled', v_lm_entitled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_subscription_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscription_status(uuid) TO authenticated;
