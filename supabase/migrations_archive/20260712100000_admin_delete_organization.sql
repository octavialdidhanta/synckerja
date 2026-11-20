-- CMS admin: hard delete a single organization and all tenant rows.
-- Uses dynamic purge across every public base table with organization_id.
-- Auth user removal + storage cleanup handled by Edge Function admin-delete-organization.

CREATE TABLE IF NOT EXISTS public.cms_organization_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  company_name text NOT NULL,
  deleted_by uuid NOT NULL REFERENCES auth.users (id),
  reason text NOT NULL,
  confirm_name text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_users_to_delete uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cms_organization_deletions_created_at_idx
  ON public.cms_organization_deletions (created_at DESC);

CREATE INDEX IF NOT EXISTS cms_organization_deletions_org_id_idx
  ON public.cms_organization_deletions (organization_id);

COMMENT ON TABLE public.cms_organization_deletions IS
  'Permanent CMS audit when an organization is hard-deleted. No FK to organizations.';

ALTER TABLE public.cms_organization_deletions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._normalize_org_confirm_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(p_name));
$$;

CREATE OR REPLACE FUNCTION public._organization_has_cms_admin_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF to_regclass('public.cms_admins') IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    INNER JOIN public.cms_admins ca ON ca.user_id = uo.user_id
    WHERE uo.organization_id = p_organization_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public._collect_organization_auth_users_to_delete(p_organization_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_users uuid[];
BEGIN
  IF to_regclass('public.user_organizations') IS NULL THEN
    RETURN '{}'::uuid[];
  END IF;

  SELECT coalesce(array_agg(uo.user_id), '{}'::uuid[])
  INTO v_users
  FROM public.user_organizations uo
  WHERE uo.organization_id = p_organization_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_organizations uo2
      WHERE uo2.user_id = uo.user_id
        AND uo2.organization_id <> p_organization_id
    )
    AND (
      to_regclass('public.cms_admins') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.cms_admins ca WHERE ca.user_id = uo.user_id
      )
    );

  RETURN coalesce(v_users, '{}'::uuid[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public._count_organization_rows(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  r record;
  v_sql text;
  v_count bigint;
  v_result jsonb := '{}'::jsonb;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organization_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('organizations', 'cms_organization_deletions')
    ORDER BY c.table_name
  LOOP
    v_sql := format(
      'SELECT count(*)::bigint FROM public.%I WHERE organization_id = $1',
      r.table_name
    );
    EXECUTE v_sql INTO v_count USING p_organization_id;
    IF v_count > 0 THEN
      v_result := v_result || jsonb_build_object(r.table_name, v_count);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public._purge_organization_rows(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  r record;
  v_sql text;
  v_count bigint;
  v_deleted jsonb := '{}'::jsonb;
  v_prev_role text;
BEGIN
  v_prev_role := current_setting('session_replication_role', true);
  PERFORM set_config('session_replication_role', 'replica', true);

  BEGIN
    FOR r IN
      SELECT c.table_name
      FROM information_schema.columns c
      INNER JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
        AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'organization_id'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT IN ('organizations', 'cms_organization_deletions')
      ORDER BY c.table_name
    LOOP
      v_sql := format(
        'DELETE FROM public.%I WHERE organization_id = $1',
        r.table_name
      );
      EXECUTE v_sql;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN
        v_deleted := v_deleted || jsonb_build_object(r.table_name, v_count);
      END IF;
    END LOOP;

    DELETE FROM public.organizations
    WHERE id = p_organization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'organization row missing after purge' USING ERRCODE = 'P0002';
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted || jsonb_build_object('organizations', v_count);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('session_replication_role', coalesce(v_prev_role, 'origin'), true);
      RAISE;
  END;

  PERFORM set_config('session_replication_role', coalesce(v_prev_role, 'origin'), true);
  RETURN v_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_preview_organization_deletion(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_sub public.organization_subscriptions%ROWTYPE;
  v_table_counts jsonb;
  v_member_count bigint := 0;
  v_user_count bigint := 0;
  v_auth_delete_count int;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_sub FROM public.organization_subscriptions WHERE organization_id = p_organization_id;

  IF to_regclass('public.user_organizations') IS NOT NULL THEN
    SELECT count(*)::bigint INTO v_user_count
    FROM public.user_organizations
    WHERE organization_id = p_organization_id;
  END IF;

  IF to_regclass('public.employees') IS NOT NULL THEN
    SELECT count(*)::bigint INTO v_member_count
    FROM public.employees
    WHERE organization_id = p_organization_id;
  END IF;

  v_table_counts := public._count_organization_rows(p_organization_id);
  v_auth_delete_count := coalesce(
    cardinality(public._collect_organization_auth_users_to_delete(p_organization_id)),
    0
  );

  RETURN jsonb_build_object(
    'organization_id', v_org.id,
    'company_name', v_org.company_name,
    'email', v_org.email,
    'created_at', v_org.created_at,
    'subscription_status', v_sub.status,
    'is_trial', coalesce(v_sub.is_trial, false),
    'has_active_subscription', coalesce(v_org.has_active_subscription, false),
    'member_count', v_member_count,
    'user_count', v_user_count,
    'auth_users_to_delete', v_auth_delete_count,
    'table_counts', v_table_counts,
    'has_cms_admin_member', public._organization_has_cms_admin_member(p_organization_id),
    'confirm_phrase', 'hapus organisasi ini'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_organization(
  p_organization_id uuid,
  p_confirm_name text,
  p_confirm_phrase text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_sub public.organization_subscriptions%ROWTYPE;
  v_auth_users uuid[];
  v_deleted jsonb;
  v_snapshot jsonb;
  v_audit_id uuid;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason required (min 3 characters)' USING ERRCODE = '22023';
  END IF;

  IF public._normalize_org_confirm_name(p_confirm_phrase) <> 'hapus organisasi ini' THEN
    RAISE EXCEPTION 'invalid confirmation phrase' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  IF public._normalize_org_confirm_name(p_confirm_name)
    <> public._normalize_org_confirm_name(v_org.company_name) THEN
    RAISE EXCEPTION 'organization name does not match' USING ERRCODE = '22023';
  END IF;

  IF public._organization_has_cms_admin_member(p_organization_id) THEN
    RAISE EXCEPTION 'organization has cms admin members' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub FROM public.organization_subscriptions WHERE organization_id = p_organization_id;

  v_auth_users := public._collect_organization_auth_users_to_delete(p_organization_id);

  v_snapshot := jsonb_build_object(
    'organization', to_jsonb(v_org),
    'subscription', CASE WHEN v_sub.id IS NULL THEN NULL ELSE to_jsonb(v_sub) END
  );

  INSERT INTO public.cms_organization_deletions (
    organization_id,
    company_name,
    deleted_by,
    reason,
    confirm_name,
    snapshot,
    counts,
    auth_users_to_delete
  )
  VALUES (
    v_org.id,
    v_org.company_name,
    auth.uid(),
    trim(p_reason),
    trim(p_confirm_name),
    v_snapshot,
    '{}'::jsonb,
    v_auth_users
  )
  RETURNING id INTO v_audit_id;

  v_deleted := public._purge_organization_rows(p_organization_id);

  UPDATE public.cms_organization_deletions
  SET counts = v_deleted
  WHERE id = v_audit_id;

  RETURN jsonb_build_object(
    'audit_id', v_audit_id,
    'organization_id', p_organization_id,
    'company_name', v_org.company_name,
    'deleted_counts', v_deleted,
    'auth_users_to_delete', v_auth_users,
    'storage_prefix', p_organization_id::text
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_verify_organization_deleted(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  r record;
  v_sql text;
  v_count bigint;
  v_remaining jsonb := '{}'::jsonb;
  v_org_exists boolean;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_organization_id
  ) INTO v_org_exists;

  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organization_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('cms_organization_deletions')
    ORDER BY c.table_name
  LOOP
    v_sql := format(
      'SELECT count(*)::bigint FROM public.%I WHERE organization_id = $1',
      r.table_name
    );
    EXECUTE v_sql INTO v_count USING p_organization_id;
    IF v_count > 0 THEN
      v_remaining := v_remaining || jsonb_build_object(r.table_name, v_count);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'organization_exists', v_org_exists,
    'is_clean', (NOT v_org_exists) AND v_remaining = '{}'::jsonb,
    'remaining_counts', v_remaining
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_preview_organization_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_organization(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_organization_deleted(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_preview_organization_deletion(uuid) IS
  'CMS admin: preview row counts and auth impact before deleting an organization.';

COMMENT ON FUNCTION public.admin_delete_organization(uuid, text, text, text) IS
  'CMS admin: hard delete one organization, purge tenant rows, audit to cms_organization_deletions.';

COMMENT ON FUNCTION public.admin_verify_organization_deleted(uuid) IS
  'CMS admin: verify no organization_id rows remain after deletion.';
