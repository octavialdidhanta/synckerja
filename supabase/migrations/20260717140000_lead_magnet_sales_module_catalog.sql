-- Add leadMagnet to sales tenant module catalog (CMS manual grant for non-self-service orgs).

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
    'requestForm'
  ]::text[];
$$;

-- Seed leadMagnet = false for all orgs that already have sales module rows.
INSERT INTO public.organization_sales_module_access (
  organization_id,
  module_key,
  is_enabled
)
SELECT DISTINCT m.organization_id, 'leadMagnet', false
FROM public.organization_sales_module_access m
ON CONFLICT (organization_id, module_key) DO NOTHING;
