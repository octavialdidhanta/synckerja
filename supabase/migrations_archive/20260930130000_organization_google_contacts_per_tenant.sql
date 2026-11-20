-- Per-tenant Google Contacts (People API): OAuth, encrypted tokens, lead sync queue.

-- ---------------------------------------------------------------------------
-- OAuth CSRF state (short-lived)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_contacts_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  code_verifier text NOT NULL,
  return_path text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_contacts_oauth_states_state_token_key UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_google_contacts_oauth_states_expires
  ON public.google_contacts_oauth_states (expires_at);

ALTER TABLE public.google_contacts_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: service role only (Edge Functions).

-- ---------------------------------------------------------------------------
-- Connection metadata
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_contacts_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  google_account_email text NULL,
  is_active boolean NOT NULL DEFAULT false,
  oauth_connected_at timestamptz NULL,
  connected_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_google_contacts_connections_org_key UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_google_contacts_connections_org
  ON public.organization_google_contacts_connections (organization_id);

COMMENT ON TABLE public.organization_google_contacts_connections IS
  'Per-org Google Contacts connection metadata (no refresh token; see connection_tokens).';

DROP TRIGGER IF EXISTS update_organization_google_contacts_connections_updated_at
  ON public.organization_google_contacts_connections;
CREATE TRIGGER update_organization_google_contacts_connections_updated_at
  BEFORE UPDATE ON public.organization_google_contacts_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Encrypted tokens (service role / Edge only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_contacts_connection_tokens (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text NULL,
  access_token_expires_at timestamptz NULL,
  oauth_scopes text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_google_contacts_connection_tokens IS
  'Encrypted OAuth tokens per org for Google People/Contacts. Edge Functions only.';

ALTER TABLE public.organization_google_contacts_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_contacts_connection_tokens_deny
  ON public.organization_google_contacts_connection_tokens;
CREATE POLICY organization_google_contacts_connection_tokens_deny
  ON public.organization_google_contacts_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Lead ↔ Google Contact mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_google_contact_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  google_resource_name text NULL,
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  last_synced_at timestamptz NULL,
  last_error text NULL,
  last_phone_e164 text NULL,
  last_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_google_contact_links_org_lead_key UNIQUE (organization_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_google_contact_links_org_status
  ON public.lead_google_contact_links (organization_id, sync_status);

CREATE INDEX IF NOT EXISTS idx_lead_google_contact_links_resource
  ON public.lead_google_contact_links (google_resource_name)
  WHERE google_resource_name IS NOT NULL;

DROP TRIGGER IF EXISTS update_lead_google_contact_links_updated_at
  ON public.lead_google_contact_links;
CREATE TRIGGER update_lead_google_contact_links_updated_at
  BEFORE UPDATE ON public.lead_google_contact_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lead_google_contact_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_google_contact_links_select_org ON public.lead_google_contact_links;
CREATE POLICY lead_google_contact_links_select_org
  ON public.lead_google_contact_links
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

-- Writes via Edge (service role); admins may update status locally if needed.
DROP POLICY IF EXISTS lead_google_contact_links_admin_write ON public.lead_google_contact_links;
CREATE POLICY lead_google_contact_links_admin_write
  ON public.lead_google_contact_links
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Sync job queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_contacts_sync_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'create'
    CHECK (reason IN ('create', 'update', 'backfill')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  run_after timestamptz NOT NULL DEFAULT now(),
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_contacts_sync_jobs_claim
  ON public.google_contacts_sync_jobs (status, run_after)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_google_contacts_sync_jobs_org_lead
  ON public.google_contacts_sync_jobs (organization_id, lead_id);

ALTER TABLE public.google_contacts_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_contacts_sync_jobs_deny ON public.google_contacts_sync_jobs;
CREATE POLICY google_contacts_sync_jobs_deny
  ON public.google_contacts_sync_jobs
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_google_contacts_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_google_contacts_connections c
    INNER JOIN public.organization_google_contacts_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.is_google_contacts_connected(uuid) IS
  'True when org has active Google Contacts OAuth connection.';

GRANT EXECUTE ON FUNCTION public.is_google_contacts_connected(uuid) TO authenticated;

-- Enqueue sync job for a lead (idempotent pending merge).
CREATE OR REPLACE FUNCTION public.enqueue_google_contacts_sync(
  p_organization_id uuid,
  p_lead_id uuid,
  p_reason text DEFAULT 'update'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_reason text;
BEGIN
  IF p_organization_id IS NULL OR p_lead_id IS NULL THEN
    RETURN false;
  END IF;

  v_reason := CASE
    WHEN p_reason IN ('create', 'update', 'backfill') THEN p_reason
    ELSE 'update'
  END;

  IF NOT public.is_google_contacts_connected(p_organization_id) THEN
    RETURN false;
  END IF;

  SELECT nullif(btrim(coalesce(l.phone_number, '')), '') INTO v_phone
  FROM public.leads l
  WHERE l.id = p_lead_id
    AND l.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_phone IS NULL THEN
    SELECT nullif(btrim(coalesce(s.phone_number, '')), '') INTO v_phone
    FROM public.lead_submissions s
    WHERE s.lead_id = p_lead_id
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_phone IS NULL THEN
    INSERT INTO public.lead_google_contact_links (
      organization_id, lead_id, sync_status, last_error, updated_at
    )
    VALUES (
      p_organization_id, p_lead_id, 'skipped', 'missing_phone', now()
    )
    ON CONFLICT (organization_id, lead_id) DO UPDATE SET
      sync_status = CASE
        WHEN lead_google_contact_links.google_resource_name IS NOT NULL
          THEN lead_google_contact_links.sync_status
        ELSE 'skipped'
      END,
      last_error = CASE
        WHEN lead_google_contact_links.google_resource_name IS NOT NULL
          THEN lead_google_contact_links.last_error
        ELSE 'missing_phone'
      END,
      updated_at = now();
    RETURN false;
  END IF;

  INSERT INTO public.lead_google_contact_links (
    organization_id, lead_id, sync_status, updated_at
  )
  VALUES (p_organization_id, p_lead_id, 'pending', now())
  ON CONFLICT (organization_id, lead_id) DO UPDATE SET
    sync_status = CASE
      WHEN lead_google_contact_links.sync_status = 'synced' THEN 'pending'
      ELSE 'pending'
    END,
    last_error = NULL,
    updated_at = now();

  -- Avoid duplicate pending jobs for same lead.
  IF EXISTS (
    SELECT 1
    FROM public.google_contacts_sync_jobs j
    WHERE j.organization_id = p_organization_id
      AND j.lead_id = p_lead_id
      AND j.status IN ('pending', 'processing')
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.google_contacts_sync_jobs (
    organization_id, lead_id, reason, status, run_after
  )
  VALUES (
    p_organization_id, p_lead_id, v_reason, 'pending', now()
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_google_contacts_sync(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_google_contacts_sync(uuid, uuid, text) TO service_role;

-- Trigger: leads insert/update phone/email/client
CREATE OR REPLACE FUNCTION public.trg_enqueue_google_contacts_from_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_google_contacts_sync(NEW.organization_id, NEW.id, 'create');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.phone_number IS DISTINCT FROM OLD.phone_number
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.client IS DISTINCT FROM OLD.client THEN
      PERFORM public.enqueue_google_contacts_sync(NEW.organization_id, NEW.id, 'update');
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_enqueue_google_contacts ON public.leads;
CREATE TRIGGER trg_leads_enqueue_google_contacts
  AFTER INSERT OR UPDATE OF phone_number, email, client
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_google_contacts_from_leads();

-- Trigger: lead_submissions phone/email/name
CREATE OR REPLACE FUNCTION public.trg_enqueue_google_contacts_from_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.phone_number IS NOT DISTINCT FROM OLD.phone_number
       AND NEW.email IS NOT DISTINCT FROM OLD.email
       AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
      RETURN NEW;
    END IF;

    SELECT l.organization_id INTO v_org
    FROM public.leads l
    WHERE l.id = NEW.lead_id;

    IF v_org IS NOT NULL THEN
      PERFORM public.enqueue_google_contacts_sync(
        v_org,
        NEW.lead_id,
        CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_submissions_enqueue_google_contacts ON public.lead_submissions;
CREATE TRIGGER trg_lead_submissions_enqueue_google_contacts
  AFTER INSERT OR UPDATE OF phone_number, email, name
  ON public.lead_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_google_contacts_from_submissions();

-- Claim batch for Edge worker
CREATE OR REPLACE FUNCTION public.claim_google_contacts_sync_jobs(p_limit integer DEFAULT 25)
RETURNS SETOF public.google_contacts_sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.google_contacts_sync_jobs j
    WHERE j.status IN ('pending', 'failed')
      AND j.run_after <= now()
      AND j.attempts < 8
    ORDER BY j.run_after ASC, j.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.google_contacts_sync_jobs j
  SET status = 'processing',
      attempts = j.attempts + 1,
      updated_at = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_google_contacts_sync_jobs(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: connections
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_google_contacts_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_contacts_connections_select_org
  ON public.organization_google_contacts_connections;
CREATE POLICY organization_google_contacts_connections_select_org
  ON public.organization_google_contacts_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_google_contacts_connections_admin_write
  ON public.organization_google_contacts_connections;
CREATE POLICY organization_google_contacts_connections_admin_write
  ON public.organization_google_contacts_connections
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Page access
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
VALUES
  (
    '/omnichannel/settings/google-contacts',
    'Pengaturan Omnichannel — Google Contacts',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  )
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
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
WHERE d.page_path = '/omnichannel/settings/google-contacts'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

-- ---------------------------------------------------------------------------
-- pg_cron → Edge google-contacts-sync (every minute)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_google_contacts_sync_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := nullif(current_setting('app.settings.supabase_url', true), '');
  v_key := nullif(current_setting('app.settings.service_role_key', true), '');

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'google_contacts_scheduler_project_url'
    LIMIT 1;
  END IF;

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'google_ads_scheduler_project_url'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'google_contacts_scheduler_service_role_key'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'google_ads_scheduler_service_role_key'
    LIMIT 1;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE LOG 'invoke_google_contacts_sync_edge: missing Vault secrets (google_contacts_scheduler_* or google_ads_scheduler_*)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/google-contacts-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('action', 'processJobs'),
    timeout_milliseconds := 55000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_google_contacts_sync_edge() IS
  'POST google-contacts-sync every minute via pg_cron. Vault: google_contacts_scheduler_* (fallback google_ads_scheduler_*).';

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-contacts-sync') THEN
      PERFORM cron.unschedule('google-contacts-sync');
    END IF;

    PERFORM cron.schedule(
      'google-contacts-sync',
      '* * * * *',
      $cmd$SELECT public.invoke_google_contacts_sync_edge();$cmd$
    );
  END IF;
END
$cron$;
