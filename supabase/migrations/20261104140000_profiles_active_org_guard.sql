-- Hardening 4 November 2026 (langkah 5): organisasi aktif wajib organisasi milik user.
-- Rollback: supabase/rollback/20261104_profiles_active_org_guard_rollback.sql
--
-- Masalah: policy profiles_update_own membolehkan user mengubah kolom
-- active_organization_id ke organisasi mana pun. Banyak pengecekan memakai
-- organisasi aktif (can_access_web_id, list_pos_receipt_feedback,
-- crm_customer_survey_summary, get_instagram_conversations_with_preview,
-- mark_*_conversation_read, reply_pos_receipt_feedback, create_bank_transfer, …).
-- Diuji 4 Nov (BEGIN … ROLLBACK): user org lain mengganti organisasi aktif lalu
-- membaca traffic web, feedback POS, dan 17 percakapan Instagram org lain.
--
-- Perbaikan: trigger menolak perubahan active_organization_id oleh user login
-- (auth.role() = 'authenticated') bila user pemilik profil bukan anggota aktif
-- organisasi itu. NULL tetap boleh. service_role / SQL Editor tidak dibatasi.

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

REVOKE EXECUTE ON FUNCTION public.profiles_enforce_active_org_membership() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_enforce_active_org_membership ON public.profiles;
CREATE TRIGGER profiles_enforce_active_org_membership
  BEFORE INSERT OR UPDATE OF active_organization_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_enforce_active_org_membership();
