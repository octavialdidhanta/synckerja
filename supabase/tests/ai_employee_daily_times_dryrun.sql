-- Dry run jadwal Harian per jam dan Generate sekarang.
-- Satu transaksi, diakhiri ROLLBACK. Butuh migration 20261111090000.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION pg_temp.insert_auth_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_names text[] := ARRAY[
    'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
    'email_confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
    'created_at', 'updated_at', 'confirmation_token', 'recovery_token',
    'email_change_token_new', 'email_change', 'is_sso_user', 'is_anonymous'
  ];
  v_name text;
  v_cols text[] := ARRAY[]::text[];
  v_vals text[] := ARRAY[]::text[];
  v_value text;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = v_name
        AND COALESCE(is_generated, 'NEVER') = 'NEVER'
    ) THEN
      v_value := CASE v_name
        WHEN 'instance_id' THEN quote_literal('00000000-0000-0000-0000-000000000000')
        WHEN 'id' THEN quote_literal(p_id::text)
        WHEN 'aud' THEN quote_literal('authenticated')
        WHEN 'role' THEN quote_literal('authenticated')
        WHEN 'email' THEN quote_literal(p_email)
        WHEN 'encrypted_password' THEN quote_literal('test-not-a-real-password')
        WHEN 'email_confirmed_at' THEN 'now()'
        WHEN 'raw_app_meta_data' THEN quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'
        WHEN 'raw_user_meta_data' THEN quote_literal('{}') || '::jsonb'
        WHEN 'created_at' THEN 'now()'
        WHEN 'updated_at' THEN 'now()'
        WHEN 'confirmation_token' THEN quote_literal('')
        WHEN 'recovery_token' THEN quote_literal('')
        WHEN 'email_change_token_new' THEN quote_literal('')
        WHEN 'email_change' THEN quote_literal('')
        WHEN 'is_sso_user' THEN 'false'
        WHEN 'is_anonymous' THEN 'false'
      END;
      v_cols := v_cols || quote_ident(v_name);
      v_vals := v_vals || v_value;
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO auth.users (%s) VALUES (%s)',
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', ')
  );
END;
$fn$;

DO $test$
DECLARE
  v_org uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_days uuid;
  v_weekly uuid;
  v_next timestamptz;
  v_kept timestamptz;
  v_run uuid;
  v_claimed_days integer;
  v_claimed_weekly integer;
  v_message text;
BEGIN
  IF to_regprocedure('public.ai_employee_start_times_ok(time[])') IS NULL
    OR to_regprocedure('public.ai_employee_sop1_manual_begin(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'migration 20261111090000 belum diterapkan';
  END IF;

  IF public.ai_employee_start_times_ok(ARRAY['09:00', '10:00']::time[]) IS NOT TRUE THEN
    RAISE EXCEPTION 'jarak 60 menit harus lolos';
  END IF;
  IF public.ai_employee_start_times_ok(ARRAY['09:00', '09:59']::time[]) IS NOT FALSE THEN
    RAISE EXCEPTION 'jarak 59 menit harus ditolak';
  END IF;
  IF public.ai_employee_start_times_ok(ARRAY['23:30', '00:10']::time[]) IS NOT FALSE THEN
    RAISE EXCEPTION 'jarak melewati tengah malam di bawah 60 menit harus ditolak';
  END IF;
  IF public.ai_employee_start_times_ok(ARRAY['09:00', '09:00']::time[]) IS NOT FALSE THEN
    RAISE EXCEPTION 'jam dobel harus ditolak';
  END IF;

  IF has_function_privilege('ai_employee_runner', 'public.ai_employee_sop1_manual_begin(uuid, uuid)', 'EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION 'runner harus bisa memanggil Generate sekarang';
  END IF;
  IF has_function_privilege('anon', 'public.ai_employee_sop1_manual_begin(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon tidak boleh memanggil Generate sekarang';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'jadwal-jam-uji@example.com');
  PERFORM pg_temp.insert_auth_user(v_stranger, 'jadwal-jam-bukan-owner@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Uji Jadwal Jam', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner');

  INSERT INTO public.employees (id, organization_id, full_name, email, user_id, is_ai)
  VALUES (v_ai, v_org, 'Naya Jam', NULL, NULL, true);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, time_zone, is_active, performance_status
  ) VALUES (v_ai, v_org, 'Asia/Jakarta', true, 'on_track');

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local,
    is_active, cadence, weekdays, plan_count, start_times
  ) VALUES (
    v_ai, v_org, 'SOP1', NULL, time '09:00', time '09:00', true, 'days',
    ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[], 1,
    ARRAY['09:00', '15:00', '20:00']::time[]
  ) RETURNING id INTO v_days;

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local,
    is_active, cadence, weekdays, plan_count, start_times
  ) VALUES (
    v_ai, v_org, 'SOP1', 1, time '09:00', time '09:00', true, 'weekly',
    ARRAY[]::smallint[], 1, ARRAY['09:00']::time[]
  ) RETURNING id INTO v_weekly;

  v_next := public.ai_employee_next_content_at(
    v_ai, v_org, 'days', NULL, ARRAY[3]::smallint[], time '09:00', 'Asia/Jakarta',
    '2026-11-11 01:00:00+00'::timestamptz
  );
  IF v_next IS DISTINCT FROM '2026-11-11 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '08:00 WIB harus jatuh pada 09:00, dapat %', v_next;
  END IF;

  v_next := public.ai_employee_next_content_at(
    v_ai, v_org, 'days', NULL, ARRAY[3]::smallint[], time '09:00', 'Asia/Jakarta',
    '2026-11-11 09:00:00+00'::timestamptz
  );
  IF v_next IS DISTINCT FROM '2026-11-11 13:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '16:00 WIB harus melewati 09:00 dan 15:00 lalu jatuh pada 20:00, dapat %', v_next;
  END IF;

  UPDATE public.ai_employee_schedules
  SET next_run_at = clock_timestamp() + interval '1 day'
  WHERE next_run_at <= clock_timestamp()
    AND id <> v_days;

  UPDATE public.ai_employee_schedules
  SET next_run_at = clock_timestamp() - interval '1 minute'
  WHERE id IN (v_days, v_weekly);

  SELECT schedule.next_run_at INTO v_kept
  FROM public.ai_employee_schedules schedule
  WHERE schedule.id = v_weekly;

  SELECT
    count(*) FILTER (WHERE claimed.schedule_id = v_days),
    count(*) FILTER (WHERE claimed.schedule_id = v_weekly)
  INTO v_claimed_days, v_claimed_weekly
  FROM public.ai_employee_claim_due_schedules() AS claimed
  WHERE claimed.employee_id = v_ai;

  IF v_claimed_days IS DISTINCT FROM 1 OR v_claimed_weekly IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'klaim harus mengambil Harian saja, dapat harian % mingguan %', v_claimed_days, v_claimed_weekly;
  END IF;

  IF (
    SELECT schedule.next_run_at
    FROM public.ai_employee_schedules schedule
    WHERE schedule.id = v_weekly
  ) IS DISTINCT FROM v_kept THEN
    RAISE EXCEPTION 'klaim tidak boleh menggeser jadwal mingguan';
  END IF;

  UPDATE public.ai_employee_schedules
  SET next_run_at = clock_timestamp() + interval '2 hours'
  WHERE id = v_days
  RETURNING next_run_at INTO v_kept;

  v_run := public.ai_employee_sop1_manual_begin(v_owner, v_ai);
  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Generate sekarang harus mengembalikan run';
  END IF;
  IF (
    SELECT schedule.next_run_at
    FROM public.ai_employee_schedules schedule
    WHERE schedule.id = v_days
  ) IS DISTINCT FROM v_kept THEN
    RAISE EXCEPTION 'Generate sekarang tidak boleh menggeser next_run_at';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_runs run
    WHERE run.id = v_run
      AND run.status = 'running'
      AND run.note = 'manual'
      AND run.sop_code = 'SOP1'
  ) THEN
    RAISE EXCEPTION 'run Generate sekarang harus SOP1 running dengan catatan manual';
  END IF;

  BEGIN
    PERFORM public.ai_employee_sop1_manual_begin(v_owner, v_ai);
    RAISE EXCEPTION 'run yang masih berjalan harus ditolak';
  EXCEPTION
    WHEN data_exception THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message NOT LIKE '%too_soon%' THEN
        RAISE;
      END IF;
  END;

  UPDATE public.ai_employee_runs
  SET status = 'succeeded',
      finished_at = clock_timestamp()
  WHERE id = v_run;

  UPDATE public.ai_employee_schedules
  SET next_run_at = clock_timestamp() + interval '30 minutes'
  WHERE id = v_days
  RETURNING next_run_at INTO v_kept;

  v_run := public.ai_employee_sop1_manual_begin(v_owner, v_ai);
  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Generate sekarang harus tetap jalan setelah plan sebelumnya selesai';
  END IF;

  IF (
    SELECT schedule.next_run_at
    FROM public.ai_employee_schedules schedule
    WHERE schedule.id = v_days
  ) IS DISTINCT FROM v_kept THEN
    RAISE EXCEPTION 'Generate sekarang tidak boleh menggeser next_run_at';
  END IF;

  BEGIN
    PERFORM public.ai_employee_sop1_manual_begin(v_stranger, v_ai);
    RAISE EXCEPTION 'bukan owner harus ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message NOT LIKE '%forbidden%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.ai_employee_schedule_write(
      v_owner, v_org, v_ai, 'SOP1', 'days', NULL, ARRAY[3]::smallint[],
      time '09:00', 1, ARRAY['09:00', '09:30']::time[], true
    );
    RAISE EXCEPTION 'jarak 30 menit lewat simpan harus ditolak';
  EXCEPTION
    WHEN data_exception THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message NOT LIKE '%times_too_close%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.ai_employee_schedule_write(
      v_owner, v_org, v_ai, 'SOP1', 'weekly', 1, NULL,
      time '09:00', 1, ARRAY['09:00']::time[], true
    );
    RAISE EXCEPTION 'SOP1 mingguan harus ditolak';
  EXCEPTION
    WHEN data_exception THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message NOT LIKE '%invalid_input%' THEN
        RAISE;
      END IF;
  END;
END;
$test$;

ROLLBACK;
