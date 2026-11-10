-- Split the shared operations module.
-- pos: cashier pages (dashboard, outlet, employee slots, library, inventory).
-- operations: Sales, TikTok Shop, Blibli Shop, and E-Commerce Chat.
-- Existing flags are copied so a tenant who already had the combined module keeps both.

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
    'pos',
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
    WHEN 'pos' THEN 'POS'
    WHEN 'operations' THEN 'Operations'
    WHEN 'tools' THEN 'Tools'
    WHEN 'requestForm' THEN 'Request Form'
    WHEN 'customModules' THEN 'kustom'
    WHEN 'leadMagnet' THEN 'Lead Magnet'
    WHEN 'customerSupport' THEN 'Customer Support'
    ELSE p_module_key
  END;
$$;

INSERT INTO public.organization_sales_module_access (
  organization_id,
  module_key,
  is_enabled
)
SELECT
  existing.organization_id,
  'pos',
  existing.is_enabled
FROM public.organization_sales_module_access AS existing
WHERE existing.module_key = 'operations'
ON CONFLICT (organization_id, module_key) DO NOTHING;

INSERT INTO public.subscription_plan_module_access (
  subscription_plan_id,
  module_key,
  is_enabled
)
SELECT
  existing.subscription_plan_id,
  'pos',
  existing.is_enabled
FROM public.subscription_plan_module_access AS existing
WHERE existing.module_key = 'operations'
ON CONFLICT (subscription_plan_id, module_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
