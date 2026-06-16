-- Omnichannel Public API: tokens, sales_invoices, system actor, custom web_id, permissions.
-- Safe to re-run: IF NOT EXISTS, DROP IF EXISTS policies.

-- ---------------------------------------------------------------------------
-- Custom web_id per org (remove enum constraint)
-- ---------------------------------------------------------------------------
ALTER TABLE public.analytics_web_access
  DROP CONSTRAINT IF EXISTS analytics_web_access_web_id_check;

COMMENT ON COLUMN public.analytics_web_access.web_id IS
  'Website identifier for analytics (lowercase alphanumeric + hyphen, min 3 chars).';

-- ---------------------------------------------------------------------------
-- Leads: web_id + analytics_session_id for API attribution (used by livechat WA flow)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS web_id text NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS analytics_session_id uuid NULL;

COMMENT ON COLUMN public.leads.web_id IS 'Source website web_id from analytics / API ingest.';
COMMENT ON COLUMN public.leads.analytics_session_id IS 'Linked analytics_sessions.id for UTM attribution.';

-- ---------------------------------------------------------------------------
-- System actor per org (created_by for API-ingested leads)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_api_system_actors (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'Synckerja API',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_api_system_actors_pkey PRIMARY KEY (organization_id),
  CONSTRAINT organization_api_system_actors_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT organization_api_system_actors_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE RESTRICT
);

ALTER TABLE public.organization_api_system_actors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_api_system_actors_select_org ON public.organization_api_system_actors;
CREATE POLICY organization_api_system_actors_select_org
  ON public.organization_api_system_actors FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.get_or_create_org_api_system_actor(p_organization_id uuid)
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_name text := 'Synckerja API';
BEGIN
  SELECT a.user_id, a.display_name INTO v_user_id, v_name
  FROM public.organization_api_system_actors a
  WHERE a.organization_id = p_organization_id;

  IF v_user_id IS NOT NULL THEN
    RETURN QUERY SELECT v_user_id, v_name;
    RETURN;
  END IF;

  SELECT ur.user_id INTO v_user_id
  FROM public.user_roles ur
  WHERE ur.organization_id = p_organization_id
    AND ur.role IN ('owner', 'admin')
  ORDER BY CASE ur.role WHEN 'owner' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No owner/admin found for organization %', p_organization_id;
  END IF;

  INSERT INTO public.organization_api_system_actors (organization_id, user_id, display_name)
  VALUES (p_organization_id, v_user_id, v_name)
  ON CONFLICT (organization_id) DO UPDATE SET updated_at = now()
  RETURNING organization_api_system_actors.user_id, organization_api_system_actors.display_name
  INTO v_user_id, v_name;

  RETURN QUERY SELECT v_user_id, v_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_org_api_system_actor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_org_api_system_actor(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Org-level API settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_omnichannel_api_settings (
  organization_id uuid NOT NULL,
  default_whatsapp_invoice_template_name text NULL,
  offline_conversion_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_omnichannel_api_settings_pkey PRIMARY KEY (organization_id),
  CONSTRAINT organization_omnichannel_api_settings_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE
);

ALTER TABLE public.organization_omnichannel_api_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_omnichannel_api_settings_select_org ON public.organization_omnichannel_api_settings;
CREATE POLICY organization_omnichannel_api_settings_select_org
  ON public.organization_omnichannel_api_settings FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS organization_omnichannel_api_settings_mutate_admin ON public.organization_omnichannel_api_settings;
CREATE POLICY organization_omnichannel_api_settings_mutate_admin
  ON public.organization_omnichannel_api_settings FOR ALL TO authenticated
  USING (public.get_user_role_in_active_org() IN ('owner', 'admin'))
  WITH CHECK (public.get_user_role_in_active_org() IN ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- API tokens (hash only in DB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_omnichannel_api_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  label text NULL,
  web_id text NOT NULL,
  allowed_origins text[] NOT NULL DEFAULT '{}',
  whatsapp_invoice_template_name text NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NULL,
  last_used_at timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_omnichannel_api_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT organization_omnichannel_api_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT organization_omnichannel_api_tokens_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT organization_omnichannel_api_tokens_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_api_tokens_org
  ON public.organization_omnichannel_api_tokens (organization_id);

CREATE INDEX IF NOT EXISTS idx_omnichannel_api_tokens_prefix
  ON public.organization_omnichannel_api_tokens (token_prefix);

ALTER TABLE public.organization_omnichannel_api_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_omnichannel_api_tokens_select_admin ON public.organization_omnichannel_api_tokens;
CREATE POLICY organization_omnichannel_api_tokens_select_admin
  ON public.organization_omnichannel_api_tokens FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
    AND public.get_user_role_in_active_org() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS organization_omnichannel_api_tokens_mutate_admin ON public.organization_omnichannel_api_tokens;
CREATE POLICY organization_omnichannel_api_tokens_mutate_admin
  ON public.organization_omnichannel_api_tokens FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
    AND public.get_user_role_in_active_org() IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
    AND public.get_user_role_in_active_org() IN ('owner', 'admin')
  );

-- Rate limit counter (optional persistence)
CREATE TABLE IF NOT EXISTS public.organization_omnichannel_api_rate_limits (
  token_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  CONSTRAINT organization_omnichannel_api_rate_limits_pkey PRIMARY KEY (token_id, window_start),
  CONSTRAINT organization_omnichannel_api_rate_limits_token_id_fkey
    FOREIGN KEY (token_id) REFERENCES public.organization_omnichannel_api_tokens (id) ON DELETE CASCADE
);

ALTER TABLE public.organization_omnichannel_api_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only

-- ---------------------------------------------------------------------------
-- sales_invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  web_id text NOT NULL,
  lead_id uuid NULL,
  invoice_number text NOT NULL,
  amount numeric(18, 2) NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  whatsapp_status text NOT NULL DEFAULT 'pending',
  whatsapp_message_id text NULL,
  customer_phone text NULL,
  customer_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoices_pkey PRIMARY KEY (id),
  CONSTRAINT sales_invoices_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT sales_invoices_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE SET NULL,
  CONSTRAINT sales_invoices_org_invoice_number_key UNIQUE (organization_id, invoice_number),
  CONSTRAINT sales_invoices_whatsapp_status_check
    CHECK (whatsapp_status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text]))
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_org_created
  ON public.sales_invoices (organization_id, created_at DESC);

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_invoices_select_org ON public.sales_invoices;
CREATE POLICY sales_invoices_select_org
  ON public.sales_invoices FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- Ensure analytics_web_access row when token is created (called from edge function)
CREATE OR REPLACE FUNCTION public.ensure_analytics_web_access_for_org(
  p_organization_id uuid,
  p_web_id text,
  p_created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.analytics_web_access (organization_id, web_id, created_by, is_approved)
  VALUES (p_organization_id, lower(trim(p_web_id)), p_created_by, true)
  ON CONFLICT (organization_id, web_id) DO UPDATE SET
    is_approved = true;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_analytics_web_access_for_org(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_analytics_web_access_for_org(uuid, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Page permission: /omnichannel/settings/api-integration
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES (
  '/omnichannel/settings/api-integration',
  'Integrasi API Omnichannel',
  true,
  ARRAY['owner', 'admin']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/omnichannel/settings/api-integration'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
