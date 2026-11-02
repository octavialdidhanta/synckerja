-- Uji jadwal SOP1 pada database lokal yang sudah memakai migration
-- 20261103107000_ai_employee_sop1_schedule.sql.
-- Jangan jalankan pada project production.
--
-- psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/ai_employee_sop1_schedule.sql

BEGIN;

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
  v_org uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_disabled uuid := gen_random_uuid();
  v_schedule uuid;
  v_other uuid;
  v_asleep uuid;
  v_count integer;
  v_next timestamptz;
  v_kept timestamptz;
  v_dispatched integer;
BEGIN
  IF to_regprocedure('public.ai_employee_dispatch()') IS NULL THEN
    RAISE EXCEPTION 'migration 20261103107000 belum diterapkan';
  END IF;

  IF public.ai_employee_next_run_at(5::smallint, time '15:00', 'Asia/Jakarta'::text, '2026-11-06 07:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-06 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Jumat 14:59 WIB harus jatuh pada Jumat 15:00 yang sama';
  END IF;

  IF public.ai_employee_next_run_at(5::smallint, time '15:00', 'Asia/Jakarta'::text, '2026-11-06 08:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-13 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Jumat 15:00 WIB harus pindah ke Jumat berikutnya';
  END IF;

  IF public.ai_employee_next_run_at(5::smallint, time '15:00', 'Not/AZone'::text, '2026-11-02 03:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-06 08:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'zona tidak dikenal harus memakai Asia/Jakarta';
  END IF;

  IF public.ai_employee_next_run_at(1::smallint, time '08:00', 'Asia/Jakarta'::text, '2026-11-02 00:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-02 01:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Senin sebelum 08:00 WIB harus tetap Senin ini';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'sop1-schedule-owner@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'SOP1 Schedule Test', 'software', v_owner);

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_ai, v_org, 'Naya Uji', NULL, true),
    (v_disabled, v_org, 'Naya Mati', NULL, true);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, time_zone, is_active, performance_status
  ) VALUES
    (v_ai, v_org, 'Asia/Jakarta', true, 'on_track'),
    (v_disabled, v_org, 'Asia/Jakarta', true, 'disabled');

  BEGIN
    INSERT INTO public.ai_employee_schedules (
      employee_id, organization_id, sop_code, weekday, start_local, due_local, is_active
    ) VALUES (
      v_ai, v_org, 'SOP1', 5, time '17:00', time '15:00', true
    );
    RAISE EXCEPTION 'due sebelum start harus ditolak';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.ai_employee_schedules (
      employee_id, organization_id, sop_code, weekday, start_local, due_local, is_active
    ) VALUES (
      v_ai, v_org, 'SOP1', 5, time '15:00', time '15:00', true
    );
    RAISE EXCEPTION 'due sama dengan start harus ditolak';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local, is_active
  ) VALUES (
    v_ai, v_org, 'SOP1', 5, time '15:00', time '17:00', true
  )
  RETURNING id, next_run_at INTO v_schedule, v_next;

  IF v_next IS NULL OR v_next <= clock_timestamp() THEN
    RAISE EXCEPTION 'jadwal baru harus mendapat next_run_at di masa depan';
  END IF;

  UPDATE public.ai_employee_schedules
  SET due_local = time '16:30'
  WHERE id = v_schedule
  RETURNING next_run_at INTO v_kept;

  IF v_kept IS DISTINCT FROM v_next THEN
    RAISE EXCEPTION 'mengubah due_local tidak boleh memindahkan next_run_at';
  END IF;

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local, is_active
  ) VALUES
    (v_ai, v_org, 'SOP1', 5, time '15:00', time '17:00', true),
    (v_ai, v_org, 'SOP2', 5, time '15:00', time '17:00', true),
    (v_ai, v_org, 'SOP1', 5, time '15:00', time '17:00', false),
    (v_disabled, v_org, 'SOP1', 5, time '15:00', time '17:00', true);

  SELECT id INTO v_other
  FROM public.ai_employee_schedules
  WHERE employee_id = v_ai AND sop_code = 'SOP2';

  SELECT id INTO v_asleep
  FROM public.ai_employee_schedules
  WHERE employee_id = v_ai AND sop_code = 'SOP1' AND is_active IS FALSE;

  UPDATE public.ai_employee_schedules
  SET next_run_at = clock_timestamp() - interval '1 minute'
  WHERE employee_id IN (v_ai, v_disabled);

  SELECT count(*) INTO v_count FROM public.ai_employee_claim_due_schedules();
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'klaim harus mengambil 2 jadwal SOP1 aktif, dapat %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.ai_employee_claim_due_schedules();
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'klaim kedua tidak boleh mengambil jadwal yang sama';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_schedules
    WHERE id IN (
      SELECT id FROM public.ai_employee_schedules
      WHERE employee_id = v_ai AND sop_code = 'SOP1' AND is_active
    )
      AND next_run_at <= clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'next_run_at yang sudah diklaim harus pindah ke masa depan';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ai_employee_schedules
    WHERE id = v_other AND next_run_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'SOP2 tidak boleh diklaim';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ai_employee_schedules
    WHERE id = v_asleep AND next_run_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'jadwal nonaktif tidak boleh diklaim';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_schedules
    WHERE employee_id = v_disabled
      AND next_run_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'profil disabled tidak boleh diklaim';
  END IF;

  SELECT next_run_at INTO v_kept
  FROM public.ai_employee_schedules
  WHERE id = v_schedule;

  SELECT public.ai_employee_dispatch() INTO v_dispatched;
  IF v_dispatched <> 0 THEN
    RAISE EXCEPTION 'dispatch tanpa jadwal jatuh tempo harus 0, dapat %', v_dispatched;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ai_employee_schedules
    WHERE id = v_schedule AND next_run_at IS DISTINCT FROM v_kept
  ) THEN
    RAISE EXCEPTION 'dispatch tanpa jatuh tempo tidak boleh mengubah next_run_at';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND has_function_privilege('anon', 'public.ai_employee_dispatch()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon tidak boleh menjalankan dispatch';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.ai_employee_claim_due_schedules()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh mengklaim jadwal';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     AND has_function_privilege('service_role', 'public.ai_employee_dispatch()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role tidak boleh menjalankan dispatch';
  END IF;

  IF has_column_privilege('authenticated', 'public.ai_employee_schedules', 'next_run_at', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh mengubah next_run_at';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.ai_employee_schedules', 'weekday', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated harus tetap bisa mengubah weekday';
  END IF;
END
$test$;

ROLLBACK;
