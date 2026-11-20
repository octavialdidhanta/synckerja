-- Structured max member cap per plan + safe features regeneration (CMS + office).

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_members integer NULL;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_max_members_check;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_max_members_check
  CHECK (max_members IS NULL OR (max_members >= 1 AND max_members <= 1000));

COMMENT ON COLUMN public.subscription_plans.max_members IS
  'Max seats allowed when subscribing to this plan (slider cap). NULL resolves to 1 (trial/free) or 100 (paid) in CMS RPC.';

CREATE OR REPLACE FUNCTION public._validate_plan_max_members(p_max_members integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF p_max_members IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_max_members < 1 OR p_max_members > 1000 THEN
    RAISE EXCEPTION 'max_members must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN p_max_members;
END;
$function$;

CREATE OR REPLACE FUNCTION public._resolve_plan_max_members(
  p_max_members integer,
  p_jumlah_hari_trial integer,
  p_base_price_per_member numeric
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_validated integer;
BEGIN
  v_validated := public._validate_plan_max_members(p_max_members);
  IF v_validated IS NOT NULL THEN
    RETURN v_validated;
  END IF;

  IF p_jumlah_hari_trial IS NOT NULL AND p_jumlah_hari_trial > 0 THEN
    RETURN 1;
  END IF;

  IF p_base_price_per_member IS NOT NULL AND p_base_price_per_member = 0 THEN
    RETURN 1;
  END IF;

  RETURN 100;
END;
$function$;

CREATE OR REPLACE FUNCTION public._parse_member_limit_from_features(p_features jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_feature text;
  v_match text[];
BEGIN
  IF p_features IS NULL OR jsonb_typeof(p_features) <> 'array' THEN
    RETURN NULL;
  END IF;

  FOR v_feature IN
    SELECT jsonb_array_elements_text(p_features)
  LOOP
    v_match := regexp_match(v_feature, '^(\d+)\s*Member\s*Allowed', 'i');
    IF v_match IS NOT NULL THEN
      RETURN greatest(1, (v_match[1])::integer);
    END IF;

    v_match := regexp_match(v_feature, '^Hingga\s*(\d+)', 'i');
    IF v_match IS NOT NULL THEN
      RETURN greatest(1, (v_match[1])::integer);
    END IF;

    v_match := regexp_match(
      v_feature,
      '(\d+)\s*(employee\s*limit|karyawan|orang|employees?|members?|anggota)',
      'i'
    );
    IF v_match IS NOT NULL THEN
      RETURN greatest(1, (v_match[1])::integer);
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public._plan_modules_json_for_plan(p_subscription_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_modules jsonb := '{}'::jsonb;
  v_key text;
  v_enabled boolean;
BEGIN
  PERFORM public.seed_plan_module_access_defaults(p_subscription_plan_id);

  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    SELECT m.is_enabled
    INTO v_enabled
    FROM public.subscription_plan_module_access m
    WHERE m.subscription_plan_id = p_subscription_plan_id
      AND m.module_key = v_key;

    v_modules := v_modules || jsonb_build_object(v_key, coalesce(v_enabled, false));
  END LOOP;

  RETURN v_modules;
END;
$function$;

DROP FUNCTION IF EXISTS public._build_plan_features_from_modules(numeric, jsonb);

CREATE OR REPLACE FUNCTION public._build_plan_features_from_modules(
  p_base_price_per_member numeric,
  p_modules jsonb,
  p_max_members integer
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_features jsonb := '[]'::jsonb;
  v_key text;
  v_enabled boolean;
  v_cap integer;
BEGIN
  v_cap := public._resolve_plan_max_members(p_max_members, NULL, p_base_price_per_member);

  IF v_cap IS NOT NULL THEN
    v_features := v_features || jsonb_build_array(v_cap::text || ' Member Allowed');
  END IF;

  IF p_base_price_per_member IS NOT NULL AND p_base_price_per_member >= 0 THEN
    v_features := v_features || jsonb_build_array(
      'Rp ' || trim(to_char(p_base_price_per_member, 'FM999G999G999')) || ' per member / bulan'
    );
  END IF;

  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    IF p_modules ? v_key AND (p_modules ->> v_key)::boolean IS TRUE THEN
      v_features := v_features || jsonb_build_array('Modul ' || public._plan_module_label(v_key));
    END IF;
  END LOOP;

  v_features := v_features || jsonb_build_array('Dashboard selalu aktif');

  RETURN v_features;
END;
$function$;

CREATE OR REPLACE FUNCTION public._regenerate_plan_features_for_plan(p_subscription_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_modules jsonb;
  v_features jsonb;
BEGIN
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_subscription_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found' USING ERRCODE = 'P0002';
  END IF;

  v_modules := public._plan_modules_json_for_plan(p_subscription_plan_id);
  v_features := public._build_plan_features_from_modules(
    v_plan.base_price_per_member,
    v_modules,
    v_plan.max_members
  );

  RETURN v_features;
END;
$function$;

-- Backfill max_members from legacy features, then regenerate features once.
UPDATE public.subscription_plans sp
SET max_members = coalesce(
  public._parse_member_limit_from_features(sp.features),
  CASE
    WHEN sp.jumlah_hari_trial IS NOT NULL AND sp.jumlah_hari_trial > 0 THEN 1
    WHEN sp.base_price_per_member = 0 THEN 1
    ELSE 100
  END
)
WHERE sp.max_members IS NULL;

UPDATE public.subscription_plans sp
SET
  features = public._regenerate_plan_features_for_plan(sp.id),
  updated_at = now();

DROP FUNCTION IF EXISTS public.admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, numeric, integer);

CREATE OR REPLACE FUNCTION public.admin_create_subscription_plan(
  p_name text,
  p_base_price_per_member numeric,
  p_modules jsonb,
  p_is_active boolean,
  p_reason text,
  p_description text DEFAULT NULL,
  p_annual_discount_percentage numeric DEFAULT NULL,
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

  IF p_annual_discount_percentage IS NOT NULL
     AND (p_annual_discount_percentage < 0 OR p_annual_discount_percentage > 100) THEN
    RAISE EXCEPTION 'annual_discount_percentage must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  IF p_jumlah_hari_trial IS NOT NULL AND p_jumlah_hari_trial < 0 THEN
    RAISE EXCEPTION 'jumlah_hari_trial must be >= 0' USING ERRCODE = '22023';
  END IF;

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
    p_annual_discount_percentage,
    p_jumlah_hari_trial,
    v_max_members
  )
  RETURNING * INTO v_plan;

  v_modules_after := public._apply_plan_modules(v_plan.id, p_modules);

  INSERT INTO public.cms_plan_price_adjustments (
    entity_type,
    entity_id,
    plan_id,
    adjusted_by,
    reason,
    before_state,
    after_state
  )
  VALUES (
    'plan',
    v_plan.id,
    v_plan.id,
    auth.uid(),
    trim(p_reason),
    '{}'::jsonb,
    jsonb_build_object(
      'action', 'create',
      'name', v_plan.name,
      'base_price_per_member', v_plan.base_price_per_member,
      'annual_discount_percentage', v_plan.annual_discount_percentage,
      'jumlah_hari_trial', v_plan.jumlah_hari_trial,
      'max_members', v_plan.max_members,
      'is_active', v_plan.is_active,
      'modules', v_modules_after
    )
  );

  INSERT INTO public.cms_plan_module_adjustments (
    subscription_plan_id,
    adjusted_by,
    reason,
    before_state,
    after_state
  )
  VALUES (
    v_plan.id,
    auth.uid(),
    trim(p_reason),
    jsonb_build_object('modules', '{}'::jsonb),
    jsonb_build_object('modules', v_modules_after)
  );

  RETURN jsonb_build_object(
    'id', v_plan.id,
    'name', v_plan.name,
    'description', v_plan.description,
    'base_price_per_member', v_plan.base_price_per_member,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'max_members', v_plan.max_members,
    'is_active', v_plan.is_active,
    'features', v_plan.features,
    'modules', v_modules_after
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_update_subscription_plan(uuid, numeric, numeric, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_update_subscription_plan(
  p_plan_id uuid,
  p_base_price_per_member numeric,
  p_annual_discount_percentage numeric,
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

  v_max_members := public._resolve_plan_max_members(
    public._validate_plan_max_members(p_max_members),
    coalesce(p_jumlah_hari_trial, v_plan.jumlah_hari_trial),
    p_base_price_per_member
  );

  v_before := jsonb_build_object(
    'base_price_per_member', v_plan.base_price_per_member,
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'max_members', v_plan.max_members,
    'is_active', v_plan.is_active
  );

  v_features := public._regenerate_plan_features_for_plan(p_plan_id);
  -- regenerate uses OLD max_members until update; rebuild with new values
  v_features := public._build_plan_features_from_modules(
    p_base_price_per_member,
    public._plan_modules_json_for_plan(p_plan_id),
    v_max_members
  );

  UPDATE public.subscription_plans
  SET
    base_price_per_member = p_base_price_per_member,
    annual_discount_percentage = p_annual_discount_percentage,
    jumlah_hari_trial = p_jumlah_hari_trial,
    max_members = v_max_members,
    features = v_features,
    is_active = coalesce(p_is_active, v_plan.is_active),
    updated_at = now()
  WHERE id = p_plan_id
  RETURNING * INTO v_plan;

  v_after := jsonb_build_object(
    'base_price_per_member', v_plan.base_price_per_member,
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
    'annual_discount_percentage', v_plan.annual_discount_percentage,
    'jumlah_hari_trial', v_plan.jumlah_hari_trial,
    'max_members', v_plan.max_members,
    'is_active', v_plan.is_active,
    'features', v_plan.features,
    'after_state', v_after
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_plan_modules(
  p_subscription_plan_id uuid,
  p_modules jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb;
  v_key text;
  v_val boolean;
  v_features jsonb;
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

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_subscription_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.seed_plan_module_access_defaults(p_subscription_plan_id);

  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    SELECT m.is_enabled
    INTO v_val
    FROM public.subscription_plan_module_access m
    WHERE m.subscription_plan_id = p_subscription_plan_id
      AND m.module_key = v_key;

    v_before := v_before || jsonb_build_object(v_key, coalesce(v_val, false));
  END LOOP;

  v_after := public._apply_plan_modules(p_subscription_plan_id, p_modules);

  v_features := public._build_plan_features_from_modules(
    v_plan.base_price_per_member,
    v_after,
    v_plan.max_members
  );

  UPDATE public.subscription_plans
  SET features = v_features, updated_at = now()
  WHERE id = p_subscription_plan_id;

  INSERT INTO public.cms_plan_module_adjustments (
    subscription_plan_id,
    adjusted_by,
    reason,
    before_state,
    after_state
  )
  VALUES (
    p_subscription_plan_id,
    auth.uid(),
    trim(p_reason),
    jsonb_build_object('modules', v_before),
    jsonb_build_object('modules', v_after)
  );

  RETURN jsonb_build_object(
    'subscription_plan_id', p_subscription_plan_id,
    'modules', v_after,
    'before_state', jsonb_build_object('modules', v_before),
    'after_state', jsonb_build_object('modules', v_after)
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_list_subscription_plans();

CREATE OR REPLACE FUNCTION public.admin_list_subscription_plans()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  base_price_per_member numeric,
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

GRANT EXECUTE ON FUNCTION public._validate_plan_max_members(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public._resolve_plan_max_members(integer, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public._parse_member_limit_from_features(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._plan_modules_json_for_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._regenerate_plan_features_for_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, numeric, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription_plan(uuid, numeric, numeric, integer, integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscription_plans() TO authenticated;
