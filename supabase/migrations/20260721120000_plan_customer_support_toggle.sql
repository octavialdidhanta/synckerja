-- Plan-level "Customer Support" toggle (plan card label only — tier label derived in Office/CMS UI).

CREATE OR REPLACE FUNCTION public.sales_module_catalog_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT ARRAY[
    'okr',
    'humanResources',
    'finance',
    'digitalMarketing',
    'leadMagnet',
    'omnichannel',
    'operations',
    'tools',
    'requestForm',
    'customModules',
    'customerSupport'
  ]::text[];
$$;

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
    IF v_key = 'customerSupport' THEN
      CONTINUE;
    END IF;
    IF p_modules ? v_key AND (p_modules ->> v_key)::boolean IS TRUE THEN
      v_features := v_features || jsonb_build_array('Modul ' || public._plan_module_label(v_key));
    END IF;
  END LOOP;

  v_features := v_features || jsonb_build_array('Dashboard selalu aktif');

  RETURN v_features;
END;
$function$;

INSERT INTO public.subscription_plan_module_access (subscription_plan_id, module_key, is_enabled)
SELECT sp.id, 'customerSupport', true
FROM public.subscription_plans sp
ON CONFLICT (subscription_plan_id, module_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
