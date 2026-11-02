-- Rollback perubahan keamanan 2 November 2026.
-- Bukan migration. Jalankan satu bagian di SQL Editor, jangan sekaligus,
-- kecuali urutan di komentar bagian A dan C memang diinginkan.
-- Setiap bagian diakhiri NOTIFY agar PostgREST membaca katalog baru.
-- service_role tidak dicabut di bagian A dan B: grant itu tidak dihapus hari ini.

-- ---------------------------------------------------------------------------
-- A. Kembalikan EXECUTE untuk anon
-- Pakai bila pemanggilan tanpa login harus bisa lagi, misalnya halaman publik
-- atau klien yang hanya memegang kunci anon.
-- Dampak: setiap signature di ops_private.anon_revoke_backup bisa dipanggil
-- role anon lagi. PUBLIC tidak dikembalikan. authenticated tidak diubah.
-- ---------------------------------------------------------------------------
DO $rollback_anon$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT b.sig
    FROM ops_private.anon_revoke_backup AS b
    WHERE b.sig IS NOT NULL
      AND btrim(b.sig) <> ''
    ORDER BY b.sig
  LOOP
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || r.sig || ' TO anon';
  END LOOP;
END
$rollback_anon$;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- B. Kembalikan EXECUTE untuk authenticated
-- Pakai bila pengguna yang sudah login harus bisa memanggil helper yang
-- hari ini dibatasi ke service_role.
-- Dampak: setiap signature di ops_private.auth_revoke_backup bisa dipanggil
-- role authenticated lagi. anon dan PUBLIC tidak dikembalikan di bagian ini.
-- ---------------------------------------------------------------------------
DO $rollback_auth$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT b.sig
    FROM ops_private.auth_revoke_backup AS b
    WHERE b.sig IS NOT NULL
      AND btrim(b.sig) <> ''
    ORDER BY b.sig
  LOOP
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || r.sig || ' TO authenticated';
  END LOOP;
END
$rollback_auth$;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- C. Lepas pembungkus __impl
-- Pakai bila cek organisasi di pembungkus harus dihilangkan dan badan
-- __impl harus kembali memakai nama asli.
-- Dampak: pembungkus di-DROP, lalu __impl di-rename ke nama tanpa akhiran
-- __impl. GRANT EXECUTE diberikan ke authenticated dan service_role.
-- anon dan PUBLIC tidak diberi GRANT. Cek "Not authorized" di pembungkus hilang.
-- Pada 2 November 2026 ada 25 pasang. Loop ini memakai katalog saat dijalankan,
-- jadi jumlahnya mengikuti fungsi public yang masih berakhiran __impl.
--
-- Bagian A memberi GRANT ke nama yang ada pada saat A dijalankan. Kalau A dan C
-- keduanya dipakai, jalankan C lebih dulu, lalu A, supaya GRANT anon menempel
-- pada fungsi yang sudah kembali ke nama asli.
-- ---------------------------------------------------------------------------
DO $rollback_impl$
DECLARE
  r record;
  v_base text;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname LIKE '%\_\_impl' ESCAPE '\'
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  LOOP
    v_base := left(r.proname, length(r.proname) - 6);
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', v_base, r.args);
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', r.proname, r.args, v_base);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
      v_base,
      r.args
    );
  END LOOP;
END
$rollback_impl$;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- D. Jam check-in kembali dari local_checkin_time
-- Pakai bila record_attendance_with_timezone harus lagi membaca jam yang
-- dikirim klien, bukan jam server.
-- Dampak: check_in_time, tanggal absensi, dan perhitungan terlambat mengikuti
-- teks local_checkin_time. Perangkat yang jamnya diubah ikut mengubah catatan.
-- Hak EXECUTE tidak diubah. Clock-out tidak disentuh.
-- ---------------------------------------------------------------------------
DO $rollback_checkin$
DECLARE
  v_def text;
  v_new text;
  v_ts_stmt text;
BEGIN
  v_def := pg_get_functiondef(
    'public.record_attendance_with_timezone(uuid,uuid,text,double precision,double precision,text,text,jsonb,text)'::regprocedure
  );

  IF v_def !~ 'v_local_ts[[:space:]]*:=' THEN
    RAISE EXCEPTION
      'Bagian D berhenti: penugasan v_local_ts tidak ada di record_attendance_with_timezone';
  END IF;

  v_new := regexp_replace(
    v_def,
    'v_local_ts[[:space:]]*:=[[:space:]]*[^;]+;',
    'v_local_ts := local_checkin_time::timestamp;'
  );

  v_ts_stmt := substring(v_new FROM E'\nv_ts[[:space:]]*:=[[:space:]]*[^;]+;');
  IF v_ts_stmt IS NOT NULL AND position('v_local_ts' IN v_ts_stmt) = 0 THEN
    v_new := regexp_replace(
      v_new,
      E'(\nv_ts[[:space:]]*:=[[:space:]]*)[^;]+;',
      E'\\1v_local_ts AT TIME ZONE timezone_param;'
    );
  END IF;

  IF v_new IS DISTINCT FROM v_def THEN
    EXECUTE v_new;
  END IF;
END
$rollback_checkin$;

NOTIFY pgrst, 'reload schema';
