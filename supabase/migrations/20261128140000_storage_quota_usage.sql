-- Storage P2/P3: storage used per organization, quota per plan, upload blocked when full.
-- Approved by the owner on 28 Nov 2026:
--   self-service plans: Start Up 2 GB, Scale Up 10 GB, Enterprise 50 GB; sales tenants (subscription_self_service_enabled = false) 5 GB;
--   at 100% new uploads are refused; the Office warns when 50 MB or less is left.
-- No file is moved: the owning organization is read from the path (org folder, conversation, task, step, employee,
-- candidate, uploader). Measured before: about 98% of 3,500 files resolve; the rest are files of deleted chats/tasks.
-- Edge functions use the service role and are not blocked (customer WhatsApp media keeps arriving).

-- Quotas ------------------------------------------------------------------------------------------------------

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS storage_quota_mb integer;
COMMENT ON COLUMN public.subscription_plans.storage_quota_mb IS 'Storage quota in MB for self-service organizations on this plan.';

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS storage_quota_mb_override integer;
COMMENT ON COLUMN public.organization_subscriptions.storage_quota_mb_override IS 'Storage quota in MB for this organization, replacing the plan or sales default.';

UPDATE public.subscription_plans SET storage_quota_mb = 2048 WHERE name = 'Start Up Plan' AND storage_quota_mb IS NULL;
UPDATE public.subscription_plans SET storage_quota_mb = 10240 WHERE name = 'Scale Up Plan' AND storage_quota_mb IS NULL;
UPDATE public.subscription_plans SET storage_quota_mb = 51200 WHERE name = 'Enterprise Plan' AND storage_quota_mb IS NULL;

CREATE OR REPLACE FUNCTION public.storage_quota_bytes(p_organization_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (COALESCE(
    os.storage_quota_mb_override,
    CASE WHEN COALESCE(o.subscription_self_service_enabled, true) = false THEN 5120 END,
    sp.storage_quota_mb,
    2048
  ))::bigint * 1024 * 1024
  FROM public.organizations o
  LEFT JOIN public.organization_subscriptions os ON os.organization_id = o.id
  LEFT JOIN public.subscription_plans sp ON sp.id = os.subscription_plan_id
  WHERE o.id = p_organization_id
  LIMIT 1;
$$;

-- Owner of one object -----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_object_org_id(p_bucket text, p_name text, p_owner uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  f text[] := storage.foldername(p_name);
  v_org uuid;
  v_conv text;
BEGIN
  IF p_bucket IN ('blog-media', 'package-media', 'agency-package-media') THEN
    RETURN NULL; -- platform content, not a tenant
  END IF;

  IF p_bucket = 'whatsapp-media' THEN
    IF f[1] IN ('ig', 'fb') THEN
      v_conv := CASE WHEN f[2] = 'inbound' THEN f[3] ELSE f[2] END;
      IF f[1] = 'ig' THEN
        SELECT c.organization_id INTO v_org FROM public.instagram_conversations c WHERE c.id::text = v_conv;
      ELSE
        SELECT c.organization_id INTO v_org FROM public.facebook_conversations c WHERE c.id::text = v_conv;
      END IF;
    ELSE
      v_conv := CASE WHEN f[1] = 'inbound' THEN f[2] ELSE f[1] END;
      SELECT c.organization_id INTO v_org FROM public.whatsapp_conversations c WHERE c.id::text = v_conv;
    END IF;
  ELSIF p_bucket = 'task-files' THEN
    IF f[1] = 'task-files' THEN
      SELECT dt.organization_id INTO v_org FROM public.daily_tasks dt WHERE dt.id::text = f[2];
    ELSIF f[1] = 'task-step-description-images' AND f[2] LIKE 'org-%' THEN
      SELECT o.id INTO v_org FROM public.organizations o WHERE o.id::text = substring(f[2] FROM 5);
    ELSE
      SELECT dt.organization_id INTO v_org
      FROM public.task_steps ts JOIN public.daily_tasks dt ON dt.id = ts.task_id
      WHERE ts.id::text = CASE WHEN f[1] IN ('task-step-files', 'task-step-description-images') THEN f[2] ELSE f[1] END;
    END IF;
  ELSIF p_bucket = 'company-profiles' THEN
    SELECT o.id INTO v_org FROM public.organizations o WHERE o.id::text = substring(p_name FROM 1 FOR 36);
  ELSIF p_bucket = 'attendance-photos' THEN
    SELECT e.organization_id INTO v_org FROM public.employees e WHERE e.id::text = f[1];
  ELSIF p_bucket = 'employee-documents' THEN
    IF f[1] IN ('asset-handover', 'company-assets') THEN
      SELECT o.id INTO v_org FROM public.organizations o WHERE o.id::text = f[2];
    ELSE
      SELECT e.organization_id INTO v_org FROM public.employees e WHERE e.id::text = f[1];
    END IF;
  ELSIF p_bucket = 'recruitment-files' THEN
    SELECT c.organization_id INTO v_org FROM public.candidate_profiles c WHERE c.id::text = f[1];
    IF v_org IS NULL THEN
      SELECT ja.organization_id INTO v_org FROM public.job_applications ja WHERE ja.cv_file_path = p_name LIMIT 1;
    END IF;
  ELSE
    SELECT o.id INTO v_org FROM public.organizations o WHERE o.id::text = f[1];
    IF v_org IS NULL THEN
      SELECT o.id INTO v_org FROM public.organizations o WHERE o.id::text = f[2];
    END IF;
  END IF;

  -- Folder named after a user (profile photos, older receipts), else whoever uploaded it.
  IF v_org IS NULL THEN
    SELECT p.active_organization_id INTO v_org FROM public.profiles p WHERE p.user_id::text = f[1];
  END IF;
  IF v_org IS NULL AND p_owner IS NOT NULL THEN
    SELECT p.active_organization_id INTO v_org FROM public.profiles p WHERE p.user_id = p_owner;
  END IF;
  RETURN v_org;
END;
$$;

-- Usage snapshot ----------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.storage_org_usage (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  used_bytes bigint NOT NULL DEFAULT 0,
  file_count integer NOT NULL DEFAULT 0,
  by_bucket jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.storage_org_usage IS 'Storage used per organization (refreshed every 10 minutes by pg_cron; read refreshes a row older than 15 minutes). Read through get_storage_usage().';
ALTER TABLE public.storage_org_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_org_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_storage_org_usage(p_organization_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  WITH resolved AS (
    SELECT public.storage_object_org_id(o.bucket_id, o.name, o.owner) AS org,
           o.bucket_id,
           COALESCE((o.metadata ->> 'size')::bigint, 0) AS size
    FROM storage.objects o
  ),
  per_bucket AS (
    SELECT org, bucket_id, sum(size) AS bytes, count(*) AS files
    FROM resolved
    WHERE org IS NOT NULL AND (p_organization_id IS NULL OR org = p_organization_id)
    GROUP BY org, bucket_id
  ),
  per_org AS (
    SELECT org,
           sum(bytes)::bigint AS used_bytes,
           sum(files)::integer AS file_count,
           jsonb_agg(jsonb_build_object('bucket', bucket_id, 'bytes', bytes, 'files', files) ORDER BY bytes DESC) AS by_bucket
    FROM per_bucket
    GROUP BY org
  ),
  targets AS (
    SELECT o.id FROM public.organizations o WHERE p_organization_id IS NULL OR o.id = p_organization_id
  )
  INSERT INTO public.storage_org_usage (organization_id, used_bytes, file_count, by_bucket, updated_at)
  SELECT t.id, COALESCE(p.used_bytes, 0), COALESCE(p.file_count, 0), COALESCE(p.by_bucket, '[]'::jsonb), now()
  FROM targets t
  LEFT JOIN per_org p ON p.org = t.id
  ON CONFLICT (organization_id) DO UPDATE SET
    used_bytes = EXCLUDED.used_bytes,
    file_count = EXCLUDED.file_count,
    by_bucket = EXCLUDED.by_bucket,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Read for the active organization ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_storage_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.storage_active_organization_id();
  v_row public.storage_org_usage%ROWTYPE;
  v_quota bigint;
  v_warn bigint := 50 * 1024 * 1024;
BEGIN
  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = (SELECT auth.uid()) AND uo.organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.storage_org_usage WHERE organization_id = v_org;
  IF NOT FOUND OR v_row.updated_at < now() - interval '15 minutes' THEN
    PERFORM public.refresh_storage_org_usage(v_org);
    SELECT * INTO v_row FROM public.storage_org_usage WHERE organization_id = v_org;
  END IF;

  v_quota := public.storage_quota_bytes(v_org);
  RETURN jsonb_build_object(
    'organization_id', v_org,
    'used_bytes', COALESCE(v_row.used_bytes, 0),
    'quota_bytes', v_quota,
    'remaining_bytes', GREATEST(v_quota - COALESCE(v_row.used_bytes, 0), 0),
    'file_count', COALESCE(v_row.file_count, 0),
    'by_bucket', COALESCE(v_row.by_bucket, '[]'::jsonb),
    'status', CASE
      WHEN COALESCE(v_row.used_bytes, 0) >= v_quota THEN 'full'
      WHEN v_quota - COALESCE(v_row.used_bytes, 0) <= v_warn THEN 'warning'
      ELSE 'ok'
    END,
    'warn_remaining_bytes', v_warn,
    'updated_at', v_row.updated_at
  );
END;
$$;

-- Block uploads when full -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_upload_allowed(p_bucket text, p_name text, p_owner uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_used bigint;
BEGIN
  v_org := public.storage_object_org_id(p_bucket, p_name, COALESCE(p_owner, (SELECT auth.uid())));
  IF v_org IS NULL THEN
    RETURN true;
  END IF;
  SELECT u.used_bytes INTO v_used FROM public.storage_org_usage u WHERE u.organization_id = v_org;
  RETURN COALESCE(v_used, 0) < COALESCE(public.storage_quota_bytes(v_org), 2147483648);
EXCEPTION WHEN OTHERS THEN
  RETURN true; -- never break uploads because of the quota check itself
END;
$$;

DROP POLICY IF EXISTS storage_quota_block_insert ON storage.objects;
CREATE POLICY storage_quota_block_insert
  ON storage.objects
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (public.storage_upload_allowed(bucket_id, name, owner));

-- Grants ------------------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.storage_quota_bytes(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_object_org_id(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_storage_org_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_storage_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_upload_allowed(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_upload_allowed(text, text, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.storage_quota_bytes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.storage_object_org_id(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_storage_org_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_usage() TO service_role;

-- First snapshot and a refresh every 10 minutes ---------------------------------------------------------------

SELECT public.refresh_storage_org_usage(NULL);

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'storage-org-usage-refresh') THEN
      PERFORM cron.unschedule('storage-org-usage-refresh');
    END IF;
    PERFORM cron.schedule('storage-org-usage-refresh', '*/10 * * * *', 'SELECT public.refresh_storage_org_usage(NULL)');
  END IF;
END
$cron$;
