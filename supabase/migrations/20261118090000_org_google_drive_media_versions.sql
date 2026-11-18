-- Organization Google Drive ("gudang org") + versioned content plan media.
--
-- One Google Drive account per organization (connected once by owner/admin).
-- Videos for a content plan are uploaded into "<root>/<plan short id> <title>/vN.ext" in that Drive,
-- by employees from the browser or by an AI through the Synckerja MCP server.
-- The ACTIVE version is always the one whose Drive file matches social_media_plans.google_drive_link,
-- so there is no separate "active" flag that could drift from the plan.

-- ---------------------------------------------------------------------------
-- OAuth CSRF state (short-lived, Edge Functions only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_drive_org_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL UNIQUE,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_drive_org_oauth_states_expires
  ON public.google_drive_org_oauth_states (expires_at);

ALTER TABLE public.google_drive_org_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- ---------------------------------------------------------------------------
-- Connection metadata (readable by members of the active org)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_drive_connections (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  google_account_email text NULL,
  is_active boolean NOT NULL DEFAULT false,
  root_folder_id text NULL,
  oauth_connected_at timestamptz NULL,
  connected_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_google_drive_connections IS
  'Per-org Google Drive used to store content plan videos. Tokens live in organization_google_drive_connection_tokens.';

DROP TRIGGER IF EXISTS update_organization_google_drive_connections_updated_at
  ON public.organization_google_drive_connections;
CREATE TRIGGER update_organization_google_drive_connections_updated_at
  BEFORE UPDATE ON public.organization_google_drive_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_google_drive_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_drive_connections_select_org
  ON public.organization_google_drive_connections;
CREATE POLICY organization_google_drive_connections_select_org
  ON public.organization_google_drive_connections
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
-- No write policies: changes go through google-drive-org-* Edge Functions.

-- ---------------------------------------------------------------------------
-- Encrypted tokens (service role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_drive_connection_tokens (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text NULL,
  access_token_expires_at timestamptz NULL,
  oauth_scopes text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_google_drive_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_drive_connection_tokens_deny
  ON public.organization_google_drive_connection_tokens;
CREATE POLICY organization_google_drive_connection_tokens_deny
  ON public.organization_google_drive_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- One Drive subfolder per content plan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_plan_drive_folders (
  social_media_plan_id uuid NOT NULL PRIMARY KEY REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  drive_folder_id text NOT NULL,
  folder_name text NOT NULL,
  google_account_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_plan_drive_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_plan_drive_folders_select_org ON public.content_plan_drive_folders;
CREATE POLICY content_plan_drive_folders_select_org
  ON public.content_plan_drive_folders
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

-- ---------------------------------------------------------------------------
-- Uploaded versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_plan_media_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'ready', 'failed')),
  drive_file_id text NULL,
  drive_folder_id text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mcp')),
  uploaded_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  google_account_email text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT content_plan_media_versions_plan_version_key UNIQUE (social_media_plan_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_plan_media_versions_drive_file
  ON public.content_plan_media_versions (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_plan_media_versions_plan
  ON public.content_plan_media_versions (social_media_plan_id, version_no DESC);

COMMENT ON TABLE public.content_plan_media_versions IS
  'Each video uploaded for a content plan into the org Google Drive. Active version = file of social_media_plans.google_drive_link.';

ALTER TABLE public.content_plan_media_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_plan_media_versions_select_org ON public.content_plan_media_versions;
CREATE POLICY content_plan_media_versions_select_org
  ON public.content_plan_media_versions
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
-- No write policies: rows are written by content-plan-media-upload only.

-- ---------------------------------------------------------------------------
-- Upload tickets for AI uploads through the MCP server (service role only).
-- Only the SHA-256 of the ticket is stored; the Google resumable URL never leaves the server.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_plan_media_upload_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_hash text NOT NULL UNIQUE,
  version_id uuid NOT NULL REFERENCES public.content_plan_media_versions (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  google_upload_url text NOT NULL,
  total_bytes bigint NOT NULL CHECK (total_bytes > 0),
  received_bytes bigint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_plan_media_upload_tickets_expires
  ON public.content_plan_media_upload_tickets (expires_at);

ALTER TABLE public.content_plan_media_upload_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_plan_media_upload_tickets_deny ON public.content_plan_media_upload_tickets;
CREATE POLICY content_plan_media_upload_tickets_deny
  ON public.content_plan_media_upload_tickets
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Same rule as the Office "Prod approved" column (useProdApprovalAccess):
-- approval_access_configurations(prod_approved) when active, otherwise owner/admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_approve_content_production(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_employee uuid;
  v_config public.approval_access_configurations%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RETURN false;
  END IF;

  SELECT ur.role INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id AND ur.organization_id = p_organization_id
  LIMIT 1;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT e.id INTO v_employee
  FROM public.employees e
  WHERE e.user_id = p_user_id AND e.organization_id = p_organization_id
  ORDER BY e.id
  LIMIT 1;

  SELECT c.* INTO v_config
  FROM public.approval_access_configurations c
  WHERE c.organization_id = p_organization_id
    AND c.column_type = 'prod_approved'
    AND c.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN v_role IN ('owner', 'admin');
  END IF;

  RETURN (v_role = ANY (COALESCE(v_config.allowed_roles, ARRAY[]::text[])))
    OR (v_employee IS NOT NULL AND v_employee::text = ANY (COALESCE(v_config.exceptions, ARRAY[]::text[])));
END;
$function$;

REVOKE ALL ON FUNCTION public.can_approve_content_production(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_approve_content_production(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Switch the plan to another uploaded version while production stays approved.
-- Only production approvers. Pending schedules either follow the new video or are cancelled.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_content_plan_media_version(
  p_user_id uuid,
  p_version_id uuid,
  p_new_link text,
  p_move_schedules boolean
)
RETURNS TABLE(
  social_media_plan_id uuid,
  google_drive_link text,
  moved_schedules integer,
  cancelled_schedules integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_version public.content_plan_media_versions%ROWTYPE;
  v_plan public.social_media_plans%ROWTYPE;
  v_moved integer := 0;
  v_cancelled integer := 0;
BEGIN
  SELECT * INTO v_version FROM public.content_plan_media_versions WHERE id = p_version_id;
  IF NOT FOUND OR v_version.status <> 'ready' OR v_version.drive_file_id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_approve_content_production(p_user_id, v_version.organization_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_new_link IS NULL OR position(v_version.drive_file_id IN p_new_link) = 0 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan
  FROM public.social_media_plans
  WHERE id = v_version.social_media_plan_id
    AND organization_id = v_version.organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.social_media_plans
  SET google_drive_link = p_new_link,
      updated_at = now()
  WHERE id = v_plan.id;

  IF p_move_schedules THEN
    UPDATE public.social_media_scheduled_posts sp
    SET media_url_snapshot = p_new_link,
        media_resolved_url = NULL,
        updated_at = now()
    WHERE sp.social_media_plan_id = v_plan.id
      AND sp.status = 'pending';
    GET DIAGNOSTICS v_moved = ROW_COUNT;
  ELSE
    v_cancelled := public.cancel_social_media_scheduled_posts_for_plan(v_plan.id, 'google_drive_link_changed');
  END IF;

  social_media_plan_id := v_plan.id;
  google_drive_link := p_new_link;
  moved_schedules := v_moved;
  cancelled_schedules := v_cancelled;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_content_plan_media_version(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_content_plan_media_version(uuid, uuid, text, boolean) TO service_role;
