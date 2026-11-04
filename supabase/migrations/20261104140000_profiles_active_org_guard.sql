-- Penjaga organisasi aktif pada profiles.
-- Production sudah mencatat versi 20261104140000 dengan statement kosong.
-- File ini menyalin fungsi dan trigger yang hidup, supaya database baru
-- dan repo sama. Jangan jalankan ulang di production yang sudah punya versi ini.
-- Menjalankan ulang tetap aman: CREATE OR REPLACE dan DROP TRIGGER IF EXISTS.
-- Rollback: supabase/rollback/20261104_profiles_active_org_guard_rollback.sql

CREATE OR REPLACE FUNCTION public.profiles_enforce_active_org_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.active_organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.active_organization_id IS NOT DISTINCT FROM OLD.active_organization_id THEN
    RETURN NEW;
  END IF;
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = NEW.user_id
      AND uo.organization_id = NEW.active_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'active_organization_not_member'
      USING ERRCODE = '42501',
            DETAIL = 'active_organization_id must be an organization the user belongs to.';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.profiles_enforce_active_org_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_enforce_active_org_membership() TO service_role;

DROP TRIGGER IF EXISTS profiles_enforce_active_org_membership ON public.profiles;
CREATE TRIGGER profiles_enforce_active_org_membership
  BEFORE INSERT OR UPDATE OF active_organization_id
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_active_org_membership();
