-- Security Advisor hardening (subset aligned with repo + remote CMS/storage):
-- 1) Mutable search_path on traffic / analytics helpers and trigger fn
-- 2) SECURITY DEFINER: revoke EXECUTE from PUBLIC/anon; grant authenticated + service_role
-- 3) Public buckets: keep public object GET, block storage.object.list / list_v2 for anonymous listing

-- ---------------------------------------------------------------------------
-- 1) search_path (mitigate search_path hijacking)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'touch_updated_at' AND p.pronargs = 0
  ) THEN
    ALTER FUNCTION public.touch_updated_at() SET search_path = public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'can_access_web_id' AND p.pronargs = 1
  ) THEN
    ALTER FUNCTION public.can_access_web_id(text) SET search_path = public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'list_accessible_web_ids' AND p.pronargs = 0
  ) THEN
    ALTER FUNCTION public.list_accessible_web_ids() SET search_path = public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'active_ms_hist_bucket_idx' AND p.pronargs = 1
  ) THEN
    ALTER FUNCTION public.active_ms_hist_bucket_idx(bigint) SET search_path = public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'active_ms_percentile_from_hist' AND p.pronargs = 2
  ) THEN
    ALTER FUNCTION public.active_ms_percentile_from_hist(bigint[], double precision) SET search_path = public;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'traffic_path_key' AND p.pronargs = 1
  ) THEN
    ALTER FUNCTION public.traffic_path_key(text) SET search_path = public;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) SECURITY DEFINER: do not allow anonymous / PUBLIC execute
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.accept_ownership_transfer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_ownership_transfer(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(uuid) TO service_role;

REVOKE ALL ON FUNCTION public._task_step_history_org_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._task_step_history_org_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._task_step_history_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._task_step_history_org_id(uuid) TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'admin_blog_post_page_view_totals'
      AND pg_get_function_identity_arguments(p.oid) = 'p_web_id text'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.admin_blog_post_page_view_totals(text) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.admin_blog_post_page_view_totals(text) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_blog_post_page_view_totals(text) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_blog_post_page_view_totals(text) TO service_role';
  END IF;
END;
$$;

-- If a public marketing site must call view totals without a session, grant EXECUTE to `anon`
-- explicitly after reviewing exposure (advisor will flag anon + DEFINER again).

-- ---------------------------------------------------------------------------
-- 3) Storage: public buckets — block object listing for unauthenticated callers
--    (still allow get_public / render for known URLs). Authenticated keeps full SELECT.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "whatsapp_media_public_read" ON storage.objects;

CREATE POLICY "whatsapp_media_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      (SELECT auth.role()) = 'authenticated'
      OR NOT storage.allow_any_operation(ARRAY[
        'storage.object.list',
        'storage.object.list_v2'
      ])
    )
  );

DROP POLICY IF EXISTS "agency_package_media_public_read" ON storage.objects;

CREATE POLICY "agency_package_media_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'agency-package-media'
    AND (
      (SELECT auth.role()) = 'authenticated'
      OR NOT storage.allow_any_operation(ARRAY[
        'storage.object.list',
        'storage.object.list_v2'
      ])
    )
  );
