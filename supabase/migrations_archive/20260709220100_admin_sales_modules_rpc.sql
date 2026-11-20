-- CMS admin RPCs for sales tenant module access + extend settings toggle to seed defaults.

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
      'modules', '{}'::jsonb
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

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'is_sales_tenant', true,
    'modules', v_modules
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_get_organization_sales_modules(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_organization_sales_modules(
  p_organization_id uuid,
  p_modules jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_key text;
  v_val boolean;
  v_catalog text[];
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

  v_catalog := public.sales_module_catalog_keys();

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_modules) AS e(key, value)
    WHERE e.key = ANY (ARRAY['dashboard', 'subscription'])
       OR NOT (e.key = ANY (v_catalog))
       OR jsonb_typeof(e.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'invalid module keys in payload' USING ERRCODE = '22023';
  END IF;

  PERFORM public.seed_sales_module_access_defaults(p_organization_id);

  FOREACH v_key IN ARRAY v_catalog
  LOOP
    SELECT m.is_enabled
    INTO v_val
    FROM public.organization_sales_module_access m
    WHERE m.organization_id = p_organization_id
      AND m.module_key = v_key;

    v_before := v_before || jsonb_build_object(v_key, coalesce(v_val, false));
  END LOOP;

  FOREACH v_key IN ARRAY v_catalog
  LOOP
    IF p_modules ? v_key THEN
      v_val := (p_modules ->> v_key)::boolean;
    ELSE
      SELECT m.is_enabled
      INTO v_val
      FROM public.organization_sales_module_access m
      WHERE m.organization_id = p_organization_id
        AND m.module_key = v_key;
      v_val := coalesce(v_val, false);
    END IF;

    INSERT INTO public.organization_sales_module_access (
      organization_id,
      module_key,
      is_enabled,
      updated_at
    ) VALUES (
      p_organization_id,
      v_key,
      v_val,
      now()
    )
    ON CONFLICT (organization_id, module_key)
    DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      updated_at = now();

    v_after := v_after || jsonb_build_object(v_key, v_val);
  END LOOP;

  INSERT INTO public.cms_organization_module_adjustments (
    organization_id,
    adjusted_by,
    reason,
    before_state,
    after_state
  ) VALUES (
    p_organization_id,
    auth.uid(),
    trim(p_reason),
    jsonb_build_object('modules', v_before),
    jsonb_build_object('modules', v_after)
  );

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'modules', v_after,
    'before_state', jsonb_build_object('modules', v_before),
    'after_state', jsonb_build_object('modules', v_after)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_organization_sales_modules(uuid, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_organization_module_adjustments(
  p_organization_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
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

  lim := greatest(1, least(coalesce(p_limit, 20), 100));

  RETURN QUERY
  SELECT
    a.id,
    a.organization_id,
    a.adjusted_by,
    a.reason,
    a.before_state,
    a.after_state,
    a.created_at
  FROM public.cms_organization_module_adjustments a
  WHERE a.organization_id = p_organization_id
  ORDER BY a.created_at DESC
  LIMIT lim;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_organization_module_adjustments(uuid, integer) TO authenticated;

-- Extend settings toggle: seed sales module defaults when becoming sales tenant.

CREATE OR REPLACE FUNCTION public.admin_update_organization_settings(
  p_organization_id uuid,
  p_subscription_self_service_enabled boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_was_sales boolean;
  v_will_be_sales boolean;
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

  IF p_subscription_self_service_enabled IS NULL THEN
    RAISE EXCEPTION 'subscription_self_service_enabled required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  v_was_sales := NOT coalesce(v_org.subscription_self_service_enabled, true);
  v_will_be_sales := NOT p_subscription_self_service_enabled;

  v_before := jsonb_build_object(
    'subscription_self_service_enabled', v_org.subscription_self_service_enabled
  );

  v_after := jsonb_build_object(
    'subscription_self_service_enabled', p_subscription_self_service_enabled
  );

  UPDATE public.organizations
  SET subscription_self_service_enabled = p_subscription_self_service_enabled
  WHERE id = p_organization_id;

  IF v_will_be_sales AND NOT v_was_sales THEN
    PERFORM public.seed_sales_module_access_defaults(p_organization_id);
  END IF;

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
    v_before,
    v_after
  );

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'subscription_self_service_enabled', p_subscription_self_service_enabled,
    'before_state', v_before,
    'after_state', v_after
  );
END;
$function$;
