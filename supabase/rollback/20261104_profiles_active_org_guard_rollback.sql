-- Rollback 20261104140000_profiles_active_org_guard.sql. Jalankan di SQL Editor.
-- Peringatan: membuka kembali celah ganti organisasi aktif ke org mana pun.
BEGIN;
DROP TRIGGER IF EXISTS profiles_enforce_active_org_membership ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_enforce_active_org_membership();
COMMIT;
