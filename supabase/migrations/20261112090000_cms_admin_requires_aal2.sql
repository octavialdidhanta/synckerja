-- CMS data calls require a verified authenticator session.
-- Membership alone stays available so the login screen can open the shared TOTP challenge.

CREATE OR REPLACE FUNCTION public.auth_session_aal()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(auth.jwt() ->> 'aal', '');
$$;

COMMENT ON FUNCTION public.auth_session_aal() IS
  'Authenticator assurance level on the current request JWT. aal2 means the TOTP code was verified.';

REVOKE ALL ON FUNCTION public.auth_session_aal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_session_aal() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_cms_admin_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cms_admins admin
    WHERE admin.user_id = (SELECT auth.uid())
  );
$$;

COMMENT ON FUNCTION public.is_cms_admin_member() IS
  'True when the signed-in user is a CMS admin. Does not require 2FA. Returns no organization data.';

REVOKE ALL ON FUNCTION public.is_cms_admin_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_cms_admin_member() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_cms_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_session_aal() = 'aal2'
    AND public.is_cms_admin_member();
$$;

COMMENT ON FUNCTION public.is_cms_admin() IS
  'True when the signed-in CMS admin has verified the shared authenticator (aal2).';

NOTIFY pgrst, 'reload schema';
