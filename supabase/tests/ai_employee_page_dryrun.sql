-- Dry run halaman karyawan AI. Satu transaksi, diakhiri ROLLBACK. Jangan tambah COMMIT.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Halaman karyawan AI. Tidak membuat tabel, policy, extension, atau cron.
-- Klien authenticated hanya lewat tiga fungsi halaman. auth.uid() adalah pengguna.
-- Organisasi diambil dari baris karyawan AI, bukan dari argumen klien.
-- Brief memakai ai_employee_brief_write. Jadwal memakai CHECK dan trigger next_run yang sudah ada.
-- Baca kuota tidak menulis baris pemakaian.

CREATE OR REPLACE FUNCTION public.ai_employee_page_gate(
  p_employee_id uuid,
  p_write boolean
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $gate$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_ai boolean;
BEGIN
  IF p_employee_id IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT employee.organization_id, COALESCE(employee.is_ai, false)
  INTO v_org, v_ai
  FROM public.employees employee
  WHERE employee.id = p_employee_id;

  IF NOT FOUND OR NOT COALESCE(v_ai, false) OR v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations membership
    WHERE membership.user_id = v_uid
      AND membership.organization_id = v_org
      AND COALESCE(membership.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(p_write, false) THEN
    PERFORM public.ai_employee_require_owner(v_uid, v_org);
    RETURN v_org;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = v_uid
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN v_org;
END;
$gate$;

COMMENT ON FUNCTION public.ai_employee_page_gate(uuid, boolean) IS
  'Pintu halaman AI. Pengguna dari auth.uid(), organisasi dari karyawan AI, keanggotaan aktif. Ubah: owner. Baca: owner atau admin.';

CREATE OR REPLACE FUNCTION public.ai_employee_schedule_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_sop_code text,
  p_weekday integer,
  p_start_local time,
  p_due_local time,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $schedule$
DECLARE
  v_code text := NULLIF(btrim(COALESCE(p_sop_code, '')), '');
  v_count integer;
  v_id uuid;
  v_prev_weekday smallint;
  v_prev_start time;
  v_prev_due time;
  v_prev_active boolean;
  v_prev_next timestamptz;
  v_weekday smallint;
  v_start time;
  v_due time;
  v_active boolean;
  v_next timestamptz;
BEGIN
  PERFORM public.ai_employee_require_owner(p_user_id, p_organization_id);
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_code IS NULL
    OR p_weekday IS NULL
    OR p_start_local IS NULL
    OR p_due_local IS NULL
    OR p_is_active IS NULL
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = p_organization_id
    AND schedule.sop_code = v_code;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'schedule_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'schedule_ambiguous' USING ERRCODE = '22023';
  END IF;

  SELECT schedule.id, schedule.weekday, schedule.start_local, schedule.due_local, schedule.is_active, schedule.next_run_at
  INTO v_id, v_prev_weekday, v_prev_start, v_prev_due, v_prev_active, v_prev_next
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = p_organization_id
    AND schedule.sop_code = v_code
  FOR UPDATE;

  BEGIN
    UPDATE public.ai_employee_schedules schedule
    SET weekday = p_weekday::smallint,
        start_local = p_start_local,
        due_local = p_due_local,
        is_active = p_is_active
    WHERE schedule.id = v_id
    RETURNING schedule.weekday, schedule.start_local, schedule.due_local, schedule.is_active, schedule.next_run_at
    INTO v_weekday, v_start, v_due, v_active, v_next;
  EXCEPTION
    WHEN check_violation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'previous', jsonb_build_object(
      'sop_code', v_code,
      'weekday', v_prev_weekday,
      'start_local', to_char(v_prev_start, 'HH24:MI'),
      'due_local', to_char(v_prev_due, 'HH24:MI'),
      'is_active', v_prev_active,
      'next_run_at', v_prev_next
    ),
    'schedule', jsonb_build_object(
      'sop_code', v_code,
      'weekday', v_weekday,
      'start_local', to_char(v_start, 'HH24:MI'),
      'due_local', to_char(v_due, 'HH24:MI'),
      'is_active', v_active,
      'next_run_at', v_next
    )
  );
END;
$schedule$;

COMMENT ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean) IS
  'Mengubah satu jadwal yang sudah ada. Hari dan jam diperiksa oleh CHECK tabel. next_run_at diisi trigger yang sudah ada.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_read(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $read$
DECLARE
  v_org uuid;
  v_can_edit boolean;
  v_name text;
  v_title text;
  v_reviewer text;
  v_status text;
  v_active boolean;
  v_brief jsonb;
  v_service_ids uuid[];
  v_persona_ids uuid[];
  v_pillar_ids uuid[];
  v_product_ids uuid[];
  v_key_results jsonb;
  v_runs jsonb;
  v_jobs jsonb;
  v_schedules jsonb;
  v_services jsonb;
  v_personas jsonb;
  v_pillars jsonb;
  v_products jsonb;
  v_cap integer;
  v_used integer;
  v_remaining integer;
  v_date date;
  v_org_limit integer;
  v_org_used integer;
  v_org_date date;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) = 'owner'
  )
  INTO v_can_edit;

  SELECT employee.full_name,
         profile.job_title,
         reviewer.full_name,
         profile.performance_status,
         profile.is_active
  INTO v_name, v_title, v_reviewer, v_status, v_active
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND employee.organization_id = v_org;

  v_brief := public.ai_employee_brief_payload(p_employee_id);
  v_service_ids := public.ai_employee_brief_ids(v_brief->'service_ids');
  v_persona_ids := public.ai_employee_brief_ids(v_brief->'persona_ids');
  v_pillar_ids := public.ai_employee_brief_ids(v_brief->'pillar_ids');
  v_product_ids := public.ai_employee_brief_ids(v_brief->'product_knowledge_ids');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', kr.ai_kr_code,
    'title', kr.title,
    'current_value', kr.current_value,
    'target_value', kr.target_value,
    'unit', kr.unit,
    'progress_percentage', kr.progress_percentage
  ) ORDER BY kr.ai_kr_code, kr.title), '[]'::jsonb)
  INTO v_key_results
  FROM public.key_results kr
  JOIN public.individual_objectives objective
    ON objective.id = kr.individual_objective_id
  WHERE objective.organization_id = v_org
    AND objective.employee_id = p_employee_id
    AND kr.ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', run.id,
    'started_at', run.started_at,
    'finished_at', run.finished_at,
    'sop_code', run.sop_code,
    'status', run.status,
    'plan_count', run.plan_count,
    'note', left(COALESCE(run.note, ''), 240),
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', plan.id,
        'title', COALESCE(plan.title, '')
      ) ORDER BY plan.title)
      FROM public.social_media_plans plan
      WHERE plan.organization_id = v_org
        AND plan.id = ANY (run.object_ids)
    ), '[]'::jsonb)
  ) ORDER BY run.started_at DESC), '[]'::jsonb)
  INTO v_runs
  FROM (
    SELECT id, started_at, finished_at, sop_code, status, plan_count, note, object_ids
    FROM public.ai_employee_runs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY started_at DESC, id DESC
    LIMIT 20
  ) run;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', job.id,
    'source', job.source,
    'priority', job.priority,
    'status', job.status,
    'attempts', job.attempts,
    'reason', job.reason,
    'daily_task_id', job.daily_task_id,
    'plan_id', job.plan_id,
    'run_id', job.run_id,
    'next_attempt_at', job.next_attempt_at,
    'created_at', job.created_at,
    'claimed_at', job.claimed_at,
    'finished_at', job.finished_at
  ) ORDER BY job.created_at DESC, job.id DESC), '[]'::jsonb)
  INTO v_jobs
  FROM (
    SELECT id, source, priority, status, attempts, reason, daily_task_id, plan_id,
           run_id, next_attempt_at, created_at, claimed_at, finished_at
    FROM public.ai_employee_jobs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  ) job;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sop_code', schedule.sop_code,
    'weekday', schedule.weekday,
    'start_local', to_char(schedule.start_local, 'HH24:MI'),
    'due_local', to_char(schedule.due_local, 'HH24:MI'),
    'is_active', schedule.is_active,
    'next_run_at', schedule.next_run_at
  ) ORDER BY schedule.sop_code), '[]'::jsonb)
  INTO v_schedules
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = v_org;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_services
  FROM (
    SELECT svc.id, left(btrim(svc.name), 80) AS label
    FROM public.services svc
    WHERE svc.organization_id = v_org
      AND (
        COALESCE(svc.is_active, true)
        OR svc.id = ANY (v_service_ids)
      )
      AND (
        svc.id = ANY (v_service_ids)
        OR svc.id IN (
          SELECT picked.id
          FROM public.services picked
          WHERE picked.organization_id = v_org
            AND COALESCE(picked.is_active, true)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_personas
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Persona')), 80) AS label
    FROM public.product_knowledge knowledge
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_persona_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_pillars
  FROM (
    SELECT pillar.id, left(btrim(pillar.name), 80) AS label
    FROM public.content_pillars pillar
    WHERE (
        pillar.id = ANY (v_pillar_ids)
        OR (
          pillar.is_active
          AND (pillar.organization_id = v_org OR pillar.is_default)
        )
      )
      AND (
        pillar.id = ANY (v_pillar_ids)
        OR pillar.id IN (
          SELECT picked.id
          FROM public.content_pillars picked
          WHERE picked.is_active
            AND (picked.organization_id = v_org OR picked.is_default)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label,
    'service_id', item.service_id,
    'parent_service_id', item.parent_service_id
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Produk')), 80) AS label,
           knowledge.service_id,
           sub.service_id AS parent_service_id
    FROM public.product_knowledge knowledge
    LEFT JOIN public.sub_services sub
      ON sub.id = knowledge.sub_service_id
     AND sub.organization_id = knowledge.organization_id
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_product_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  v_date := (timezone('Asia/Jakarta', now()))::date;
  v_org_date := (timezone('UTC', now()))::date;

  SELECT CASE WHEN profile.performance_status = 'coaching' THEN 8 ELSE 15 END
  INTO v_cap
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = v_org;

  SELECT calls.call_count
  INTO v_used
  FROM public.ai_employee_model_calls calls
  WHERE calls.employee_id = p_employee_id
    AND calls.usage_date = v_date;
  v_used := COALESCE(v_used, 0);
  IF v_cap IS NULL THEN
    v_remaining := NULL;
  ELSE
    v_remaining := GREATEST(v_cap - v_used, 0);
  END IF;

  SELECT COALESCE(config.daily_limit, 50)
  INTO v_org_limit
  FROM public.organization_script_ai_config config
  WHERE config.organization_id = v_org;
  IF v_org_limit IS NULL OR v_org_limit < 1 THEN
    v_org_limit := 50;
  END IF;

  SELECT COALESCE(usage."count", 0)
  INTO v_org_used
  FROM public.script_ai_daily_usage usage
  WHERE usage.organization_id = v_org
    AND usage.usage_date = v_org_date;
  v_org_used := COALESCE(v_org_used, 0);

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'can_edit', v_can_edit,
    'summary', jsonb_build_object(
      'full_name', v_name,
      'job_title', v_title,
      'reviewer_name', v_reviewer,
      'performance_status', v_status,
      'is_active', v_active
    ),
    'key_results', v_key_results,
    'runs', v_runs,
    'jobs', v_jobs,
    'schedules', v_schedules,
    'brief', v_brief,
    'options', jsonb_build_object(
      'services', v_services,
      'personas', v_personas,
      'pillars', v_pillars,
      'products', v_products
    ),
    'quota', jsonb_build_object(
      'usage_date', v_date,
      'used', v_used,
      'cap', v_cap,
      'remaining', v_remaining,
      'org_usage_date', v_org_date,
      'org_used', v_org_used,
      'org_limit', v_org_limit,
      'org_remaining', GREATEST(v_org_limit - v_org_used, 0)
    )
  );
END;
$read$;

COMMENT ON FUNCTION public.ai_employee_page_read(uuid) IS
  'Isi halaman karyawan AI untuk owner/admin organisasi itu. Tidak menulis kuota dan tidak mengembalikan claim_token.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_brief_save(
  p_employee_id uuid,
  p_brief jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $brief$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_brief_write(auth.uid(), v_org, p_employee_id, p_brief);
END;
$brief$;

COMMENT ON FUNCTION public.ai_employee_page_brief_save(uuid, jsonb) IS
  'Owner menyimpan brief lewat ai_employee_brief_write. Aturan katalog, persona, pilar, dan produk tidak disalin ulang.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_schedule_save(
  p_employee_id uuid,
  p_sop_code text,
  p_weekday integer,
  p_start_local time,
  p_due_local time,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $pageschedule$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_schedule_write(
    auth.uid(),
    v_org,
    p_employee_id,
    p_sop_code,
    p_weekday,
    p_start_local,
    p_due_local,
    p_is_active
  );
END;
$pageschedule$;

COMMENT ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean) IS
  'Owner mengubah jadwal yang sudah ada lewat ai_employee_schedule_write.';

REVOKE ALL ON FUNCTION public.ai_employee_page_gate(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_read(uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_brief_save(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

GRANT EXECUTE ON FUNCTION public.ai_employee_page_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_brief_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean) TO authenticated;

-- Uji halaman karyawan AI. Dipakai di dalam dry run.
-- Tidak punya BEGIN atau ROLLBACK sendiri.
-- Jangan panggil ai_employee_dispatch, ai_employee_claim_due_jobs, atau ai_employee_requeue_stuck_jobs.

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

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
AS $jwt$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', COALESCE(p_role, ''), true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$jwt$;

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_inactive uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_other_org uuid := gen_random_uuid();
  v_reviewer uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_human uuid := gen_random_uuid();
  v_other_ai uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_foreign_service uuid := gen_random_uuid();
  v_persona uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_foreign_product uuid := gen_random_uuid();
  v_pillar uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_foreign_plan uuid := gen_random_uuid();
  v_task uuid := gen_random_uuid();
  v_task_new uuid := gen_random_uuid();
  v_foreign_task uuid := gen_random_uuid();
  v_job uuid := gen_random_uuid();
  v_old_job uuid := gen_random_uuid();
  v_cycle uuid := gen_random_uuid();
  v_objective uuid := gen_random_uuid();
  v_other_objective uuid := gen_random_uuid();
  v_token uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_payload jsonb;
  v_saved jsonb;
  v_count integer;
  v_org_limit integer;
  v_org_used integer;
  v_weekday smallint;
  v_audience text;
  v_i integer;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_owner, 'page-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_admin, 'page-admin@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'page-member@example.com');
  PERFORM pg_temp.insert_auth_user(v_other, 'page-other@example.com');
  PERFORM pg_temp.insert_auth_user(v_inactive, 'page-inactive@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES
    (v_org, 'Halaman AI Uji', 'software', v_owner),
    (v_other_org, 'Halaman AI Org Lain', 'software', v_other);

  INSERT INTO public.user_organizations (user_id, organization_id, is_active)
  VALUES
    (v_owner, v_org, true),
    (v_admin, v_org, true),
    (v_member, v_org, true),
    (v_other, v_other_org, true),
    (v_inactive, v_org, false);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_owner, v_org, 'owner'),
    (v_admin, v_org, 'admin'),
    (v_member, v_org, 'employee'),
    (v_other, v_other_org, 'owner'),
    (v_inactive, v_org, 'owner');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_reviewer, v_org, 'Reviewer Halaman', NULL, false),
    (v_ai, v_org, 'Naya Halaman', NULL, true),
    (v_human, v_org, 'Bukan AI', v_owner, false),
    (v_other_ai, v_other_org, 'Naya Rahasia', NULL, true);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, job_title, reviewer_employee_id, time_zone, is_active, performance_status
  ) VALUES (
    v_ai, v_org, 'Perencana Konten', v_reviewer, 'Asia/Jakarta', true, 'on_track'
  );

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local, is_active
  ) VALUES (
    v_ai, v_org, 'SOP1', 5, '15:00', '17:00', true
  );

  INSERT INTO public.services (id, organization_id, name, is_active)
  VALUES
    (v_service, v_org, 'Katalog Uji', true),
    (v_foreign_service, v_other_org, 'Katalog Rahasia', true);

  INSERT INTO public.content_pillars (id, organization_id, name, is_active)
  VALUES (v_pillar, v_org, 'Pilar Uji', true);

  INSERT INTO public.product_knowledge (id, organization_id, service_id, feature_name)
  VALUES
    (v_persona, v_org, v_service, 'Persona Uji'),
    (v_product, v_org, v_service, 'Produk Uji'),
    (v_foreign_product, v_other_org, v_foreign_service, 'Produk Rahasia');

  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, post_date, author_employee_id, status
  ) VALUES
    (v_plan, v_org, 'Plan terlihat', 'Brief uji', '2026-11-09 00:00:00+07', v_ai, 'draft'),
    (v_foreign_plan, v_other_org, 'Rahasia org lain', 'Brief rahasia', '2026-11-09 00:00:00+07', v_other_ai, 'draft');

  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES
    (v_task, v_org, 'Buat content plan lama', 'konten', 'medium', v_owner),
    (v_task_new, v_org, 'Buat content plan baru', 'konten', 'high', v_owner),
    (v_foreign_task, v_other_org, 'Buat content plan rahasia', 'konten', 'medium', v_other);

  INSERT INTO public.ai_employee_jobs (
    id, employee_id, organization_id, source, daily_task_id, priority, status, reason, created_at, claim_token
  ) VALUES
    (v_old_job, v_ai, v_org, 'task', v_task, 'medium', 'queued', 'antrean lama', now() - interval '2 hours', NULL),
    (v_job, v_ai, v_org, 'task', v_task_new, 'high', 'deferred', 'antrean terbaru', now(), v_token),
    (gen_random_uuid(), v_other_ai, v_other_org, 'task', v_foreign_task, 'medium', 'queued', 'rahasia antrean', now(), gen_random_uuid());

  INSERT INTO public.okr_cycles (id, organization_id, name, year)
  VALUES
    (v_cycle, v_org, 'Siklus uji', 2026),
    (gen_random_uuid(), v_other_org, 'Siklus rahasia', 2026);

  INSERT INTO public.individual_objectives (
    id, organization_id, cycle_id, employee_id, title, created_by
  ) VALUES
    (v_objective, v_org, v_cycle, v_ai, 'KPI uji', v_owner),
    (v_other_objective, v_other_org, (SELECT id FROM public.okr_cycles WHERE organization_id = v_other_org LIMIT 1), v_other_ai, 'KPI rahasia', v_other);

  INSERT INTO public.key_results (
    title, individual_objective_id, ai_kr_code, current_value, target_value, unit, weight, metric_type, progress_percentage
  ) VALUES
    ('Selesai tepat', v_objective, 'KR1', 3, 10, 'plan', 1, 'percentage', 30),
    ('Kualitas', v_objective, 'KR4', 1, 4, 'plan', 1, 'percentage', 25),
    ('Bukan KPI', v_objective, NULL, 0, 1, 'plan', 1, 'percentage', 0),
    ('KR rahasia', v_other_objective, 'KR1', 9, 9, 'plan', 1, 'percentage', 100);

  FOR v_i IN 1..21 LOOP
    INSERT INTO public.ai_employee_runs (
      employee_id, organization_id, sop_code, status, started_at, finished_at, plan_count, note, object_ids
    ) VALUES (
      v_ai,
      v_org,
      'SOP1',
      'succeeded',
      now() - make_interval(hours => 22 - v_i),
      now() - make_interval(hours => 22 - v_i) + interval '10 minutes',
      CASE WHEN v_i = 21 THEN 2 ELSE 0 END,
      CASE
        WHEN v_i = 21 THEN 'run terbaru'
        WHEN v_i = 1 THEN 'run tertua'
        ELSE 'run biasa'
      END,
      CASE
        WHEN v_i = 21 THEN ARRAY[v_plan, v_foreign_plan, gen_random_uuid()]
        ELSE '{}'::uuid[]
      END
    );
  END LOOP;

  INSERT INTO public.ai_employee_model_calls (employee_id, usage_date, call_count)
  VALUES (v_ai, (timezone('Asia/Jakarta', now()))::date, 4);

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  IF EXISTS (SELECT 1 FROM public.ai_employee_briefs WHERE employee_id = v_ai) THEN
    RAISE EXCEPTION 'brief sudah ada sebelum disimpan';
  END IF;
  v_payload := public.ai_employee_page_read(v_ai);
  IF (SELECT count(*) FROM public.ai_employee_model_calls WHERE employee_id = v_ai) <> 1 THEN
    RAISE EXCEPTION 'baca halaman menulis kuota';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ai_employee_briefs WHERE employee_id = v_ai) THEN
    RAISE EXCEPTION 'baca halaman membuat brief';
  END IF;

  IF v_payload->>'organization_id' IS DISTINCT FROM v_org::text
    OR v_payload->>'can_edit' IS DISTINCT FROM 'true'
    OR v_payload->'summary'->>'full_name' IS DISTINCT FROM 'Naya Halaman'
    OR v_payload->'summary'->>'job_title' IS DISTINCT FROM 'Perencana Konten'
    OR v_payload->'summary'->>'reviewer_name' IS DISTINCT FROM 'Reviewer Halaman'
    OR v_payload->'summary'->>'performance_status' IS DISTINCT FROM 'on_track'
    OR v_payload->'summary'->>'is_active' IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'ringkasan owner salah: %', v_payload->'summary';
  END IF;

  IF jsonb_array_length(v_payload->'key_results') <> 2
    OR v_payload->'key_results'->0->>'code' IS DISTINCT FROM 'KR1'
    OR (v_payload->'key_results'->0->>'current_value')::numeric <> 3
    OR (v_payload->'key_results'->0->>'target_value')::numeric <> 10
    OR v_payload->'key_results'->1->>'code' IS DISTINCT FROM 'KR4'
  THEN
    RAISE EXCEPTION 'KPI salah: %', v_payload->'key_results';
  END IF;

  IF jsonb_array_length(v_payload->'runs') <> 20
    OR v_payload->'runs'->0->>'note' IS DISTINCT FROM 'run terbaru'
    OR v_payload->'runs'->0->>'sop_code' IS DISTINCT FROM 'SOP1'
    OR v_payload->'runs'->0->>'status' IS DISTINCT FROM 'succeeded'
    OR (v_payload->'runs'->0->>'plan_count')::integer <> 2
    OR jsonb_array_length(v_payload->'runs'->0->'plans') <> 1
    OR v_payload->'runs'->0->'plans'->0->>'id' IS DISTINCT FROM v_plan::text
    OR v_payload->'runs'->0->'plans'->0->>'title' IS DISTINCT FROM 'Plan terlihat'
  THEN
    RAISE EXCEPTION 'log kerja salah: %', v_payload->'runs'->0;
  END IF;

  IF jsonb_array_length(v_payload->'jobs') <> 2
    OR v_payload->'jobs'->0->>'reason' IS DISTINCT FROM 'antrean terbaru'
    OR v_payload->'jobs'->0->>'status' IS DISTINCT FROM 'deferred'
    OR v_payload->'jobs'->0->>'source' IS DISTINCT FROM 'task'
  THEN
    RAISE EXCEPTION 'antrean salah: %', v_payload->'jobs';
  END IF;

  IF jsonb_array_length(v_payload->'schedules') <> 1
    OR v_payload->'schedules'->0->>'sop_code' IS DISTINCT FROM 'SOP1'
    OR (v_payload->'schedules'->0->>'weekday')::integer <> 5
    OR v_payload->'schedules'->0->>'start_local' IS DISTINCT FROM '15:00'
    OR v_payload->'schedules'->0->>'due_local' IS DISTINCT FROM '17:00'
  THEN
    RAISE EXCEPTION 'jadwal salah: %', v_payload->'schedules';
  END IF;

  IF (v_payload->'quota'->>'used')::integer <> 4
    OR (v_payload->'quota'->>'cap')::integer <> 15
    OR (v_payload->'quota'->>'remaining')::integer <> 11
    OR v_payload->'quota'->>'usage_date' IS DISTINCT FROM (timezone('Asia/Jakarta', now()))::date::text
  THEN
    RAISE EXCEPTION 'kuota karyawan salah: %', v_payload->'quota';
  END IF;

  SELECT COALESCE(config.daily_limit, 50)
  INTO v_org_limit
  FROM public.organization_script_ai_config config
  WHERE config.organization_id = v_org;
  IF v_org_limit IS NULL OR v_org_limit < 1 THEN
    v_org_limit := 50;
  END IF;
  SELECT COALESCE(usage."count", 0)
  INTO v_org_used
  FROM public.script_ai_daily_usage usage
  WHERE usage.organization_id = v_org
    AND usage.usage_date = (timezone('UTC', now()))::date;
  v_org_used := COALESCE(v_org_used, 0);
  IF (v_payload->'quota'->>'org_limit')::integer IS DISTINCT FROM v_org_limit
    OR (v_payload->'quota'->>'org_used')::integer IS DISTINCT FROM v_org_used
    OR (v_payload->'quota'->>'org_remaining')::integer IS DISTINCT FROM GREATEST(v_org_limit - v_org_used, 0)
  THEN
    RAISE EXCEPTION 'kuota organisasi tidak mengikuti reserve: %', v_payload->'quota';
  END IF;

  IF v_payload::text LIKE '%Katalog Uji%' IS NOT TRUE
    OR v_payload::text LIKE '%Persona Uji%' IS NOT TRUE
    OR v_payload::text LIKE '%Produk Uji%' IS NOT TRUE
    OR v_payload::text LIKE '%Pilar Uji%' IS NOT TRUE
  THEN
    RAISE EXCEPTION 'pilihan katalog organisasi tidak muncul';
  END IF;

  IF v_payload::text LIKE '%' || v_token::text || '%'
    OR v_payload::text LIKE '%Katalog Rahasia%'
    OR v_payload::text LIKE '%Produk Rahasia%'
    OR v_payload::text LIKE '%Naya Rahasia%'
    OR v_payload::text LIKE '%Rahasia org lain%'
    OR v_payload::text LIKE '%rahasia antrean%'
    OR v_payload::text LIKE '%KR rahasia%'
    OR v_payload::text LIKE '%Bukan KPI%'
    OR v_payload::text LIKE '%run tertua%'
    OR v_payload::text LIKE '%' || v_foreign_service::text || '%'
    OR v_payload::text LIKE '%' || v_foreign_product::text || '%'
    OR v_payload::text LIKE '%' || v_foreign_plan::text || '%'
  THEN
    RAISE EXCEPTION 'data org lain atau token klaim ikut terbaca';
  END IF;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_payload := public.ai_employee_page_read(v_ai);
    IF v_payload->'summary'->>'full_name' IS DISTINCT FROM 'Naya Halaman' THEN
      RAISE EXCEPTION 'peran authenticated tidak bisa membaca halaman';
    END IF;
    BEGIN
      PERFORM count(*) FROM public.ai_employee_jobs;
      RAISE EXCEPTION 'authenticated membaca tabel job';
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
    END;
    EXECUTE 'RESET ROLE';
  EXCEPTION
    WHEN OTHERS THEN
      BEGIN
        EXECUTE 'RESET ROLE';
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      RAISE;
  END;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_read(v_ai);
    RAISE EXCEPTION 'anggota biasa tidak ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'forbidden' THEN
        RAISE EXCEPTION 'pesan anggota: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(v_admin, 'authenticated');
  v_payload := public.ai_employee_page_read(v_ai);
  IF v_payload->>'can_edit' IS DISTINCT FROM 'false'
    OR v_payload->'summary'->>'full_name' IS DISTINCT FROM 'Naya Halaman'
    OR v_payload::text LIKE '%' || v_token::text || '%'
    OR v_payload::text LIKE '%Naya Rahasia%'
  THEN
    RAISE EXCEPTION 'baca admin salah';
  END IF;

  PERFORM pg_temp.as_user(v_other, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_read(v_ai);
    RAISE EXCEPTION 'owner org lain melihat karyawan ini';
  EXCEPTION
    WHEN no_data_found THEN
      IF SQLERRM IS DISTINCT FROM 'not_found' THEN
        RAISE EXCEPTION 'pesan org lain: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_read(v_other_ai);
    RAISE EXCEPTION 'owner melihat karyawan org lain';
  EXCEPTION
    WHEN no_data_found THEN
      IF SQLERRM IS DISTINCT FROM 'not_found' THEN
        RAISE EXCEPTION 'pesan karyawan org lain: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(v_inactive, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_read(v_ai);
    RAISE EXCEPTION 'keanggotaan nonaktif tidak ditolak';
  EXCEPTION
    WHEN no_data_found THEN
      IF SQLERRM IS DISTINCT FROM 'not_found' THEN
        RAISE EXCEPTION 'pesan nonaktif: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_read(v_human);
    RAISE EXCEPTION 'karyawan manusia terbaca sebagai AI';
  EXCEPTION
    WHEN no_data_found THEN
      IF SQLERRM IS DISTINCT FROM 'not_found' THEN
        RAISE EXCEPTION 'pesan manusia: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(NULL, 'service_role');
  BEGIN
    PERFORM public.ai_employee_page_read(v_ai);
    RAISE EXCEPTION 'tanpa auth.uid() halaman tetap terbuka';
  EXCEPTION
    WHEN no_data_found THEN
      IF SQLERRM IS DISTINCT FROM 'not_found' THEN
        RAISE EXCEPTION 'pesan tanpa user: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  v_saved := public.ai_employee_page_brief_save(v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'ibu muda',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat',
    'required_notes', '',
    'forbidden_notes', '',
    'pillar_ids', jsonb_build_array(v_pillar),
    'product_knowledge_ids', jsonb_build_array(v_product),
    'split_rule', ''
  ));
  IF v_saved->'previous'->>'audience' IS DISTINCT FROM ''
    OR v_saved->'brief'->>'audience' IS DISTINCT FROM 'ibu muda'
  THEN
    RAISE EXCEPTION 'brief lama/baru salah: %', v_saved;
  END IF;
  SELECT audience INTO v_audience FROM public.ai_employee_briefs WHERE employee_id = v_ai;
  IF v_audience IS DISTINCT FROM 'ibu muda' THEN
    RAISE EXCEPTION 'brief tidak tersimpan';
  END IF;

  PERFORM pg_temp.as_user(v_admin, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_brief_save(v_ai, jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'audience', 'admin ubah',
      'persona_ids', jsonb_build_array(v_persona),
      'voice', 'hangat',
      'required_notes', '',
      'forbidden_notes', '',
      'pillar_ids', jsonb_build_array(v_pillar),
      'product_knowledge_ids', jsonb_build_array(v_product),
      'split_rule', ''
    ));
    RAISE EXCEPTION 'admin mengubah brief';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'forbidden' THEN
        RAISE EXCEPTION 'pesan admin brief: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_brief_save(v_ai, jsonb_build_object('audience', 'anggota ubah'));
    RAISE EXCEPTION 'anggota mengubah brief';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'forbidden' THEN
        RAISE EXCEPTION 'pesan anggota brief: %', SQLERRM;
      END IF;
  END;

  SELECT audience INTO v_audience FROM public.ai_employee_briefs WHERE employee_id = v_ai;
  IF v_audience IS DISTINCT FROM 'ibu muda' THEN
    RAISE EXCEPTION 'brief berubah tanpa owner';
  END IF;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_brief_save(v_ai, jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'audience', 'ibu muda',
      'persona_ids', '[]'::jsonb,
      'voice', '',
      'required_notes', '',
      'forbidden_notes', '',
      'pillar_ids', '[]'::jsonb,
      'product_knowledge_ids', jsonb_build_array(v_foreign_product),
      'split_rule', ''
    ));
    RAISE EXCEPTION 'produk org lain lolos ke brief';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF SQLERRM IS DISTINCT FROM 'invalid_input' THEN
        RAISE EXCEPTION 'pesan produk asing: %', SQLERRM;
      END IF;
  END;
  SELECT audience INTO v_audience FROM public.ai_employee_briefs WHERE employee_id = v_ai;
  IF v_audience IS DISTINCT FROM 'ibu muda' THEN
    RAISE EXCEPTION 'produk asing mengubah brief';
  END IF;

  v_saved := public.ai_employee_page_schedule_save(v_ai, 'SOP1', 3, '09:00', '11:00', true);
  IF (v_saved->'previous'->>'weekday')::integer <> 5
    OR (v_saved->'schedule'->>'weekday')::integer <> 3
    OR v_saved->'schedule'->>'start_local' IS DISTINCT FROM '09:00'
    OR v_saved->'schedule'->>'due_local' IS DISTINCT FROM '11:00'
    OR v_saved->'schedule'->>'next_run_at' IS NULL
  THEN
    RAISE EXCEPTION 'jadwal lama/baru salah: %', v_saved;
  END IF;

  PERFORM pg_temp.as_user(v_admin, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_schedule_save(v_ai, 'SOP1', 1, '08:00', '10:00', true);
    RAISE EXCEPTION 'admin mengubah jadwal';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'forbidden' THEN
        RAISE EXCEPTION 'pesan admin jadwal: %', SQLERRM;
      END IF;
  END;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_schedule_save(v_ai, 'SOP1', 2, '08:00', '10:00', false);
    RAISE EXCEPTION 'anggota mengubah jadwal';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'forbidden' THEN
        RAISE EXCEPTION 'pesan anggota jadwal: %', SQLERRM;
      END IF;
  END;

  SELECT weekday INTO v_weekday
  FROM public.ai_employee_schedules
  WHERE employee_id = v_ai AND sop_code = 'SOP1';
  IF v_weekday IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'jadwal berubah tanpa owner: %', v_weekday;
  END IF;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  BEGIN
    PERFORM public.ai_employee_page_schedule_save(v_ai, 'SOP1', 3, '12:00', '11:00', true);
    RAISE EXCEPTION 'jam selesai sebelum mulai lolos';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF SQLERRM IS DISTINCT FROM 'invalid_input' THEN
        RAISE EXCEPTION 'pesan jam: %', SQLERRM;
      END IF;
  END;
  BEGIN
    PERFORM public.ai_employee_page_schedule_save(v_ai, 'SOP1', 8, '09:00', '11:00', true);
    RAISE EXCEPTION 'hari di luar 1-7 lolos';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF SQLERRM IS DISTINCT FROM 'invalid_input' THEN
        RAISE EXCEPTION 'pesan hari: %', SQLERRM;
      END IF;
  END;
  SELECT weekday INTO v_weekday
  FROM public.ai_employee_schedules
  WHERE employee_id = v_ai AND sop_code = 'SOP1';
  IF v_weekday IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'jadwal tidak valid tetap tersimpan: %', v_weekday;
  END IF;

  BEGIN
    PERFORM public.ai_employee_page_schedule_save(v_ai, 'SOP404', 3, '09:00', '11:00', true);
    RAISE EXCEPTION 'sop yang tidak ada lolos';
  EXCEPTION
    WHEN no_data_found THEN
      IF SQLERRM IS DISTINCT FROM 'schedule_not_found' THEN
        RAISE EXCEPTION 'pesan sop hilang: %', SQLERRM;
      END IF;
  END;

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local, is_active
  ) VALUES
    (v_ai, v_org, 'SOP9', 4, '10:00', '12:00', true),
    (v_ai, v_org, 'SOP9', 4, '10:00', '12:00', true);
  BEGIN
    PERFORM public.ai_employee_page_schedule_save(v_ai, 'SOP9', 2, '09:00', '11:00', true);
    RAISE EXCEPTION 'jadwal ganda lolos';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF SQLERRM IS DISTINCT FROM 'schedule_ambiguous' THEN
        RAISE EXCEPTION 'pesan jadwal ganda: %', SQLERRM;
      END IF;
  END;
  IF (
    SELECT count(*)
    FROM public.ai_employee_schedules
    WHERE employee_id = v_ai AND sop_code = 'SOP9' AND weekday = 4
  ) <> 2 THEN
    RAISE EXCEPTION 'jadwal ganda terubah';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.ai_employee_page_read(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.ai_employee_page_brief_save(uuid, jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'authenticated tidak mendapat pintu halaman';
  END IF;

  IF has_function_privilege('anon', 'public.ai_employee_page_read(uuid)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.ai_employee_page_read(uuid)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_page_read(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_page_gate(uuid, boolean)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.ai_employee_page_brief_save(uuid, jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'hak eksekusi halaman terlalu lebar';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc proc
    CROSS JOIN LATERAL aclexplode(COALESCE(proc.proacl, acldefault('f', proc.proowner))) AS acl
    WHERE proc.oid IN (
      'public.ai_employee_page_gate(uuid, boolean)'::regprocedure,
      'public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean)'::regprocedure,
      'public.ai_employee_page_read(uuid)'::regprocedure,
      'public.ai_employee_page_brief_save(uuid, jsonb)'::regprocedure,
      'public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean)'::regprocedure
    )
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC masih bisa menjalankan fungsi halaman';
  END IF;
END;
$test$;
ROLLBACK;
