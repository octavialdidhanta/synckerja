-- Billing term discounts (1/3/6/12 months) + billing_term_months on subscriptions/payments.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS billing_term_discounts jsonb NOT NULL DEFAULT '{"1":null,"3":null,"6":null,"12":null}'::jsonb;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS billing_term_months integer NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_term_months integer NOT NULL DEFAULT 1;

ALTER TABLE public.subscription_change_requests
  ADD COLUMN IF NOT EXISTS target_billing_term_months integer NULL;

UPDATE public.subscription_plans
SET billing_term_discounts = jsonb_build_object(
  '1', null,
  '3', null,
  '6', null,
  '12', annual_discount_percentage
)
WHERE billing_term_discounts IS NULL
   OR billing_term_discounts = '{"1":null,"3":null,"6":null,"12":null}'::jsonb;

UPDATE public.organization_subscriptions
SET billing_term_months = CASE WHEN billing_cycle = 'yearly' THEN 12 ELSE 1 END
WHERE billing_term_months IS NULL OR billing_term_months = 1;

UPDATE public.payments
SET billing_term_months = CASE WHEN billing_cycle = 'yearly' THEN 12 ELSE 1 END
WHERE billing_term_months IS NULL;

CREATE OR REPLACE FUNCTION public._default_billing_term_discounts()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{"1":null,"3":null,"6":null,"12":null}'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public._coerce_billing_term_months(p_months integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_months IN (1, 3, 6, 12) THEN p_months
    WHEN p_months = 12 THEN 12
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public._billing_term_discount(p_discounts jsonb, p_months integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_discounts ? p_months::text THEN (p_discounts ->> p_months::text)::numeric
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public._validate_billing_term_discounts(p_discounts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_key text;
  v_val numeric;
  v_out jsonb := public._default_billing_term_discounts();
BEGIN
  IF p_discounts IS NULL THEN
    RETURN v_out;
  END IF;

  IF jsonb_typeof(p_discounts) <> 'object' THEN
    RAISE EXCEPTION 'billing_term_discounts must be a json object' USING ERRCODE = '22023';
  END IF;

  FOREACH v_key IN ARRAY ARRAY['1', '3', '6', '12']
  LOOP
    IF p_discounts ? v_key AND p_discounts ->> v_key IS NOT NULL AND p_discounts ->> v_key <> 'null' THEN
      v_val := (p_discounts ->> v_key)::numeric;
      IF v_val < 0 OR v_val > 100 THEN
        RAISE EXCEPTION 'billing term discount for % months must be between 0 and 100', v_key USING ERRCODE = '22023';
      END IF;
      v_out := jsonb_set(v_out, ARRAY[v_key], to_jsonb(v_val), true);
    END IF;
  END LOOP;

  RETURN v_out;
END;
$function$;

CREATE OR REPLACE FUNCTION public._billing_cycle_from_term_months(p_months integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN public._coerce_billing_term_months(p_months) = 12 THEN 'yearly' ELSE 'monthly' END;
$$;

-- Drop old admin RPC signatures before recreate
DROP FUNCTION IF EXISTS public.admin_update_subscription_plan(uuid, numeric, numeric, integer, integer, boolean, text);
DROP FUNCTION IF EXISTS public.admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, numeric, integer, integer);
DROP FUNCTION IF EXISTS public.admin_list_subscription_plans();

CREATE OR REPLACE FUNCTION public.admin_update_subscription_plan(
  p_plan_id uuid,
  p_base_price_per_member numeric,
  p_billing_term_discounts jsonb,
  p_jumlah_hari_trial integer,
  p_max_members integer,
  p_is_active boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_features jsonb;
  v_max_members integer;
  v_discounts jsonb;
  v_annual numeric;
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

  IF p_jumlah_hari_trial IS NOT NULL AND p_jumlah_hari_trial < 0 THEN
    RAISE EXCEPTION 'jumlah_hari_trial must be >= 0' USING ERRCODE = '22023';
  END IF;

  v_discounts := public._validate_billing_term_discounts(p_billing_term_discounts);
  v_annual := public._billing_term_discount(v_discounts, 12);

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found' USING ERRCODE = 'P0002';
  END IF;

  v_max_members := public._resolve_plan_max_members(
    public._validate_plan_max_members(p_max_members),
    coalesce(p_jumlah_hari_trial, v_plan.jumlah_hari_trial),
    p_base_price_per_member
  );

  v_before := jsonb_build_object(
    'base_price_per_member', v_plan.base_price_per_member,
    'billing_term_discounts', v_plan.billing_term_discounts,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'max_members', v_plan.max_members,
    'is_active', v_plan.is_active
  );

  v_features := public._build_plan_features_from_modules(
    p_base_price_per_member,
    public._plan_modules_json_for_plan(p_plan_id),
    v_max_members
  );

  UPDATE public.subscription_plans
  SET
    base_price_per_member = p_base_price_per_member,
    billing_term_discounts = v_discounts,
    annual_discount_percentage = v_annual,
    jumlah_hari_trial = p_jumlah_hari_trial,
    max_members = v_max_members,
    features = v_features,
    is_active = coalesce(p_is_active, v_plan.is_active),
    updated_at = now()
  WHERE id = p_plan_id
  RETURNING * INTO v_plan;

  v_after := jsonb_build_object(
    'base_price_per_member', v_plan.base_price_per_member,
    'billing_term_discounts', v_plan.billing_term_discounts,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'max_members', v_plan.max_members,
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
    'billing_term_discounts', v_plan.billing_term_discounts,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'max_members', v_plan.max_members,
    'is_active', v_plan.is_active,
    'features', v_plan.features,
    'after_state', v_after
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_subscription_plan(
  p_name text,
  p_base_price_per_member numeric,
  p_modules jsonb,
  p_is_active boolean,
  p_reason text,
  p_description text DEFAULT NULL,
  p_billing_term_discounts jsonb DEFAULT NULL,
  p_jumlah_hari_trial integer DEFAULT NULL,
  p_max_members integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_modules_after jsonb;
  v_features jsonb;
  v_slug text;
  v_max_members integer;
  v_discounts jsonb;
  v_annual numeric;
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

  IF p_modules IS NULL OR jsonb_typeof(p_modules) <> 'object' THEN
    RAISE EXCEPTION 'modules must be a json object' USING ERRCODE = '22023';
  END IF;

  v_slug := lower(trim(p_name));

  IF v_slug IS NULL OR char_length(v_slug) < 2 THEN
    RAISE EXCEPTION 'plan name required (min 2 characters)' USING ERRCODE = '22023';
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'plan name must be lowercase slug (a-z, 0-9, hyphen)' USING ERRCODE = '22023';
  END IF;

  PERFORM public.admin_validate_price_amount(p_base_price_per_member);

  IF p_jumlah_hari_trial IS NOT NULL AND p_jumlah_hari_trial < 0 THEN
    RAISE EXCEPTION 'jumlah_hari_trial must be >= 0' USING ERRCODE = '22023';
  END IF;

  v_discounts := public._validate_billing_term_discounts(coalesce(p_billing_term_discounts, public._default_billing_term_discounts()));
  v_annual := public._billing_term_discount(v_discounts, 12);

  v_max_members := public._resolve_plan_max_members(
    public._validate_plan_max_members(p_max_members),
    p_jumlah_hari_trial,
    p_base_price_per_member
  );

  v_features := public._build_plan_features_from_modules(
    p_base_price_per_member,
    p_modules,
    v_max_members
  );

  INSERT INTO public.subscription_plans (
    name,
    description,
    base_price_per_member,
    features,
    is_active,
    billing_term_discounts,
    annual_discount_percentage,
    jumlah_hari_trial,
    max_members
  )
  VALUES (
    v_slug,
    nullif(trim(p_description), ''),
    p_base_price_per_member,
    v_features,
    coalesce(p_is_active, true),
    v_discounts,
    v_annual,
    p_jumlah_hari_trial,
    v_max_members
  )
  RETURNING * INTO v_plan;

  v_modules_after := public._apply_plan_modules(v_plan.id, p_modules);

  INSERT INTO public.cms_plan_price_adjustments (
    entity_type, entity_id, plan_id, adjusted_by, reason, before_state, after_state
  ) VALUES (
    'plan',
    v_plan.id,
    v_plan.id,
    auth.uid(),
    trim(p_reason),
    jsonb_build_object('created', true),
    jsonb_build_object(
      'base_price_per_member', v_plan.base_price_per_member,
      'billing_term_discounts', v_plan.billing_term_discounts,
      'modules', v_modules_after
    )
  );

  RETURN jsonb_build_object(
    'id', v_plan.id,
    'name', v_plan.name,
    'base_price_per_member', v_plan.base_price_per_member,
    'billing_term_discounts', v_plan.billing_term_discounts,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'max_members', v_plan.max_members,
    'is_active', v_plan.is_active,
    'features', v_plan.features
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_subscription_plans()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  base_price_per_member numeric,
  billing_term_discounts jsonb,
  annual_discount_percentage numeric,
  jumlah_hari_trial integer,
  max_members integer,
  is_active boolean,
  subscriber_count bigint,
  enabled_module_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
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
    sp.billing_term_discounts,
    sp.annual_discount_percentage,
    sp.jumlah_hari_trial,
    sp.max_members,
    sp.is_active,
    count(DISTINCT os.id) AS subscriber_count,
    coalesce((
      SELECT count(*)::bigint
      FROM public.subscription_plan_module_access pm
      WHERE pm.subscription_plan_id = sp.id AND pm.is_enabled = true
    ), 0) AS enabled_module_count,
    sp.created_at,
    sp.updated_at
  FROM public.subscription_plans sp
  LEFT JOIN public.organization_subscriptions os ON os.subscription_plan_id = sp.id
  GROUP BY sp.id
  ORDER BY sp.name;
END;
$function$;

GRANT EXECUTE ON FUNCTION public._coerce_billing_term_months(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public._billing_term_discount(jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public._validate_billing_term_discounts(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._billing_cycle_from_term_months(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_plan(uuid, numeric, jsonb, integer, integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscription_plans() TO authenticated;

NOTIFY pgrst, 'reload schema';
