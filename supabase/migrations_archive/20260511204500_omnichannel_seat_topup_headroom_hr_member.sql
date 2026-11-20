-- Top-up omnichannel seats: additional count cannot exceed HR headroom
-- (member_count - omnichannel_paid_seat_count), i.e. max roster cap uplift from paid seats.

CREATE OR REPLACE FUNCTION public.compute_omnichannel_seat_topup_amount_service(
  p_org_id uuid,
  p_additional_seats integer,
  p_billing_cycle text,
  p_verified_user_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats integer;
  v_cycle text;
  v_plan_id uuid;
  v_member_count integer;
  v_paid integer;
  v_headroom integer;
  v_unit numeric;
  v_follows_plan_discount boolean;
  v_annual_pct numeric;
  v_monthly_total numeric;
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

  v_seats := p_additional_seats;
  IF v_seats IS NULL OR v_seats < 1 THEN
    RAISE EXCEPTION 'additional seats must be >= 1';
  END IF;

  v_cycle := lower(trim(coalesce(p_billing_cycle, 'monthly')));
  IF v_cycle NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'billing_cycle must be monthly or yearly';
  END IF;

  SELECT
    os.subscription_plan_id,
    COALESCE(os.member_count, 0)::integer,
    COALESCE(os.omnichannel_paid_seat_count, 0)::integer
  INTO v_plan_id, v_member_count, v_paid
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_org_id
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'no organization subscription';
  END IF;

  v_headroom := GREATEST(0, v_member_count - v_paid);
  IF v_headroom < 1 THEN
    RAISE EXCEPTION 'no headroom for additional omnichannel seats under current HR member limit';
  END IF;
  IF v_seats > v_headroom THEN
    RAISE EXCEPTION 'additional seats cannot exceed HR member headroom (member_count minus paid omnichannel seats)';
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
    AND sa.code = 'omnichannel_roster'
    AND sa.is_active = true
    AND sp.is_active = true
  LIMIT 1;

  IF v_unit IS NULL THEN
    RAISE EXCEPTION 'omnichannel add-on not available for current plan';
  END IF;

  v_monthly_total := greatest(0::numeric, v_unit) * v_seats;

  IF v_cycle = 'monthly' THEN
    RETURN round(v_monthly_total);
  END IF;

  v_annual_pct := case
    when coalesce(v_follows_plan_discount, true) then coalesce(v_annual_pct, 20::numeric)
    else 20::numeric
  end;

  v_yearly := v_monthly_total * 12 * (1 - coalesce(v_annual_pct, 20) / 100::numeric);
  RETURN round(v_yearly);
END;
$$;
