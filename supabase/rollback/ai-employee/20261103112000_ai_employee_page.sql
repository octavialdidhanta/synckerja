-- Rollback halaman karyawan AI. Hanya menghapus fungsi 20261103112000.
-- Brief, jadwal, antrean, cron, dan tabel tidak diubah.

DROP FUNCTION IF EXISTS public.ai_employee_page_brief_save(uuid, jsonb);
DROP FUNCTION IF EXISTS public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean);
DROP FUNCTION IF EXISTS public.ai_employee_page_read(uuid);
DROP FUNCTION IF EXISTS public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean);
DROP FUNCTION IF EXISTS public.ai_employee_page_gate(uuid, boolean);
