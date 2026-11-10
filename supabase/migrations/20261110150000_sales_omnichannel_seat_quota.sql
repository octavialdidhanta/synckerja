-- Sales-tenant omnichannel roster quota.
-- Admin writes organization_subscriptions.omnichannel_paid_seat_count.
-- Office roster cap stays LEAST(member_count, omnichannel_paid_seat_count).

CREATE OR REPLACE FUNCTION public.count_roster_eligible_employees(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT count(*)::integer
    FROM public.employees e
    LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
    WHERE e.organization_id = p_org_id
      AND e.user_id IS NOT NULL
      AND COALESCE(e.pending_removal, false) = false
      AND NOT (
        lower(trim(COALESCE(e.status, ''))) IN (
          'inactive', 'terminated', 'resigned', 'resign', 'resignation',
          'pending removal', 'pendingremoval'
        )
        OR lower(trim(COALESCE(es.name, ''))) IN (
          'inactive', 'terminated', 'resigned', 'resign', 'resignation',
          'pending removal', 'pendingremoval'
        )
        OR lower(trim(COALESCE(e.status, ''))) LIKE '%resign%'
        OR lower(trim(COALESCE(e.status, ''))) LIKE '%terminat%'
        OR lower(trim(COALESCE(es.name, ''))) LIKE '%resign%'
        OR lower(trim(COALESCE(es.name, ''))) LIKE '%terminat%'
      )
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.count_roster_eligible_employees(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_organization_sales_modules(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_sales boolean;
  v_modules jsonb := '{}'::jsonb;
  v_key text;
  v_enabled boolean;
  v_paid integer := 0;
  v_hr integer := 0;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(o.subscription_self_service_enabled, true)
  INTO v_is_sales
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_sales := NOT v_is_sales;

  IF NOT v_is_sales THEN
    RETURN jsonb_build_object(
      'organization_id', p_organization_id,
      'is_sales_tenant', false,
      'modules', '{}'::jsonb,
      'omnichannel_paid_seat_count', 0,
      'hr_seat_count', 0,
      'roster_eligible_employee_count', 0
    );
  END IF;

  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    SELECT m.is_enabled
    INTO v_enabled
    FROM public.organization_sales_module_access m
    WHERE m.organization_id = p_organization_id
      AND m.module_key = v_key;

    v_modules := v_modules || jsonb_build_object(v_key, coalesce(v_enabled, false));
  END LOOP;

  SELECT
    COALESCE(os.omnichannel_paid_seat_count, 0),
    COALESCE(os.member_count, 0)
  INTO v_paid, v_hr
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'is_sales_tenant', true,
    'modules', v_modules,
    'omnichannel_paid_seat_count', COALESCE(v_paid, 0),
    'hr_seat_count', COALESCE(v_hr, 0),
    'roster_eligible_employee_count', public.count_roster_eligible_employees(p_organization_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_organization_omnichannel_seats(
  p_organization_id uuid,
  p_seats integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_before integer;
  v_hr integer;
  v_eligible integer;
  v_max integer;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason required (min 3 characters)' USING ERRCODE = '22023';
  END IF;

  IF p_seats IS NULL OR p_seats < 0 THEN
    RAISE EXCEPTION 'seats must be >= 0' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(v_org.subscription_self_service_enabled, true) THEN
    RAISE EXCEPTION 'organization is not a sales tenant' USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(os.omnichannel_paid_seat_count, 0),
    COALESCE(os.member_count, 0)
  INTO v_before, v_hr
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization subscription not found' USING ERRCODE = 'P0002';
  END IF;

  v_eligible := public.count_roster_eligible_employees(p_organization_id);
  v_max := LEAST(v_hr, v_eligible);

  IF p_seats > v_max THEN
    RAISE EXCEPTION 'kuota maksimal %', v_max USING ERRCODE = '22023';
  END IF;

  UPDATE public.organization_subscriptions
  SET omnichannel_paid_seat_count = p_seats
  WHERE organization_id = p_organization_id;

  INSERT INTO public.cms_subscription_adjustments (
    organization_id,
    adjusted_by,
    reason,
    before_state,
    after_state
  ) VALUES (
    p_organization_id,
    auth.uid(),
    trim(p_reason),
    jsonb_build_object('omnichannel_paid_seat_count', v_before),
    jsonb_build_object('omnichannel_paid_seat_count', p_seats)
  );

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'omnichannel_paid_seat_count', p_seats,
    'hr_seat_count', v_hr,
    'roster_eligible_employee_count', v_eligible
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_organization_omnichannel_seats(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_omnichannel_seats(uuid, integer, text) TO authenticated;

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

  IF EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_org_id
      AND coalesce(o.subscription_self_service_enabled, true) = false
  ) THEN
    RAISE EXCEPTION 'sales tenants cannot purchase omnichannel seats';
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

NOTIFY pgrst, 'reload schema';
