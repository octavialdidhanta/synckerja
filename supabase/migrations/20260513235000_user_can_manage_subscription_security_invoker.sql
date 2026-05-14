-- Security Advisor lint 0029: user_can_manage_subscription only reads user_roles rows for auth.uid().
-- SECURITY INVOKER is sufficient (same visibility as direct SELECT under user_roles RLS) and removes
-- "Signed-In Users Can Execute SECURITY DEFINER" for this helper while keeping payments policies valid.
-- Runs before 20260513240000_security_definer_revoke_authenticated_internal.sql (must not be DEFINER
-- when that migration revokes authenticated on remaining DEFINER RPCs).

CREATE OR REPLACE FUNCTION public.user_can_manage_subscription(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.organization_id = p_org_id
      AND lower(trim(ur.role)) IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_manage_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_subscription(uuid) TO service_role;
