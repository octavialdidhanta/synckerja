-- Sales-only WhatsApp Business API package flag.
-- Org rows copy the current omnichannel flag so existing inboxes stay open.
-- Plan rows stay false and are hidden from mandiri plan cards.

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
    'whatsappBusiness',
    'operations',
    'tools',
    'requestForm',
    'customModules',
    'customerSupport'
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
    WHEN 'whatsappBusiness' THEN 'WhatsApp Business API'
    WHEN 'operations' THEN 'Sales Operations'
    WHEN 'tools' THEN 'Tools'
    WHEN 'requestForm' THEN 'Request Form'
    WHEN 'customModules' THEN 'kustom'
    WHEN 'leadMagnet' THEN 'Lead Magnet'
    WHEN 'customerSupport' THEN 'Customer Support'
    ELSE p_module_key
  END;
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
    IF v_key IN ('customerSupport', 'whatsappBusiness') THEN
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

INSERT INTO public.organization_sales_module_access (
  organization_id,
  module_key,
  is_enabled
)
SELECT
  orgs.organization_id,
  'whatsappBusiness',
  COALESCE(omni.is_enabled, false)
FROM (
  SELECT DISTINCT organization_id
  FROM public.organization_sales_module_access
) AS orgs
LEFT JOIN public.organization_sales_module_access AS omni
  ON omni.organization_id = orgs.organization_id
 AND omni.module_key = 'omnichannel'
ON CONFLICT (organization_id, module_key) DO NOTHING;

INSERT INTO public.subscription_plan_module_access (
  subscription_plan_id,
  module_key,
  is_enabled
)
SELECT sp.id, 'whatsappBusiness', false
FROM public.subscription_plans sp
ON CONFLICT (subscription_plan_id, module_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
