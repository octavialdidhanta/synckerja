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
