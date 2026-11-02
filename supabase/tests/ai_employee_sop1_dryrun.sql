-- Uji migration jadwal SOP1 di SQL Editor production.
-- Satu transaksi. ROLLBACK di akhir mengembalikan semuanya, termasuk baris cron
-- yang sempat ditulis di dalam transaksi ini.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Jadwal SOP1: next_run_at, klaim atomik, dan satu cron tiap menit.
-- Cron memanggil ai-employee-run hanya setelah ada jadwal yang berhasil diklaim.
-- Rahasia ada di Vault (ai_employee_project_url, ai_employee_internal_secret), bukan di file ini.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.ai_employee_schedules
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz;

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_due_after_start;

ALTER TABLE public.ai_employee_schedules
  ADD CONSTRAINT ai_employee_schedules_due_after_start
  CHECK (due_local > start_local);

CREATE INDEX IF NOT EXISTS ai_employee_schedules_due_idx
  ON public.ai_employee_schedules (next_run_at)
  WHERE is_active AND next_run_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ai_employee_next_run_at(
  p_weekday smallint,
  p_start time,
  p_time_zone text,
  p_after timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(p_time_zone), ''), 'Asia/Jakarta');
  v_local timestamp;
  v_dow integer;
  v_delta integer;
  v_candidate timestamp;
BEGIN
  IF p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7 OR p_start IS NULL OR p_after IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  v_local := timezone(v_zone, p_after);
  v_dow := EXTRACT(ISODOW FROM v_local)::integer;
  v_delta := (p_weekday - v_dow + 7) % 7;
  v_candidate := date_trunc('day', v_local) + make_interval(days => v_delta) + p_start;
  IF v_candidate <= v_local THEN
    v_candidate := v_candidate + interval '7 days';
  END IF;

  RETURN v_candidate AT TIME ZONE v_zone;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_next_run_at(smallint, time, text, timestamptz) IS
  'Kejadian weekday+start berikutnya yang benar-benar setelah p_after, di zona waktu profil. Zona tidak dikenal jatuh ke Asia/Jakarta.';

CREATE OR REPLACE FUNCTION public.ai_employee_schedules_set_next_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.next_run_at IS NOT NULL
     AND NEW.weekday IS NOT DISTINCT FROM OLD.weekday
     AND NEW.start_local IS NOT DISTINCT FROM OLD.start_local
     AND (NEW.is_active IS NOT TRUE OR OLD.is_active IS TRUE)
  THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(time_zone), ''), 'Asia/Jakarta')
  INTO v_zone
  FROM public.ai_employee_profiles
  WHERE employee_id = NEW.employee_id
    AND organization_id = NEW.organization_id;

  NEW.next_run_at := public.ai_employee_next_run_at(
    NEW.weekday,
    NEW.start_local,
    COALESCE(v_zone, 'Asia/Jakarta'),
    clock_timestamp()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_employee_schedules_next_run ON public.ai_employee_schedules;
CREATE TRIGGER ai_employee_schedules_next_run
  BEFORE INSERT OR UPDATE ON public.ai_employee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_schedules_set_next_run();

CREATE OR REPLACE FUNCTION public.ai_employee_profiles_retarget_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.time_zone IS NOT DISTINCT FROM OLD.time_zone THEN
    RETURN NEW;
  END IF;

  UPDATE public.ai_employee_schedules AS schedule
  SET next_run_at = public.ai_employee_next_run_at(
    schedule.weekday,
    schedule.start_local,
    COALESCE(NULLIF(btrim(NEW.time_zone), ''), 'Asia/Jakarta'),
    clock_timestamp()
  )
  WHERE schedule.employee_id = NEW.employee_id
    AND schedule.organization_id = NEW.organization_id
    AND schedule.is_active;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_employee_profiles_retarget_schedules ON public.ai_employee_profiles;
CREATE TRIGGER ai_employee_profiles_retarget_schedules
  AFTER UPDATE OF time_zone ON public.ai_employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_profiles_retarget_schedules();

CREATE OR REPLACE FUNCTION public.ai_employee_claim_due_schedules()
RETURNS TABLE (
  schedule_id uuid,
  employee_id uuid,
  organization_id uuid,
  sop_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT schedule.id
    FROM public.ai_employee_schedules AS schedule
    JOIN public.ai_employee_profiles AS profile
      ON profile.employee_id = schedule.employee_id
     AND profile.organization_id = schedule.organization_id
    JOIN public.employees AS employee
      ON employee.id = schedule.employee_id
     AND employee.organization_id = schedule.organization_id
    WHERE schedule.is_active
      AND profile.is_active
      AND COALESCE(employee.is_ai, false)
      AND schedule.sop_code = 'SOP1'
      AND COALESCE(profile.performance_status, '') <> 'disabled'
      AND schedule.next_run_at IS NOT NULL
      AND schedule.next_run_at <= clock_timestamp()
    ORDER BY schedule.next_run_at, schedule.id
    FOR UPDATE OF schedule SKIP LOCKED
    LIMIT 5
  LOOP
    RETURN QUERY
    UPDATE public.ai_employee_schedules AS schedule
    SET next_run_at = public.ai_employee_next_run_at(
      schedule.weekday,
      schedule.start_local,
      COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
      clock_timestamp()
    )
    FROM public.ai_employee_profiles AS profile
    WHERE schedule.id = v_id
      AND profile.employee_id = schedule.employee_id
      AND profile.organization_id = schedule.organization_id
      AND schedule.next_run_at <= clock_timestamp()
    RETURNING schedule.id, schedule.employee_id, schedule.organization_id, schedule.sop_code;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_claim_due_schedules() IS
  'Mengunci dan memajukan next_run_at jadwal SOP1 yang jatuh tempo. Pemanggilan kedua tidak mengambil baris yang sama.';

CREATE OR REPLACE FUNCTION public.ai_employee_dispatch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_row record;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN 0;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'ai_employee_project_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'ai_employee_internal_secret'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR invalid_schema_name THEN
      RETURN 0;
  END;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    RAISE LOG 'ai_employee_dispatch: vault secret ai_employee_project_url or ai_employee_internal_secret is missing';
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT claimed.schedule_id, claimed.employee_id
    FROM public.ai_employee_claim_due_schedules() AS claimed
  LOOP
    v_count := v_count + 1;
    PERFORM net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/ai-employee-run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-synckerja-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'employee_id', v_row.employee_id,
        'mode', 'sop1'
      ),
      timeout_milliseconds := 120000
    );
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_dispatch() IS
  'Cron tiap menit. Tanpa jadwal jatuh tempo, atau tanpa rahasia Vault, fungsi ini tidak memanggil edge function.';

REVOKE ALL ON FUNCTION public.ai_employee_next_run_at(smallint, time, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_schedules_set_next_run() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_profiles_retarget_schedules() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_claim_due_schedules() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_dispatch() FROM PUBLIC, anon, authenticated, service_role;

REVOKE UPDATE ON TABLE public.ai_employee_schedules FROM authenticated;
GRANT UPDATE (
  sop_code,
  weekday,
  start_local,
  due_local,
  window_start_weekday,
  window_end_weekday,
  is_active
) ON TABLE public.ai_employee_schedules TO authenticated;

UPDATE public.ai_employee_schedules
SET weekday = weekday
WHERE next_run_at IS NULL;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'ai-employee-dispatch'
    ) THEN
      PERFORM cron.schedule(
        'ai-employee-dispatch',
        '* * * * *',
        $cmd$SELECT public.ai_employee_dispatch();$cmd$
      );
    END IF;
  END IF;
END
$cron$;

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
