-- Rollback 20261104120000_attendance_server_checkout.sql.
-- Bukan migration. Jalankan di SQL Editor.
-- Mengembalikan policy FOR ALL lama (anggota org boleh menulis semua absensi org).
-- Fungsi record_attendance_checkout sengaja tidak dihapus di bagian A, karena
-- aplikasi versi baru memanggilnya; hapus di bagian B hanya bila aplikasi
-- juga dikembalikan ke versi sebelum PR ini.

-- A. Kembalikan policy lama
BEGIN;
DROP POLICY IF EXISTS attendance_records_select_org_members ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_insert_hr ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_update_hr ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_delete_hr ON public.attendance_records;
CREATE POLICY attendance_records_org_all_org_all ON public.attendance_records
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
DROP FUNCTION IF EXISTS public.user_can_manage_attendance(uuid);
COMMIT;
NOTIFY pgrst, 'reload schema';

-- B. (Opsional) hapus RPC check-out
-- DROP FUNCTION IF EXISTS public.record_attendance_checkout(uuid, uuid, text, jsonb, uuid);
-- NOTIFY pgrst, 'reload schema';
