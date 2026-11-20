-- Hardening 4 November 2026: absensi (langkah 3).
-- Rollback: supabase/rollback/20261104_attendance_server_checkout_rollback.sql
--
-- Masalah:
-- 1) Clock-out ditulis langsung dari aplikasi (web: useSimpleAttendance,
--    useAttendanceOperations; Android: Absensi.tsx) memakai jam perangkat.
--    Durasi kerja juga dihitung di perangkat. Web menulis check_out_time dalam
--    UTC, padahal check_in_time dan payroll_calculate_overtime_pay memakai jam
--    lokal, sehingga lembur dari clock-out web ikut salah.
-- 2) Policy attendance_records_org_all_org_all (FOR ALL) membolehkan anggota
--    org mana pun mengubah absensi siapa pun di org-nya, kolom apa pun.
--    Diuji 4 Nov (BEGIN ... ROLLBACK): karyawan biasa berhasil mengubah
--    check_out_at dan working_hours_minutes absensi orang lain.
--
-- Perbaikan:
-- 1) record_attendance_checkout: jam dari server (now()), jam lokal sesuai
--    zona jadwal kerja (WIB/WITA/WIT), durasi dihitung server, hanya absensi
--    milik user itu sendiri yang masih terbuka (hari ini atau kemarin untuk
--    shift malam). Aturan foto check-out tetap dari load_attendance_rules.
-- 2) Policy dipecah: SELECT tetap untuk anggota org; INSERT/UPDATE/DELETE
--    langsung hanya owner/admin/hr. Karyawan menulis lewat RPC
--    (record_attendance_with_timezone, record_attendance_checkout).
--    Fungsi SECURITY DEFINER (auto checkout, kunjungan klien) tidak terpengaruh RLS.

CREATE OR REPLACE FUNCTION public.record_attendance_checkout(
  employee_id_param uuid,
  organization_id_param uuid,
  photo_path_param text DEFAULT NULL::text,
  location_data jsonb DEFAULT '{}'::jsonb,
  attendance_id_param uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rules record;
  v_tz text;
  v_today date;
  v_rec record;
  v_now timestamptz := now();
  v_check_in timestamptz;
  v_minutes integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = employee_id_param
      AND e.organization_id = organization_id_param
      AND e.user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to record attendance for this employee' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rules FROM public.load_attendance_rules(organization_id_param) r LIMIT 1;

  IF COALESCE(v_rules.require_photo_checkout, false)
     AND (photo_path_param IS NULL OR btrim(photo_path_param) = '') THEN
    RAISE EXCEPTION 'Photo is required for check-out per organization attendance rules';
  END IF;

  SELECT wss.timezone
  INTO v_tz
  FROM public.employees e
  LEFT JOIN public.work_schedule_settings wss
    ON wss.id = e.work_schedule_id
   AND wss.organization_id = organization_id_param
  WHERE e.id = employee_id_param
    AND e.organization_id = organization_id_param;

  v_tz := CASE WHEN v_tz IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura') THEN v_tz ELSE 'Asia/Jakarta' END;
  v_today := (timezone(v_tz, v_now))::date;

  SELECT ar.*
  INTO v_rec
  FROM public.attendance_records ar
  WHERE ar.employee_id = employee_id_param
    AND ar.organization_id = organization_id_param
    AND (attendance_id_param IS NULL OR ar.id = attendance_id_param)
    AND ar.attendance_date BETWEEN v_today - 1 AND v_today
    AND (ar.check_in_time IS NOT NULL OR ar.check_in_at IS NOT NULL)
    AND ar.check_out_time IS NULL
    AND ar.check_out_at IS NULL
  ORDER BY ar.attendance_date DESC, ar.check_in_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'No open check-in found to check out';
  END IF;

  v_check_in := COALESCE(
    v_rec.check_in_at,
    (v_rec.attendance_date + v_rec.check_in_time) AT TIME ZONE v_tz
  );
  v_minutes := GREATEST(0, floor(extract(epoch FROM (v_now - v_check_in)) / 60)::integer);

  UPDATE public.attendance_records
  SET check_out_at = v_now,
      check_out_time = (timezone(v_tz, v_now))::time,
      check_out_location = COALESCE(location_data, '{}'::jsonb),
      check_out_photo_path = NULLIF(btrim(photo_path_param), ''),
      working_hours_minutes = v_minutes
  WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'attendance_id', v_rec.id,
    'attendance_date', v_rec.attendance_date,
    'check_out_at', v_now,
    'check_out_time', (timezone(v_tz, v_now))::time,
    'working_hours_minutes', v_minutes,
    'timezone', v_tz
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_attendance_checkout(uuid, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_attendance_checkout(uuid, uuid, text, jsonb, uuid) TO authenticated, service_role;

-- Policy absensi.
-- Helper khusus untuk policy: hanya menjawab apakah pemanggil sendiri owner/admin/hr
-- di org itu. user_has_org_role sengaja tidak bisa dipanggil authenticated sejak 2 Nov.
CREATE OR REPLACE FUNCTION public.user_can_manage_attendance(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.organization_id = p_org
      AND lower(ur.role) IN ('owner', 'admin', 'hr')
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.user_can_manage_attendance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_attendance(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS attendance_records_org_all_org_all ON public.attendance_records;

CREATE POLICY attendance_records_select_org_members ON public.attendance_records
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY attendance_records_insert_hr ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_can_manage_attendance(organization_id)
  );

CREATE POLICY attendance_records_update_hr ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_can_manage_attendance(organization_id)
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_can_manage_attendance(organization_id)
  );

CREATE POLICY attendance_records_delete_hr ON public.attendance_records
  FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_can_manage_attendance(organization_id)
  );

NOTIFY pgrst, 'reload schema';
