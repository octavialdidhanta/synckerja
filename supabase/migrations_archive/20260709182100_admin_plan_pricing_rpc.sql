-- CMS admin: list and update subscription plan/add-on pricing.
-- Additive only: does not change RLS on catalog tables.

CREATE OR REPLACE FUNCTION public.admin_validate_price_amount(p_amount numeric)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF p_amount IS NULL THEN
    RETURN;
  END IF;
  IF p_amount < 0 OR p_amount > 10000000 THEN
    RAISE EXCEPTION 'price must be between 0 and 10000000' USING ERRCODE = '22023';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_subscription_plans()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  base_price_per_member numeric,
  annual_discount_percentage numeric,
  jumlah_hari_trial integer,
  is_active boolean,
  subscriber_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    sp.id,
    sp.name,
    sp.description,
    sp.base_price_per_member,
    sp.annual_discount_percentage,
    sp.jumlah_hari_trial,
    sp.is_active,
    count(os.id) AS subscriber_count,
    sp.created_at,
    sp.updated_at
  FROM public.subscription_plans sp
  LEFT JOIN public.organization_subscriptions os ON os.subscription_plan_id = sp.id
  GROUP BY sp.id
  ORDER BY sp.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_subscription_add_ons()
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  description text,
  billing_unit text,
  default_unit_price_per_month numeric,
  follows_plan_annual_discount boolean,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.code,
    a.name,
    a.description,
    a.billing_unit,
    a.default_unit_price_per_month,
    a.follows_plan_annual_discount,
    a.is_active,
    a.created_at,
    a.updated_at
  FROM public.subscription_add_ons a
  ORDER BY a.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_plan_add_on_overrides(
  p_plan_id uuid DEFAULT NULL
)
RETURNS TABLE (
  subscription_plan_id uuid,
  plan_name text,
  add_on_id uuid,
  add_on_code text,
  add_on_name text,
  unit_price_override_per_month numeric,
  default_unit_price_per_month numeric,
  resolved_unit_price_per_month numeric,
  display_order integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pao.subscription_plan_id,
    sp.name AS plan_name,
    pao.add_on_id,
    ao.code AS add_on_code,
    ao.name AS add_on_name,
    pao.unit_price_override_per_month,
    ao.default_unit_price_per_month,
    coalesce(pao.unit_price_override_per_month, ao.default_unit_price_per_month) AS resolved_unit_price_per_month,
    pao.display_order
  FROM public.subscription_plan_add_ons pao
  JOIN public.subscription_plans sp ON sp.id = pao.subscription_plan_id
  JOIN public.subscription_add_ons ao ON ao.id = pao.add_on_id
  WHERE p_plan_id IS NULL OR pao.subscription_plan_id = p_plan_id
  ORDER BY sp.name, pao.display_order, ao.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_plan_price_adjustments(
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
  p_add_on_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id uuid,
  plan_id uuid,
  add_on_id uuid,
  adjusted_by uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lim int;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  lim := greatest(1, least(coalesce(p_limit, 5), 50));

  RETURN QUERY
  SELECT
    a.id,
    a.entity_type,
    a.entity_id,
    a.plan_id,
    a.add_on_id,
    a.adjusted_by,
    a.reason,
    a.before_state,
    a.after_state,
    a.created_at
  FROM public.cms_plan_price_adjustments a
  WHERE (p_entity_type IS NULL OR a.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR a.entity_id = p_entity_id)
    AND (p_plan_id IS NULL OR a.plan_id = p_plan_id)
    AND (p_add_on_id IS NULL OR a.add_on_id = p_add_on_id)
  ORDER BY a.created_at DESC
  LIMIT lim;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_subscription_plan(
  p_plan_id uuid,
  p_base_price_per_member numeric,
  p_annual_discount_percentage numeric,
  p_jumlah_hari_trial integer,
  p_is_active boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
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

  PERFORM public.admin_validate_price_amount(p_base_price_per_member);

  IF p_annual_discount_percentage IS NOT NULL
     AND (p_annual_discount_percentage < 0 OR p_annual_discount_percentage > 100) THEN
    RAISE EXCEPTION 'annual_discount_percentage must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  IF p_jumlah_hari_trial IS NOT NULL AND p_jumlah_hari_trial < 0 THEN
    RAISE EXCEPTION 'jumlah_hari_trial must be >= 0' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found' USING ERRCODE = 'P0002';
  END IF;

  v_before := jsonb_build_object(
    'base_price_per_member', v_plan.base_price_per_member,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'is_active', v_plan.is_active
  );

  UPDATE public.subscription_plans
  SET
    base_price_per_member = p_base_price_per_member,
    annual_discount_percentage = p_annual_discount_percentage,
    jumlah_hari_trial = p_jumlah_hari_trial,
    is_active = coalesce(p_is_active, v_plan.is_active),
    updated_at = now()
  WHERE id = p_plan_id
  RETURNING * INTO v_plan;

  v_after := jsonb_build_object(
    'base_price_per_member', v_plan.base_price_per_member,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'is_active', v_plan.is_active
  );

  INSERT INTO public.cms_plan_price_adjustments (
    entity_type, entity_id, plan_id, adjusted_by, reason, before_state, after_state
  ) VALUES (
    'plan', p_plan_id, p_plan_id, auth.uid(), trim(p_reason), v_before, v_after
  );

  RETURN jsonb_build_object(
    'id', v_plan.id,
    'name', v_plan.name,
    'base_price_per_member', v_plan.base_price_per_member,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'is_active', v_plan.is_active,
    'after_state', v_after
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_subscription_add_on(
  p_add_on_id uuid,
  p_default_unit_price_per_month numeric,
  p_follows_plan_annual_discount boolean,
  p_is_active boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_add_on public.subscription_add_ons%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
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

  PERFORM public.admin_validate_price_amount(p_default_unit_price_per_month);

  SELECT * INTO v_add_on
  FROM public.subscription_add_ons
  WHERE id = p_add_on_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'add-on not found' USING ERRCODE = 'P0002';
  END IF;

  v_before := jsonb_build_object(
    'default_unit_price_per_month', v_add_on.default_unit_price_per_month,
    'follows_plan_annual_discount', v_add_on.follows_plan_annual_discount,
    'is_active', v_add_on.is_active
  );

  UPDATE public.subscription_add_ons
  SET
    default_unit_price_per_month = p_default_unit_price_per_month,
    follows_plan_annual_discount = coalesce(p_follows_plan_annual_discount, v_add_on.follows_plan_annual_discount),
    is_active = coalesce(p_is_active, v_add_on.is_active),
    updated_at = now()
  WHERE id = p_add_on_id
  RETURNING * INTO v_add_on;

  v_after := jsonb_build_object(
    'default_unit_price_per_month', v_add_on.default_unit_price_per_month,
    'follows_plan_annual_discount', v_add_on.follows_plan_annual_discount,
    'is_active', v_add_on.is_active
  );

  INSERT INTO public.cms_plan_price_adjustments (
    entity_type, entity_id, add_on_id, adjusted_by, reason, before_state, after_state
  ) VALUES (
    'add_on', p_add_on_id, p_add_on_id, auth.uid(), trim(p_reason), v_before, v_after
  );

  RETURN jsonb_build_object(
    'id', v_add_on.id,
    'code', v_add_on.code,
    'name', v_add_on.name,
    'default_unit_price_per_month', v_add_on.default_unit_price_per_month,
    'follows_plan_annual_discount', v_add_on.follows_plan_annual_discount,
    'is_active', v_add_on.is_active,
    'after_state', v_after
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_plan_add_on_override(
  p_plan_id uuid,
  p_add_on_id uuid,
  p_unit_price_override_per_month numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.subscription_plan_add_ons%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
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

  PERFORM public.admin_validate_price_amount(p_unit_price_override_per_month);

  SELECT * INTO v_row
  FROM public.subscription_plan_add_ons
  WHERE subscription_plan_id = p_plan_id
    AND add_on_id = p_add_on_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan add-on relation not found' USING ERRCODE = 'P0002';
  END IF;

  v_entity_id := p_plan_id;

  v_before := jsonb_build_object(
    'subscription_plan_id', v_row.subscription_plan_id,
    'add_on_id', v_row.add_on_id,
    'unit_price_override_per_month', v_row.unit_price_override_per_month
  );

  UPDATE public.subscription_plan_add_ons
  SET unit_price_override_per_month = p_unit_price_override_per_month
  WHERE subscription_plan_id = p_plan_id
    AND add_on_id = p_add_on_id
  RETURNING * INTO v_row;

  v_after := jsonb_build_object(
    'subscription_plan_id', v_row.subscription_plan_id,
    'add_on_id', v_row.add_on_id,
    'unit_price_override_per_month', v_row.unit_price_override_per_month
  );

  INSERT INTO public.cms_plan_price_adjustments (
    entity_type, entity_id, plan_id, add_on_id, adjusted_by, reason, before_state, after_state
  ) VALUES (
    'plan_add_on', v_entity_id, p_plan_id, p_add_on_id, auth.uid(), trim(p_reason), v_before, v_after
  );

  RETURN jsonb_build_object(
    'subscription_plan_id', v_row.subscription_plan_id,
    'add_on_id', v_row.add_on_id,
    'unit_price_override_per_month', v_row.unit_price_override_per_month,
    'after_state', v_after
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_validate_price_amount(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscription_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscription_add_ons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_plan_add_on_overrides(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_plan_price_adjustments(text, uuid, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_plan(uuid, numeric, numeric, integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_add_on(uuid, numeric, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_plan_add_on_override(uuid, uuid, numeric, text) TO authenticated;
