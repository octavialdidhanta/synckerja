-- Badan uji perbaikan klaim antrean AI. Dipakai di dalam dry run.
-- Tidak punya BEGIN atau ROLLBACK sendiri.
-- Jangan panggil ai_employee_dispatch atau ai_employee_requeue_stuck_jobs.
-- Klaim memakai hari Sabtu supaya job non-urgent di production tidak ikut terambil.

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

CREATE OR REPLACE FUNCTION pg_temp.assert_only_this_job(p_at timestamptz, p_keep uuid)
RETURNS void
LANGUAGE plpgsql
AS $clear$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM public.ai_employee_jobs job
  JOIN public.ai_employee_profiles profile
    ON profile.employee_id = job.employee_id
   AND profile.organization_id = job.organization_id
  JOIN public.employees employee
    ON employee.id = job.employee_id
   AND employee.organization_id = job.organization_id
  WHERE job.id IS DISTINCT FROM p_keep
    AND job.status IN ('queued', 'deferred')
    AND job.next_attempt_at <= p_at
    AND profile.is_active
    AND COALESCE(employee.is_ai, false)
    AND COALESCE(profile.performance_status, '') <> 'disabled'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ai_employee_jobs busy
      WHERE busy.employee_id = job.employee_id
        AND busy.status IN ('claimed', 'running')
    )
    AND (
      job.priority = 'urgent'
      OR public.ai_employee_in_work_hours(
        COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
        p_at
      )
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'antrean production punya % job yang ikut terambil. Uji berhenti sebelum klaim.', v_count;
  END IF;
END;
$clear$;

CREATE OR REPLACE FUNCTION pg_temp.claim_one(p_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
AS $claimone$
DECLARE
  v_id uuid;
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT claimed.job_id
    FROM public.ai_employee_claim_due_jobs(p_at, '{}'::uuid[]) claimed
  LOOP
    v_count := v_count + 1;
    v_id := v_row.job_id;
  END LOOP;
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'klaim menghasilkan % job, uji dibatalkan', v_count;
  END IF;
  RETURN v_id;
END;
$claimone$;

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_reviewer_user uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_owner_emp uuid := gen_random_uuid();
  v_member_emp uuid := gen_random_uuid();
  v_reviewer uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_spoof_task uuid := gen_random_uuid();
  v_owner_task uuid := gen_random_uuid();
  v_empty_task uuid := gen_random_uuid();
  v_service_task uuid := gen_random_uuid();
  v_service_bad_task uuid := gen_random_uuid();
  v_uid_wins_task uuid := gen_random_uuid();
  v_spoof_request uuid := gen_random_uuid();
  v_owner_request uuid := gen_random_uuid();
  v_empty_request uuid := gen_random_uuid();
  v_service_request uuid := gen_random_uuid();
  v_service_bad_request uuid := gen_random_uuid();
  v_token_task uuid := gen_random_uuid();
  v_plan_member uuid := gen_random_uuid();
  v_plan_server uuid := gen_random_uuid();
  v_plan_owner uuid := gen_random_uuid();
  v_plan_reviewer uuid := gen_random_uuid();
  v_job uuid;
  v_run_plain uuid;
  v_run_a uuid;
  v_run_b uuid;
  v_token_a uuid;
  v_token_b uuid;
  v_plan_id uuid;
  v_status text;
  v_reason text;
  v_count integer;
  v_when timestamptz := '2026-11-07 10:00:00+07';
  v_payload jsonb;
BEGIN
  IF public.ai_employee_in_work_hours('Asia/Jakarta', v_when) THEN
    RAISE EXCEPTION 'sabtu terhitung jam kerja';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'claim-owner-' || left(v_owner::text, 8) || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'claim-member-' || left(v_member::text, 8) || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_reviewer_user, 'claim-reviewer-' || left(v_reviewer_user::text, 8) || '@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Klaim Uji', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_owner, v_org, 'owner'),
    (v_member, v_org, 'employee'),
    (v_reviewer_user, v_org, 'employee');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_owner_emp, v_org, 'Owner Klaim', v_owner, false),
    (v_member_emp, v_org, 'Anggota Klaim', v_member, false),
    (v_reviewer, v_org, 'Reviewer Klaim', v_reviewer_user, false),
    (v_ai, v_org, 'Naya Klaim', NULL, true);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, reviewer_employee_id, time_zone, is_active, performance_status
  ) VALUES (
    v_ai, v_org, v_reviewer, 'Asia/Jakarta', true, 'on_track'
  );

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  VALUES (v_ai, v_org, 'content.plans.create');

  v_run_plain := public.ai_employee_run_start(v_ai, 'SOP2');
  v_payload := public.ai_employee_perform(
    v_ai,
    v_run_plain,
    'content.plans.create',
    jsonb_build_object('title', 'Plan tanpa job', 'brief', 'biasa', 'post_date', '2026-11-09')
  );
  IF v_payload->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'run tanpa job ditolak';
  END IF;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_spoof_task, v_org, 'Tugas palsu', 'konten', 'medium', v_member);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_spoof_task, v_ai, v_owner_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_spoof_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'anggota yang mengisi assigned_by owner tidak ditolak: % %', v_status, v_reason;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_tasks_assigned
    WHERE daily_task_id = v_spoof_task AND employee_id = v_ai AND assigned_by = v_owner_emp
  ) THEN
    RAISE EXCEPTION 'baris penugasan tidak tersimpan';
  END IF;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_owner_task, v_org, 'Tugas owner', 'konten', 'medium', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_owner_task, v_ai, v_member_emp);
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_owner_task AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'auth owner kalah dari assigned_by anggota';
  END IF;

  PERFORM pg_temp.as_user(NULL, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_empty_task, v_org, 'Tugas tanpa uid', 'konten', 'medium', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_empty_task, v_ai, v_owner_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_empty_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%tidak teridentifikasi%' THEN
    RAISE EXCEPTION 'uid kosong tetap percaya assigned_by: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(NULL, 'service_role');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_service_task, v_org, 'Tugas service', 'konten', 'medium', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_service_task, v_ai, v_owner_emp);
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_task AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'service_role tidak boleh memakai assigned_by owner';
  END IF;

  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_service_bad_task, v_org, 'Tugas service anggota', 'konten', 'medium', v_member);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_service_bad_task, v_ai, v_member_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_bad_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'service_role menerima assigned_by anggota: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_member, 'service_role');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_uid_wins_task, v_org, 'Tugas uid menang', 'konten', 'medium', v_member);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_uid_wins_task, v_ai, v_owner_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_uid_wins_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'uid anggota kalah dari service_role: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_spoof_request, v_org, 'Minta palsu', 'konten', 'high', v_owner, v_ai
  );
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_spoof_request;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'anggota yang mengisi created_by owner tidak ditolak: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_owner_request, v_org, 'Minta owner', 'konten', 'high', v_member, v_ai
  );
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_owner_request AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'auth owner kalah dari created_by anggota';
  END IF;

  PERFORM pg_temp.as_user(NULL, 'authenticated');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_empty_request, v_org, 'Minta tanpa uid', 'konten', 'high', v_owner, v_ai
  );
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_empty_request;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%tidak teridentifikasi%' THEN
    RAISE EXCEPTION 'uid kosong tetap percaya created_by: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(NULL, 'service_role');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_service_request, v_org, 'Minta service', 'konten', 'high', v_owner, v_ai
  );
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_request AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'service_role tidak boleh memakai created_by owner';
  END IF;

  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_service_bad_request, v_org, 'Minta service anggota', 'konten', 'high', v_member, v_ai
  );
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_bad_request;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'service_role menerima created_by anggota: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(NULL, '');
  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, post_date, author_employee_id, status, approved
  ) VALUES
    (v_plan_member, v_org, 'Plan anggota', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false),
    (v_plan_server, v_org, 'Plan server', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false),
    (v_plan_owner, v_org, 'Plan owner', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false),
    (v_plan_reviewer, v_org, 'Plan reviewer', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false);

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_member;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_member;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'revisi anggota masuk antrean: % %', v_status, v_reason;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ai_employee_jobs WHERE plan_id = v_plan_member AND status = 'queued'
  ) THEN
    RAISE EXCEPTION 'revisi anggota tetap queued';
  END IF;

  PERFORM pg_temp.as_user(NULL, '');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_server;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_server;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%tidak teridentifikasi%' THEN
    RAISE EXCEPTION 'revisi tanpa uid masuk antrean: % %', v_status, v_reason;
  END IF;

  INSERT INTO public.ai_employee_feedback (
    employee_id, organization_id, object_type, object_id, reason, reviewer_employee_id
  ) VALUES (
    v_ai, v_org, 'plan', v_plan_owner, 'Hook kurang kuat', v_reviewer
  );

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_owner;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_owner AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' OR v_reason NOT LIKE '%Hook kurang kuat%' THEN
    RAISE EXCEPTION 'revisi owner tidak masuk antrean: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan_owner;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_owner;
  SELECT reason INTO v_reason
  FROM public.ai_employee_jobs
  WHERE plan_id = v_plan_owner AND status = 'queued';
  IF v_reason NOT LIKE '%Hook kurang kuat%' THEN
    RAISE EXCEPTION 'penolakan anggota menimpa alasan job yang sudah queued: %', v_reason;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_employee_jobs
    WHERE plan_id = v_plan_owner AND status = 'rejected'
      AND reason LIKE '%owner, admin, atau reviewer%'
  ) THEN
    RAISE EXCEPTION 'penolakan anggota tidak tersimpan terpisah';
  END IF;

  UPDATE public.ai_employee_jobs
  SET status = 'done', finished_at = clock_timestamp()
  WHERE plan_id = v_plan_owner AND status = 'queued';
  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan_owner;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 2
  WHERE id = v_plan_owner;
  UPDATE public.ai_employee_jobs
  SET status = 'done', finished_at = clock_timestamp()
  WHERE plan_id = v_plan_owner AND status = 'queued';
  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan_owner;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 3
  WHERE id = v_plan_owner;
  IF EXISTS (
    SELECT 1 FROM public.ai_employee_jobs WHERE plan_id = v_plan_owner AND status = 'queued'
  ) THEN
    RAISE EXCEPTION 'revisi ketiga tetap queued';
  END IF;
  SELECT reason INTO v_reason
  FROM public.ai_employee_jobs
  WHERE plan_id = v_plan_owner AND status = 'rejected'
  ORDER BY finished_at DESC NULLS LAST
  LIMIT 1;
  IF v_reason NOT LIKE '%sudah 2 kali%' THEN
    RAISE EXCEPTION 'revisi ketiga bukan batas: %', v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_reviewer_user, 'authenticated');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_reviewer;
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_reviewer AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'revisi reviewer tidak masuk antrean';
  END IF;

  PERFORM public.ai_employee_job_put(
    v_ai, v_org, 'task', v_owner_task, NULL, 'medium', 'queued', 'alasan baru'
  );
  PERFORM public.ai_employee_job_put(
    v_ai, v_org, 'task', v_owner_task, NULL, 'medium', 'rejected', 'bocor'
  );
  SELECT reason INTO v_reason
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_owner_task AND status = 'queued';
  IF v_reason IS DISTINCT FROM 'alasan baru' THEN
    RAISE EXCEPTION 'job ditolak menimpa alasan queued: %', v_reason;
  END IF;

  UPDATE public.ai_employee_jobs
  SET status = 'done', finished_at = clock_timestamp(), claim_token = NULL
  WHERE organization_id = v_org AND status IN ('queued', 'deferred');

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_token_task, v_org, 'Buat content plan klaim', 'konten', 'urgent', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_token_task, v_ai, v_member_emp);
  SELECT id, status INTO v_job, v_status
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_token_task AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' OR v_job IS NULL THEN
    RAISE EXCEPTION 'job token tidak queued';
  END IF;
  UPDATE public.ai_employee_jobs
  SET next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE id = v_job;

  PERFORM pg_temp.as_user(NULL, '');
  PERFORM pg_temp.assert_only_this_job(v_when, v_job);
  IF pg_temp.claim_one(v_when) IS DISTINCT FROM v_job THEN
    RAISE EXCEPTION 'klaim pertama bukan job uji';
  END IF;
  v_payload := public.ai_employee_job_take(v_ai, v_job);
  v_token_a := NULLIF(v_payload->>'claim_token', '')::uuid;
  IF v_token_a IS NULL OR v_payload->>'source' IS DISTINCT FROM 'task' THEN
    RAISE EXCEPTION 'take tidak mengembalikan token';
  END IF;
  v_run_a := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_job_bind(v_ai, v_job, v_run_a, v_token_a);

  UPDATE public.ai_employee_jobs
  SET status = 'queued',
      claimed_at = NULL,
      claim_token = NULL,
      run_id = NULL,
      attempts = 0,
      next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE id = v_job;

  PERFORM pg_temp.assert_only_this_job(v_when, v_job);
  IF pg_temp.claim_one(v_when) IS DISTINCT FROM v_job THEN
    RAISE EXCEPTION 'klaim ulang bukan job uji';
  END IF;
  SELECT claim_token, status INTO v_token_b, v_status
  FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'claimed' OR v_token_b IS NULL OR v_token_b = v_token_a THEN
    RAISE EXCEPTION 'token tidak diganti saat klaim ulang';
  END IF;

  BEGIN
    PERFORM public.ai_employee_job_finish(
      v_ai, v_job, v_run_a, 'done', '', NULL, 'Plan klaim lama', 'tidak boleh', v_token_a
    );
    RAISE EXCEPTION 'token lama menutup job';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'claimed' THEN
    RAISE EXCEPTION 'token lama mengubah status job: %', v_status;
  END IF;

  v_payload := public.ai_employee_job_take(v_ai, v_job);
  IF NULLIF(v_payload->>'claim_token', '')::uuid IS DISTINCT FROM v_token_b THEN
    RAISE EXCEPTION 'take kedua mengembalikan token lama';
  END IF;
  v_run_b := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_job_bind(v_ai, v_job, v_run_b, v_token_b);

  BEGIN
    PERFORM public.ai_employee_perform(
      v_ai,
      v_run_a,
      'content.plans.create',
      jsonb_build_object(
        'title', 'Plan klaim lama',
        'brief', 'tidak boleh',
        'post_date', '2026-11-09',
        'claim_token', v_token_a
      )
    );
    RAISE EXCEPTION 'token lama membuat plan';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  BEGIN
    PERFORM public.ai_employee_perform(
      v_ai,
      v_run_b,
      'content.plans.create',
      jsonb_build_object(
        'title', 'Plan klaim rusak',
        'brief', 'tidak boleh',
        'post_date', '2026-11-09',
        'claim_token', 'bukan-uuid'
      )
    );
    RAISE EXCEPTION 'token rusak membuat plan';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  IF EXISTS (
    SELECT 1 FROM public.social_media_plans
    WHERE author_employee_id = v_ai
      AND title IN ('Plan klaim lama', 'Plan klaim rusak')
  ) THEN
    RAISE EXCEPTION 'plan dari klaim lama tersimpan';
  END IF;

  v_payload := public.ai_employee_perform(
    v_ai,
    v_run_b,
    'content.plans.create',
    jsonb_build_object(
      'title', 'Plan klaim baru',
      'brief', 'boleh',
      'post_date', '2026-11-09',
      'claim_token', v_token_b
    )
  );
  v_plan_id := NULLIF(v_payload->>'id', '')::uuid;
  IF v_payload->>'ok' IS DISTINCT FROM 'true' OR v_plan_id IS NULL THEN
    RAISE EXCEPTION 'token baru tidak membuat plan';
  END IF;

  BEGIN
    PERFORM public.ai_employee_job_finish(
      v_ai, v_job, v_run_a, 'failed', 'lama', NULL, '', '', v_token_a
    );
    RAISE EXCEPTION 'token lama menutup job yang sedang berjalan';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'job tertutup oleh token lama: %', v_status;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.task_steps WHERE task_id = v_token_task
  ) THEN
    RAISE EXCEPTION 'token lama menulis langkah task';
  END IF;

  PERFORM public.ai_employee_job_finish(
    v_ai, v_job, v_run_b, 'done', '', v_plan_id, 'Plan klaim baru', 'boleh', v_token_b
  );
  SELECT status INTO v_status FROM public.daily_tasks WHERE id = v_token_task;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'task ditandai selesai sendiri: %', v_status;
  END IF;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'done' THEN
    RAISE EXCEPTION 'token baru tidak menutup job: %', v_status;
  END IF;

  BEGIN
    PERFORM public.ai_employee_job_finish(
      v_ai, v_job, v_run_a, 'failed', 'lama', NULL, '', '', v_token_a
    );
    RAISE EXCEPTION 'token lama menutup job yang sudah selesai';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'done' THEN
    RAISE EXCEPTION 'status akhir berubah: %', v_status;
  END IF;

  IF to_regprocedure('public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'finish tanpa token masih ada';
  END IF;
  IF to_regprocedure('public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'finish dengan token tidak ada';
  END IF;
  IF NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_take(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_perform(uuid,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'runner tidak punya pintu klaim';
  END IF;
  IF has_function_privilege('anon', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_perform(uuid,uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('ai_employee_runner', 'public.ai_employee_assert_job_claim(uuid,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_queue_actor_reason(uuid,uuid,uuid,uuid,boolean)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_caller_is_service()', 'EXECUTE') THEN
    RAISE EXCEPTION 'pintu klaim terbuka di luar runner';
  END IF;
  IF has_table_privilege('anon', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('service_role', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('ai_employee_runner', 'public.ai_employee_jobs', 'SELECT') THEN
    RAISE EXCEPTION 'tabel antrean bisa dibaca langsung';
  END IF;
END;
$test$;
