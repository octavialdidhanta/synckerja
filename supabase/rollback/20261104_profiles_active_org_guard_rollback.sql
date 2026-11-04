-- Rollback 20261104140000_profiles_active_org_guard.sql.
-- Bukan migration. Jalankan di SQL Editor bila trigger ini harus dilepas.
-- User authenticated lagi bisa mengisi active_organization_id di luar keanggotaannya.

BEGIN;

DROP TRIGGER IF EXISTS profiles_enforce_active_org_membership ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_enforce_active_org_membership();

COMMIT;
