-- Plan-level module access for mandiri tenants (CMS configure; office enforces in fase 2).

CREATE TABLE public.subscription_plan_module_access (
  subscription_plan_id uuid NOT NULL REFERENCES public.subscription_plans (id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_plan_id, module_key),
  CONSTRAINT subscription_plan_module_access_key_check
    CHECK (module_key <> 'dashboard' AND module_key <> 'subscription')
);

CREATE INDEX subscription_plan_module_access_plan_idx
  ON public.subscription_plan_module_access (subscription_plan_id);

ALTER TABLE public.subscription_plan_module_access ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.subscription_plan_module_access IS
  'Per-plan module enablement for mandiri tenants. CMS writes via admin RPC; office reads via RLS SELECT (fase 2 gate).';

CREATE POLICY "subscription_plan_module_access_select_authenticated"
  ON public.subscription_plan_module_access
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.cms_plan_module_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_plan_id uuid NOT NULL REFERENCES public.subscription_plans (id) ON DELETE CASCADE,
  adjusted_by uuid NOT NULL REFERENCES auth.users (id),
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cms_plan_module_adjustments_plan_created_idx
  ON public.cms_plan_module_adjustments (subscription_plan_id, created_at DESC);

ALTER TABLE public.cms_plan_module_adjustments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.cms_plan_module_adjustments IS
  'CMS admin audit log for subscription_plan_module_access changes.';

CREATE OR REPLACE FUNCTION public.seed_plan_module_access_defaults(p_subscription_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_key text;
BEGIN
  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    INSERT INTO public.subscription_plan_module_access (
      subscription_plan_id,
      module_key,
      is_enabled
    ) VALUES (
      p_subscription_plan_id,
      v_key,
      false
    )
    ON CONFLICT (subscription_plan_id, module_key) DO NOTHING;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public._plan_module_label(p_module_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_module_key
    WHEN 'okr' THEN 'OKR'
    WHEN 'humanResources' THEN 'Human Resources'
    WHEN 'finance' THEN 'Finance'
    WHEN 'digitalMarketing' THEN 'Digital Marketing'
    WHEN 'omnichannel' THEN 'Operations / Omnichannel'
    WHEN 'operations' THEN 'Sales Operations'
    WHEN 'tools' THEN 'Tools'
    WHEN 'requestForm' THEN 'Request Form'
    ELSE p_module_key
  END;
$$;

CREATE OR REPLACE FUNCTION public._build_plan_features_from_modules(
  p_base_price_per_member numeric,
  p_modules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_features jsonb := '[]'::jsonb;
  v_key text;
  v_enabled boolean;
BEGIN
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

CREATE OR REPLACE FUNCTION public._apply_plan_modules(
  p_subscription_plan_id uuid,
  p_modules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_catalog text[];
  v_key text;
  v_val boolean;
  v_after jsonb := '{}'::jsonb;
BEGIN
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

  PERFORM public.seed_plan_module_access_defaults(p_subscription_plan_id);

  FOREACH v_key IN ARRAY v_catalog
  LOOP
    IF p_modules ? v_key THEN
      v_val := (p_modules ->> v_key)::boolean;
    ELSE
      SELECT m.is_enabled
      INTO v_val
      FROM public.subscription_plan_module_access m
      WHERE m.subscription_plan_id = p_subscription_plan_id
        AND m.module_key = v_key;
      v_val := coalesce(v_val, false);
    END IF;

    INSERT INTO public.subscription_plan_module_access (
      subscription_plan_id,
      module_key,
      is_enabled,
      updated_at
    ) VALUES (
      p_subscription_plan_id,
      v_key,
      v_val,
      now()
    )
    ON CONFLICT (subscription_plan_id, module_key)
    DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      updated_at = now();

    v_after := v_after || jsonb_build_object(v_key, v_val);
  END LOOP;

  RETURN v_after;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_plan_modules(p_subscription_plan_id uuid)
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
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans WHERE id = p_subscription_plan_id
  ) THEN
    RAISE EXCEPTION 'plan not found' USING ERRCODE = 'P0002';
  END IF;

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

  RETURN jsonb_build_object(
    'subscription_plan_id', p_subscription_plan_id,
    'modules', v_modules
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
  p_annual_discount_percentage numeric DEFAULT NULL,
  p_jumlah_hari_trial integer DEFAULT NULL
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

  v_features := public._build_plan_features_from_modules(p_base_price_per_member, p_modules);

  INSERT INTO public.subscription_plans (
    name,
    description,
    base_price_per_member,
    features,
    is_active,
    annual_discount_percentage,
    jumlah_hari_trial
  )
  VALUES (
    v_slug,
    nullif(trim(p_description), ''),
    p_base_price_per_member,
    v_features,
    coalesce(p_is_active, true),
    p_annual_discount_percentage,
    p_jumlah_hari_trial
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
    'is_active', v_plan.is_active,
    'features', v_plan.features,
    'modules', v_modules_after
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

  v_features := public._build_plan_features_from_modules(v_plan.base_price_per_member, v_after);

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

CREATE OR REPLACE FUNCTION public.admin_list_plan_module_adjustments(
  p_subscription_plan_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  subscription_plan_id uuid,
  adjusted_by uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  lim int;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  lim := greatest(1, least(coalesce(p_limit, 10), 50));

  RETURN QUERY
  SELECT
    a.id,
    a.subscription_plan_id,
    a.adjusted_by,
    a.reason,
    a.before_state,
    a.after_state,
    a.created_at
  FROM public.cms_plan_module_adjustments a
  WHERE a.subscription_plan_id = p_subscription_plan_id
  ORDER BY a.created_at DESC
  LIMIT lim;
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

GRANT EXECUTE ON FUNCTION public.seed_plan_module_access_defaults(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_plan_modules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_plan_modules(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_plan_module_adjustments(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscription_plans() TO authenticated;
