-- Plan-level "Custom Modul" toggle (plan card label only — not a routed nav module).

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
    'customModules'
  ]::text[];
$$;

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
    WHEN 'customModules' THEN 'kustom'
    ELSE p_module_key
  END;
$$;

INSERT INTO public.subscription_plan_module_access (subscription_plan_id, module_key, is_enabled)
SELECT sp.id, 'customModules', false
FROM public.subscription_plans sp
ON CONFLICT (subscription_plan_id, module_key) DO NOTHING;

UPDATE public.subscription_plan_module_access AS pma
SET is_enabled = true, updated_at = now()
FROM public.subscription_plans sp
WHERE pma.subscription_plan_id = sp.id
  AND pma.module_key = 'customModules'
  AND (
    sp.is_custom = true
    OR lower(trim(regexp_replace(sp.name, '[-–—]', ' ', 'g'))) ~ '(^|[[:space:]])(enterprise)([[:space:]]|$)'
  );

DO $$
DECLARE
  v_ent_id uuid;
  v_modules jsonb;
BEGIN
  SELECT sp.id
  INTO v_ent_id
  FROM public.subscription_plans sp
  WHERE lower(trim(regexp_replace(sp.name, '[-–—]', ' ', 'g'))) ~ '(^|[[:space:]])(enterprise)([[:space:]]|$)'
  LIMIT 1;

  IF v_ent_id IS NULL THEN
    RETURN;
  END IF;

  v_modules := public._plan_modules_json_for_plan(v_ent_id);

  UPDATE public.subscription_plans
  SET
    features = public._build_plan_features_from_modules(
      base_price_per_member,
      v_modules,
      max_members
    ),
    updated_at = now()
  WHERE id = v_ent_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
