-- Operational email notification settings + verified recipient list (v1: settings UI + verification; daily send = phase 2).

CREATE TABLE IF NOT EXISTS public.operational_email_notification_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  daily_sales_summary_enabled boolean NOT NULL DEFAULT true,
  inventory_alerts_enabled boolean NOT NULL DEFAULT true,
  promo_update_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_email_notification_settings_pkey PRIMARY KEY (organization_id)
);

CREATE TABLE IF NOT EXISTS public.operational_email_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verification_token uuid,
  verification_expires_at timestamptz,
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_email_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT operational_email_recipients_status_check CHECK (status IN ('pending', 'verified')),
  CONSTRAINT operational_email_recipients_email_check CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_operational_email_recipients_org_email
  ON public.operational_email_recipients (organization_id, lower(btrim(email)));

CREATE INDEX IF NOT EXISTS idx_operational_email_recipients_org
  ON public.operational_email_recipients (organization_id, created_at DESC);

ALTER TABLE public.operational_email_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_email_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operational_email_notification_settings_select" ON public.operational_email_notification_settings;
CREATE POLICY "operational_email_notification_settings_select"
  ON public.operational_email_notification_settings FOR SELECT TO authenticated
  USING (public.user_is_org_owner_or_admin(organization_id));

DROP POLICY IF EXISTS "operational_email_recipients_select" ON public.operational_email_recipients;
CREATE POLICY "operational_email_recipients_select"
  ON public.operational_email_recipients FOR SELECT TO authenticated
  USING (public.user_is_org_owner_or_admin(organization_id));

DROP TRIGGER IF EXISTS update_operational_email_notification_settings_updated_at
  ON public.operational_email_notification_settings;
CREATE TRIGGER update_operational_email_notification_settings_updated_at
  BEFORE UPDATE ON public.operational_email_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.operational_email_notification_settings IS
  'Org toggles for operational email reports. Daily send jobs are phase 2.';
COMMENT ON TABLE public.operational_email_recipients IS
  'Additional verified emails for inventory/daily alert notifications.';

-- ---------------------------------------------------------------------------
-- RPC: fetch or create default settings (owner/admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_operational_email_notification_settings(
  p_organization_id uuid
)
RETURNS public.operational_email_notification_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.operational_email_notification_settings;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row
  FROM public.operational_email_notification_settings s
  WHERE s.organization_id = p_organization_id;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.operational_email_notification_settings (organization_id)
  VALUES (p_organization_id)
  ON CONFLICT (organization_id) DO NOTHING
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row
    FROM public.operational_email_notification_settings s
    WHERE s.organization_id = p_organization_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_operational_email_notification_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_operational_email_notification_settings(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: upsert notification toggles (owner/admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_operational_email_notification_settings(
  p_organization_id uuid,
  p_daily_sales_summary_enabled boolean,
  p_inventory_alerts_enabled boolean,
  p_promo_update_enabled boolean
)
RETURNS public.operational_email_notification_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.operational_email_notification_settings;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.operational_email_notification_settings (
    organization_id,
    daily_sales_summary_enabled,
    inventory_alerts_enabled,
    promo_update_enabled
  )
  VALUES (
    p_organization_id,
    COALESCE(p_daily_sales_summary_enabled, true),
    COALESCE(p_inventory_alerts_enabled, true),
    COALESCE(p_promo_update_enabled, true)
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    daily_sales_summary_enabled = EXCLUDED.daily_sales_summary_enabled,
    inventory_alerts_enabled = EXCLUDED.inventory_alerts_enabled,
    promo_update_enabled = EXCLUDED.promo_update_enabled,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: add recipient + verification token (owner/admin, max 20)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_operational_email_recipient(
  p_organization_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_count integer;
  v_token uuid;
  v_row public.operational_email_recipients;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_email := lower(btrim(p_email));

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF v_email !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'email_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operational_email_recipients r
    WHERE r.organization_id = p_organization_id
      AND lower(btrim(r.email)) = v_email
  ) THEN
    RAISE EXCEPTION 'email_duplicate';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.operational_email_recipients r
  WHERE r.organization_id = p_organization_id;

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'recipient_limit_reached';
  END IF;

  v_token := gen_random_uuid();

  INSERT INTO public.operational_email_recipients (
    organization_id,
    email,
    status,
    verification_token,
    verification_expires_at,
    created_by
  )
  VALUES (
    p_organization_id,
    v_email,
    'pending',
    v_token,
    now() + interval '7 days',
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'email', v_row.email,
    'status', v_row.status,
    'verification_token', v_row.verification_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_operational_email_recipient(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_operational_email_recipient(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: delete pending recipient (owner/admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_operational_email_recipient(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.operational_email_recipients;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id_required';
  END IF;

  SELECT * INTO v_row
  FROM public.operational_email_recipients r
  WHERE r.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(v_row.organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'cannot_delete_verified';
  END IF;

  DELETE FROM public.operational_email_recipients WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_operational_email_recipient(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_operational_email_recipient(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: verify recipient via public link (anon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_operational_email_recipient(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.operational_email_recipients;
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'token_required';
  END IF;

  SELECT * INTO v_row
  FROM public.operational_email_recipients r
  WHERE r.verification_token = p_token
    AND r.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'token_invalid';
  END IF;

  IF v_row.verification_expires_at IS NOT NULL AND v_row.verification_expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  UPDATE public.operational_email_recipients
  SET
    status = 'verified',
    verified_at = now(),
    verification_token = NULL,
    verification_expires_at = NULL
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'email', v_row.email,
    'status', v_row.status,
    'verified_at', v_row.verified_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_operational_email_recipient(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_operational_email_recipient(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Page permission: owner + admin only
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
  '/operations/settings/email-notifications',
  'Operations — Settings — Email Notifications',
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
WHERE d.page_path = '/operations/settings/email-notifications'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
