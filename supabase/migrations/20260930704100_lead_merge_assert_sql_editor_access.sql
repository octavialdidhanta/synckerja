-- Allow Supabase SQL Editor (postgres/supabase_admin) to run lead merge dry_run/execute.
CREATE OR REPLACE FUNCTION public._lead_merge_assert_org_access(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_session text;
  v_current text;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required' USING ERRCODE = 'P0001';
  END IF;

  -- Dashboard SQL Editor / migrations run as DB owner, not JWT service_role.
  v_session := session_user;
  v_current := current_user;
  IF v_session IN ('postgres', 'supabase_admin')
     OR v_current IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  v_role := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  IF v_role = 'service_role' THEN
    RETURN;
  END IF;
  IF p_organization_id IN (SELECT public.user_organization_ids()) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public._lead_merge_assert_org_access(uuid) FROM PUBLIC;
