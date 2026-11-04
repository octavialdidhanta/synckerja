-- Dry run jadwal Content Plan. Satu transaksi, diakhiri ROLLBACK.
-- Butuh migration 20261104200000. Tidak memanggil dispatch dan tidak membuat draf.
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
  v_ai uuid := gen_random_uuid();
  v_next timestamptz;
BEGIN
  IF to_regprocedure('public.ai_employee_next_content_at(uuid, uuid, text, smallint, smallint[], time, text, timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'migration 20261104200000 belum diterapkan';
  END IF;

  IF public.ai_employee_next_content_at(
    '00000000-0000-4000-8000-000000000099'::uuid,
    '00000000-0000-4000-8000-000000000098'::uuid,
    'weekly', 5::smallint, NULL, time '15:00', 'Asia/Jakarta',
    '2026-11-04 07:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-06 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Rabu 14:00 WIB harus jatuh pada Jumat 15:00';
  END IF;

  IF public.ai_employee_next_content_at(
    '00000000-0000-4000-8000-000000000099'::uuid,
    '00000000-0000-4000-8000-000000000098'::uuid,
    'weekly', 5::smallint, NULL, time '15:00', 'Asia/Jakarta',
    '2026-11-06 08:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-13 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Jumat 15:00 WIB harus pindah ke Jumat berikutnya';
  END IF;

  IF public.ai_employee_next_content_at(
    '00000000-0000-4000-8000-000000000099'::uuid,
    '00000000-0000-4000-8000-000000000098'::uuid,
    'days', NULL, ARRAY[]::smallint[], time '15:00', 'Asia/Jakarta',
    '2026-11-04 07:00:00+00'::timestamptz
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'harian tanpa hari harus kosong';
  END IF;

  IF public.ai_employee_next_content_at(
    '00000000-0000-4000-8000-000000000099'::uuid,
    '00000000-0000-4000-8000-000000000098'::uuid,
    'monthly', NULL, NULL, time '15:00', 'Asia/Jakarta',
    '2026-11-30 07:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-30 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '14:00 WIB pada tanggal terakhir harus jatuh pada 15:00 hari itu';
  END IF;

  IF public.ai_employee_next_content_at(
    '00000000-0000-4000-8000-000000000099'::uuid,
    '00000000-0000-4000-8000-000000000098'::uuid,
    'monthly', NULL, NULL, time '15:00', 'Asia/Jakarta',
    '2026-11-30 08:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-12-31 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat akhir November 15:00 WIB harus pindah ke 31 Desember 15:00';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'jadwal-konten-uji@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Uji Jadwal Konten', 'software', v_owner);

  INSERT INTO public.employees (id, organization_id, full_name, email, user_id, is_ai)
  VALUES (v_ai, v_org, 'Naya Jadwal', NULL, NULL, true);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, time_zone, is_active, performance_status
  ) VALUES (v_ai, v_org, 'Asia/Jakarta', true, 'on_track');

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local,
    is_active, cadence, weekdays, plan_count
  ) VALUES
    (v_ai, v_org, 'SOP1', NULL, time '15:00', time '15:00', true, 'days', ARRAY[2, 3, 4]::smallint[], 1),
    (v_ai, v_org, 'SOP1', 1, time '15:00', time '15:00', true, 'weekly', ARRAY[]::smallint[], 1),
    (v_ai, v_org, 'SOP1', NULL, time '15:00', time '15:00', true, 'monthly', ARRAY[]::smallint[], 1);

  v_next := public.ai_employee_next_content_at(
    v_ai, v_org, 'days', NULL, ARRAY[2, 3, 4]::smallint[], time '15:00', 'Asia/Jakarta',
    '2026-11-04 07:00:00+00'::timestamptz
  );
  IF v_next IS DISTINCT FROM '2026-11-04 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Rabu 14:00 WIB harian harus jatuh pada Rabu 15:00, dapat %', v_next;
  END IF;

  v_next := public.ai_employee_next_content_at(
    v_ai, v_org, 'days', NULL, ARRAY[2, 3, 4]::smallint[], time '15:00', 'Asia/Jakarta',
    '2026-11-05 08:00:00+00'::timestamptz
  );
  IF v_next IS DISTINCT FROM '2026-11-10 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Kamis 15:00 harus melewati hari mingguan, dapat %', v_next;
  END IF;

  v_next := public.ai_employee_next_content_at(
    v_ai, v_org, 'weekly', 1::smallint, NULL, time '15:00', 'Asia/Jakarta',
    '2026-11-23 08:00:00+00'::timestamptz
  );
  IF v_next IS DISTINCT FROM '2026-12-07 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Senin mingguan harus melewati tanggal terakhir, dapat %', v_next;
  END IF;

  UPDATE public.ai_employee_schedules
  SET is_active = false
  WHERE employee_id = v_ai
    AND cadence = 'monthly';

  v_next := public.ai_employee_next_content_at(
    v_ai, v_org, 'weekly', 1::smallint, NULL, time '15:00', 'Asia/Jakarta',
    '2026-11-23 08:00:00+00'::timestamptz
  );
  IF v_next IS DISTINCT FROM '2026-11-30 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tanggal terakhir boleh dipakai mingguan bila bulanan mati, dapat %', v_next;
  END IF;

  UPDATE public.ai_employee_schedules
  SET is_active = true
  WHERE employee_id = v_ai
    AND cadence = 'monthly';

  v_next := public.ai_employee_next_content_at(
    v_ai, v_org, 'days', NULL, ARRAY[4]::smallint[], time '15:00', 'Asia/Jakarta',
    '2026-12-30 08:00:00+00'::timestamptz
  );
  IF v_next IS DISTINCT FROM '2027-01-07 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'harian harus melewati 31 Desember, dapat %', v_next;
  END IF;
END;
$test$;

ROLLBACK;
