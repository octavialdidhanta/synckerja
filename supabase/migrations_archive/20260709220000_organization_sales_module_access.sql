-- Sales tenant per-module access (upsell): blocked modules stay visible in nav but deny route access.

CREATE TABLE public.organization_sales_module_access (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_key),
  CONSTRAINT organization_sales_module_access_key_check
    CHECK (module_key <> 'dashboard' AND module_key <> 'subscription')
);

CREATE INDEX organization_sales_module_access_org_idx
  ON public.organization_sales_module_access (organization_id);

ALTER TABLE public.organization_sales_module_access ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.organization_sales_module_access IS
  'Per-org module enablement for sales tenants (subscription_self_service_enabled = false). CMS writes via admin RPC; office reads via RLS member SELECT.';

-- Org members may read their org module flags (no write).
CREATE POLICY "organization_sales_module_access_select_member"
  ON public.organization_sales_module_access
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE TABLE public.cms_organization_module_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  adjusted_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cms_organization_module_adjustments_org_created_idx
  ON public.cms_organization_module_adjustments (organization_id, created_at DESC);

ALTER TABLE public.cms_organization_module_adjustments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.cms_organization_module_adjustments IS
  'CMS admin audit log for organization_sales_module_access changes. Read/write via admin RPCs only.';

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
    'omnichannel',
    'operations',
    'tools',
    'requestForm'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.seed_sales_module_access_defaults(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    INSERT INTO public.organization_sales_module_access (
      organization_id,
      module_key,
      is_enabled
    ) VALUES (
      p_organization_id,
      v_key,
      false
    )
    ON CONFLICT (organization_id, module_key) DO NOTHING;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.seed_sales_module_access_defaults(uuid) IS
  'Insert default sales module rows (all disabled). Used when org becomes sales tenant.';
