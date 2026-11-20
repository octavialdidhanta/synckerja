-- Remove the legacy /thinking page data and catalog entry.
-- Keeps Thinking Lab tables and rows (workspace = 'thinking_lab').

DROP TABLE IF EXISTS public.thinking_ideas;
DROP TABLE IF EXISTS public.thinking_angles;
DROP TABLE IF EXISTS public.thinking_territories;

DELETE FROM public.thinking_master_thoughts
WHERE workspace IS NULL;

ALTER TABLE public.thinking_master_thoughts
  DROP CONSTRAINT IF EXISTS thinking_master_thoughts_workspace_check;

ALTER TABLE public.thinking_master_thoughts
  ALTER COLUMN workspace SET NOT NULL;

ALTER TABLE public.thinking_master_thoughts
  ADD CONSTRAINT thinking_master_thoughts_workspace_check
  CHECK (workspace = 'thinking_lab');

COMMENT ON COLUMN public.thinking_master_thoughts.workspace IS
  'Thinking Lab workspace. Legacy /thinking rows used a null workspace and were removed.';

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
    WHEN 'leadMagnet' THEN 'Lead Magnet'
    WHEN 'customerSupport' THEN 'Customer Support'
    ELSE p_module_key
  END;
$$;

DELETE FROM public.subscription_plan_module_access
WHERE module_key = 'thinking';

DELETE FROM public.organization_sales_module_access
WHERE module_key = 'thinking';

DELETE FROM public.permission_configurations
WHERE page_path = '/thinking';

DELETE FROM public.permission_configuration_defaults
WHERE page_path = '/thinking';

NOTIFY pgrst, 'reload schema';
