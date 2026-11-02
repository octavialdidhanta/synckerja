-- Dry run rutinitas laporan kerja. Satu transaksi, diakhiri ROLLBACK. Jangan tambah COMMIT.
-- Butuh migration 20261103116000 sudah ada di database. Tidak memanggil dispatch, jadi tidak ada HTTP.
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
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_disabled uuid := gen_random_uuid();
  v_reviewer uuid := gen_random_uuid();
  v_routine uuid;
  v_disabled_routine uuid;
  v_claimed uuid;
  v_next timestamptz;
  v_kept timestamptz;
  v_sent timestamptz;
  v_summary jsonb;
  v_prepare jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'ai_employee_next_report_at'
  ) THEN
    RAISE EXCEPTION 'migration 20261103116000 belum diterapkan';
  END IF;

  IF public.ai_employee_next_routine_at('daily', NULL, time '09:00', 'Asia/Jakarta', '2026-11-02 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-02 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '08:59 WIB harus jatuh pada 09:00 hari yang sama';
  END IF;

  IF public.ai_employee_next_routine_at('daily', NULL, time '09:00', 'Asia/Jakarta', '2026-11-02 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-03 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat 09:00 WIB harus pindah ke hari berikutnya';
  END IF;

  IF public.ai_employee_next_routine_at('weekly', 5::smallint, time '09:00', 'Asia/Jakarta', '2026-11-06 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-06 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Jumat 08:59 WIB harus jatuh pada Jumat 09:00 yang sama';
  END IF;

  IF public.ai_employee_next_routine_at('weekly', 5::smallint, time '09:00', 'Asia/Jakarta', '2026-11-06 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-13 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Jumat 09:00 WIB harus pindah ke Jumat berikutnya';
  END IF;

  IF public.ai_employee_next_routine_at('mon_thu', NULL, time '09:00', 'Asia/Jakarta', '2026-11-04 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-04 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Rabu 08:59 WIB harus jatuh pada Rabu 09:00';
  END IF;

  IF public.ai_employee_next_routine_at('mon_thu', NULL, time '09:00', 'Asia/Jakarta', '2026-11-05 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-09 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Kamis 09:00 WIB harus pindah ke Senin';
  END IF;

  IF public.ai_employee_next_routine_at('mon_thu', NULL, time '09:00', 'Asia/Jakarta', '2026-11-06 01:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-09 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Jumat pagi harus pindah ke Senin';
  END IF;

  IF public.ai_employee_next_routine_at('days', NULL, time '09:00', 'Asia/Jakarta', '2026-11-06 01:00:00+00'::timestamptz, ARRAY[5]::smallint[])
     IS DISTINCT FROM '2026-11-06 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'hari Jumat yang dipilih harus tetap Jumat';
  END IF;

  IF public.ai_employee_next_routine_at('days', NULL, time '09:00', 'Asia/Jakarta', '2026-11-05 02:00:00+00'::timestamptz, ARRAY[1, 6]::smallint[])
     IS DISTINCT FROM '2026-11-07 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Kamis 09:00 harus pindah ke Sabtu bila Sabtu yang dipilih';
  END IF;

  IF public.ai_employee_next_routine_at('monthly', NULL, time '09:00', 'Asia/Jakarta', '2026-11-30 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-30 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '08:59 WIB pada tanggal terakhir harus jatuh pada 09:00 hari itu';
  END IF;

  IF public.ai_employee_next_routine_at('monthly', NULL, time '09:00', 'Asia/Jakarta', '2026-11-30 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-12-31 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat akhir November 09:00 WIB harus pindah ke 31 Desember';
  END IF;

  IF public.ai_employee_next_routine_at('monthly', NULL, time '09:00', 'Asia/Jakarta', '2027-02-28 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2027-03-31 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat 28 Februari 2027 09:00 WIB harus pindah ke 31 Maret';
  END IF;

  IF public.ai_employee_next_routine_at('daily', NULL, time '09:00', 'Not/AZone', '2026-11-02 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-02 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'zona tidak dikenal harus memakai Asia/Jakarta';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'routine-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_admin, 'routine-admin@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Routine Test', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner'), (v_admin, v_org, 'admin');

  INSERT INTO public.employees (id, organization_id, full_name, email, user_id, is_ai)
  VALUES
    (v_ai, v_org, 'Naya Uji', NULL, NULL, true),
    (v_disabled, v_org, 'Naya Mati', NULL, NULL, true),
    (v_reviewer, v_org, 'Reviewer Uji', NULL, v_owner, false);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, reviewer_employee_id, time_zone, is_active, performance_status
  ) VALUES
    (v_ai, v_org, v_reviewer, 'Asia/Jakarta', true, 'on_track'),
    (v_disabled, v_org, v_reviewer, 'Asia/Jakarta', true, 'disabled');

  BEGIN
    PERFORM public.ai_employee_routine_write(
      v_admin, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[1, 2, 5]
    );
    RAISE EXCEPTION 'admin harus ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_routine_write(
      v_owner, v_org, v_ai, 'hr.report', 'daily', NULL, time '09:00', true
    );
    RAISE EXCEPTION 'kode aksi asing harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[5, 1, 1]
  );

  SELECT id, next_run_at
  INTO v_routine, v_next
  FROM public.ai_employee_routines
  WHERE employee_id = v_ai
    AND action_code = 'work_report.daily';

  IF v_next IS NULL OR v_next <= clock_timestamp() THEN
    RAISE EXCEPTION 'rutinitas baru harus mendapat next_run_at di masa depan';
  END IF;

  IF (
    SELECT weekdays
    FROM public.ai_employee_routines
    WHERE id = v_routine
  ) IS DISTINCT FROM ARRAY[1, 5]::smallint[] THEN
    RAISE EXCEPTION 'hari harian harus tersimpan sesuai pilihan, tanpa dipaksa Senin–Kamis';
  END IF;

  BEGIN
    INSERT INTO public.ai_employee_routines (
      employee_id, organization_id, action_code, cadence, weekday, weekdays, time_local, is_active
    ) VALUES (
      v_ai, v_org, 'work_report.daily', 'days', NULL, ARRAY[1]::smallint[], time '08:00', true
    );
    RAISE EXCEPTION 'aksi yang sama tidak boleh punya dua baris';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_routine_write(
      v_owner, v_org, v_ai, 'work_report.email', 'weekly', 1, time '23:50', true
    );
    RAISE EXCEPTION 'kode lama work_report.email harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.weekly', 'weekly', 1, time '23:50', true
  );
  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.monthly', 'monthly', NULL, time '09:00', false
  );

  IF (
    SELECT weekday
    FROM public.ai_employee_routines
    WHERE employee_id = v_ai
      AND action_code = 'work_report.weekly'
  ) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'laporan mingguan harus menyimpan hari yang dikirim';
  END IF;

  IF (
    SELECT weekdays
    FROM public.ai_employee_routines
    WHERE employee_id = v_ai
      AND action_code = 'work_report.daily'
  ) IS DISTINCT FROM ARRAY[5]::smallint[] THEN
    RAISE EXCEPTION 'hari mingguan harus terbuang dari harian';
  END IF;

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.daily', 'days', NULL, ARRAY[1, 2]::smallint[], time '09:00', 'Asia/Jakarta', '2026-11-01 01:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-03 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'harian harus melewati hari mingguan';
  END IF;

  UPDATE public.ai_employee_routines
  SET is_active = true
  WHERE employee_id = v_ai
    AND action_code = 'work_report.monthly';

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.weekly', 'weekly', 1::smallint, '{}'::smallint[], time '23:50', 'Asia/Jakarta', '2026-11-23 16:50:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-12-07 16:50:00+00'::timestamptz THEN
    RAISE EXCEPTION 'mingguan pada tanggal terakhir harus pindah ke minggu berikutnya';
  END IF;

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.daily', 'days', NULL, ARRAY[1, 2]::smallint[], time '09:00', 'Asia/Jakarta', '2026-11-29 01:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-12-01 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'harian harus melewati tanggal terakhir';
  END IF;

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.monthly', 'monthly', NULL, '{}'::smallint[], time '09:00', 'Asia/Jakarta', '2026-11-01 00:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-30 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'bulanan tetap jatuh pada tanggal terakhir';
  END IF;

  UPDATE public.ai_employee_routines
  SET is_active = false
  WHERE employee_id = v_ai
    AND action_code = 'work_report.monthly';

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.weekly', 'weekly', 1::smallint, '{}'::smallint[], time '23:50', 'Asia/Jakarta', '2026-11-23 16:50:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-30 16:50:00+00'::timestamptz THEN
    RAISE EXCEPTION 'bulanan yang tidak aktif tidak boleh menahan mingguan';
  END IF;

  v_prepare := public.ai_employee_routine_prepare((
    SELECT id FROM public.ai_employee_routines
    WHERE employee_id = v_ai AND action_code = 'work_report.weekly'
  ));
  IF abs(extract(epoch FROM ((v_prepare->>'period_start')::timestamptz - (clock_timestamp() - interval '7 days')))) > 5 THEN
    RAISE EXCEPTION 'periode mingguan pertama harus tujuh hari';
  END IF;

  v_prepare := public.ai_employee_routine_prepare((
    SELECT id FROM public.ai_employee_routines
    WHERE employee_id = v_ai AND action_code = 'work_report.monthly'
  ));
  IF v_prepare->>'action_code' IS DISTINCT FROM 'work_report.monthly' THEN
    RAISE EXCEPTION 'prepare harus mengembalikan kode bulanan';
  END IF;
  IF abs(extract(epoch FROM (
    (v_prepare->>'period_start')::timestamptz
    - (date_trunc('month', timezone('Asia/Jakarta', clock_timestamp())) AT TIME ZONE 'Asia/Jakarta')
  ))) > 2 THEN
    RAISE EXCEPTION 'periode bulanan pertama harus awal bulan';
  END IF;

  INSERT INTO public.ai_employee_routines (
    employee_id, organization_id, action_code, cadence, weekday, time_local, is_active
  ) VALUES (
    v_disabled, v_org, 'work_report.weekly', 'weekly', 1, time '09:00', true
  )
  RETURNING id INTO v_disabled_routine;

  UPDATE public.ai_employee_routines
  SET next_run_at = clock_timestamp() - interval '1 minute'
  WHERE id IN (v_routine, v_disabled_routine);

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[1, 5]
  );

  UPDATE public.ai_employee_routines
  SET next_run_at = clock_timestamp() - interval '1 minute'
  WHERE id = v_routine;

  SELECT claimed.routine_id
  INTO v_claimed
  FROM public.ai_employee_claim_due_routines() AS claimed
  WHERE claimed.routine_id = v_routine;

  IF v_claimed IS NULL THEN
    RAISE EXCEPTION 'rutinitas jatuh tempo harus diklaim';
  END IF;

  SELECT next_run_at INTO v_kept
  FROM public.ai_employee_routines
  WHERE id = v_routine;

  IF v_kept IS NULL OR v_kept <= clock_timestamp() THEN
    RAISE EXCEPTION 'next_run_at yang sudah diklaim harus pindah ke masa depan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_claim_due_routines() AS claimed
    WHERE claimed.routine_id IN (v_routine, v_disabled_routine)
  ) THEN
    RAISE EXCEPTION 'klaim kedua tidak boleh mengambil baris yang sama, dan profil disabled tidak boleh diklaim';
  END IF;

  v_prepare := public.ai_employee_routine_prepare(v_routine);
  IF v_prepare->>'skip_reason' IS DISTINCT FROM 'reviewer_email_missing' THEN
    RAISE EXCEPTION 'reviewer tanpa email harus skipped, dapat %', v_prepare->>'skip_reason';
  END IF;
  IF abs(extract(epoch FROM (
    (v_prepare->>'period_start')::timestamptz
    - (date_trunc('day', timezone('Asia/Jakarta', clock_timestamp())) AT TIME ZONE 'Asia/Jakarta')
  ))) > 2 THEN
    RAISE EXCEPTION 'periode harian harus mulai tengah malam';
  END IF;
  IF v_prepare->>'sender_name' IS DISTINCT FROM 'Reviewer Uji' THEN
    RAISE EXCEPTION 'nama pengirim awal harus nama reviewer, dapat %', v_prepare->>'sender_name';
  END IF;

  UPDATE public.employees
  SET email = 'reviewer-uji@example.com'
  WHERE id = v_reviewer;

  INSERT INTO public.ai_employee_runs (
    employee_id, organization_id, sop_code, status, plan_count, started_at
  ) VALUES (
    v_ai, v_org, 'SOP1', 'succeeded', 2, clock_timestamp() - interval '1 second'
  );

  v_prepare := public.ai_employee_routine_prepare(v_routine);
  IF v_prepare->>'skip_reason' IS NOT NULL THEN
    RAISE EXCEPTION 'reviewer beremail tidak boleh dilewati';
  END IF;
  IF (v_prepare->'summary'->>'runs_succeeded')::integer <> 1
     OR (v_prepare->'summary'->>'plans_created')::integer <> 2 THEN
    RAISE EXCEPTION 'ringkasan harus menghitung run dan plan milik Naya';
  END IF;
  IF v_prepare->'summary' ? 'payroll_total' THEN
    RAISE EXCEPTION 'ringkasan tidak boleh memuat payroll';
  END IF;

  PERFORM public.ai_employee_routine_finish(
    v_routine,
    'skipped',
    (v_prepare->>'period_start')::timestamptz,
    (v_prepare->>'period_end')::timestamptz,
    '',
    v_prepare->'summary',
    'reviewer_email_missing'
  );

  SELECT last_sent_at INTO v_sent
  FROM public.ai_employee_routines
  WHERE id = v_routine;
  IF v_sent IS NOT NULL THEN
    RAISE EXCEPTION 'status skipped tidak boleh mengisi last_sent_at';
  END IF;

  PERFORM public.ai_employee_routine_finish(
    v_routine,
    'sent',
    (clock_timestamp() - interval '1 hour'),
    clock_timestamp(),
    'reviewer-uji@example.com',
    (v_prepare->'summary') || jsonb_build_object('payroll_total', 5000000),
    ''
  );

  SELECT last_sent_at, (
    SELECT summary
    FROM public.ai_employee_routine_deliveries delivery
    WHERE delivery.routine_id = v_routine
      AND delivery.status = 'sent'
    ORDER BY delivery.created_at DESC
    LIMIT 1
  )
  INTO v_sent, v_summary
  FROM public.ai_employee_routines
  WHERE id = v_routine;

  IF v_sent IS NULL THEN
    RAISE EXCEPTION 'status sent harus mengisi last_sent_at';
  END IF;
  IF v_summary ? 'payroll_total' THEN
    RAISE EXCEPTION 'delivery tidak boleh menyimpan payroll';
  END IF;
  IF (v_summary->>'plans_created')::integer <> 2 THEN
    RAISE EXCEPTION 'delivery harus menyimpan jumlah plan';
  END IF;

  SELECT next_run_at INTO v_next
  FROM public.ai_employee_routines
  WHERE id = v_routine;
  IF v_next IS DISTINCT FROM v_kept THEN
    RAISE EXCEPTION 'finish tidak boleh menggeser next_run_at';
  END IF;

  PERFORM public.ai_employee_report_copies_write(
    v_owner, v_org, v_ai, '  Extra@Client.test ', NULL
  );
  IF (
    SELECT profile.report_copy_email_1
    FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = v_ai
  ) IS DISTINCT FROM 'extra@client.test' THEN
    RAISE EXCEPTION 'email tambahan harus dinormalisasi';
  END IF;
  IF (
    SELECT profile.report_sender_user_id
    FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = v_ai
  ) IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'penyimpan email harus tercatat sebagai pengirim';
  END IF;

  BEGIN
    PERFORM public.ai_employee_report_copies_write(v_owner, v_org, v_ai, 'bukan-email', NULL);
    RAISE EXCEPTION 'email salah harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_report_copies_write(v_owner, v_org, v_ai, 'reviewer-uji@example.com', NULL);
    RAISE EXCEPTION 'email yang sama dengan penerima utama harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_report_copies_write(v_owner, v_org, v_ai, 'a@b.co', 'A@b.co');
    RAISE EXCEPTION 'dua email yang sama harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  UPDATE public.profiles
  SET full_name = 'Octa Uji'
  WHERE user_id = v_owner;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_owner, 'routine-owner-profile@example.com', 'Octa Uji');
  END IF;

  v_prepare := public.ai_employee_routine_prepare(v_routine);
  IF v_prepare->>'sender_name' IS DISTINCT FROM 'Octa Uji' THEN
    RAISE EXCEPTION 'nama pengirim harus nama profile, dapat %', v_prepare->>'sender_name';
  END IF;
  IF v_prepare->'copy_emails' IS DISTINCT FROM '["extra@client.test"]'::jsonb THEN
    RAISE EXCEPTION 'prepare harus mengembalikan email tambahan';
  END IF;

  INSERT INTO public.ai_employee_runs (
    employee_id, organization_id, sop_code, status, plan_count, started_at
  ) VALUES
    (v_ai, v_org, 'SOP1', 'succeeded', 1, '2026-11-29 02:00:00+00'::timestamptz),
    (v_ai, v_org, 'SOP1', 'succeeded', 4, '2026-11-30 02:00:00+00'::timestamptz);

  v_summary := public.ai_employee_routine_summary(
    v_ai,
    v_org,
    '2026-11-28 17:00:00+00'::timestamptz,
    '2026-11-30 17:00:00+00'::timestamptz,
    NULL::smallint,
    true,
    'Asia/Jakarta'
  );
  IF (v_summary->>'plans_created')::integer <> 1 OR (v_summary->>'runs_succeeded')::integer <> 1 THEN
    RAISE EXCEPTION 'tanggal terakhir harus keluar dari hitungan mingguan';
  END IF;

  v_summary := public.ai_employee_routine_summary(
    v_ai,
    v_org,
    '2026-11-28 17:00:00+00'::timestamptz,
    '2026-11-30 17:00:00+00'::timestamptz,
    1::smallint,
    false,
    'Asia/Jakarta'
  );
  IF (v_summary->>'plans_created')::integer <> 1 THEN
    RAISE EXCEPTION 'hari mingguan harus keluar dari hitungan harian';
  END IF;

  IF public.mcp_list_ai_employee_routines(v_owner, v_org, v_ai)::text LIKE '%@%' THEN
    RAISE EXCEPTION 'daftar MCP tidak boleh memuat alamat email';
  END IF;

  SELECT next_run_at INTO v_next
  FROM public.ai_employee_routines
  WHERE id = v_routine;

  PERFORM public.ai_employee_routine_finish(
    v_routine,
    'sent',
    (v_prepare->>'period_start')::timestamptz,
    (v_prepare->>'period_end')::timestamptz,
    'reviewer-uji@example.com',
    v_prepare->'summary',
    'Email tambahan 1 gagal'
  );
  IF (
    SELECT routine.last_error
    FROM public.ai_employee_routines routine
    WHERE routine.id = v_routine
  ) IS DISTINCT FROM 'Email tambahan 1 gagal' THEN
    RAISE EXCEPTION 'gagal pada email tambahan harus tercatat';
  END IF;
  IF (
    SELECT routine.last_sent_at
    FROM public.ai_employee_routines routine
    WHERE routine.id = v_routine
  ) IS NULL THEN
    RAISE EXCEPTION 'gagal pada email tambahan tidak boleh menghapus status terkirim';
  END IF;
  IF (
    SELECT routine.next_run_at
    FROM public.ai_employee_routines routine
    WHERE routine.id = v_routine
  ) IS DISTINCT FROM v_next THEN
    RAISE EXCEPTION 'catatan email tambahan tidak boleh menggeser next_run_at';
  END IF;

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[1]
  );
  IF (
    SELECT routine.is_active OR cardinality(routine.weekdays) <> 0
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = v_ai
      AND routine.action_code = 'work_report.daily'
  ) THEN
    RAISE EXCEPTION 'harian yang hanya berisi hari mingguan harus mati dan kosong';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.ai_employee_claim_due_routines()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh mengklaim rutinitas';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh menulis rutinitas langsung';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND has_function_privilege('anon', 'public.ai_employee_routine_prepare(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon tidak boleh menyiapkan laporan';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND NOT has_function_privilege('authenticated', 'public.ai_employee_page_report_copies_save(uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner halaman harus bisa menyimpan email tambahan';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.ai_employee_report_copies_write(uuid, uuid, uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh menulis email lewat fungsi internal';
  END IF;
END;
$test$;

ROLLBACK;
