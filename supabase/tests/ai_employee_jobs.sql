-- Badan uji antrean tugas AI. Dipakai di dalam ai_employee_jobs_dryrun.sql.
-- Tidak punya BEGIN atau ROLLBACK sendiri. Jangan panggil ai_employee_dispatch di sini.

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

CREATE OR REPLACE FUNCTION pg_temp.claim_one(p_at timestamptz, p_exclude uuid[] DEFAULT '{}'::uuid[])
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
    FROM public.ai_employee_claim_due_jobs(p_at, p_exclude) claimed
  LOOP
    v_count := v_count + 1;
    v_id := v_row.job_id;
  END LOOP;
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'klaim % menghasilkan % job', p_at, v_count;
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
  v_disabled uuid := gen_random_uuid();
  v_member_task uuid := gen_random_uuid();
  v_reviewer_task uuid := gen_random_uuid();
  v_medium_task uuid := gen_random_uuid();
  v_urgent_task uuid := gen_random_uuid();
  v_request_task uuid := gen_random_uuid();
  v_member_request uuid := gen_random_uuid();
  v_disabled_task uuid := gen_random_uuid();
  v_defer_task uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_done_plan uuid := gen_random_uuid();
  v_job uuid;
  v_seen_emp uuid;
  v_seen_task uuid;
  v_count integer;
  v_attempts integer;
  v_status text;
  v_priority text;
  v_reason text;
  v_title text;
  v_brief text;
  v_approved boolean;
  v_payload jsonb;
  v_when timestamptz;
  v_morning timestamptz;
BEGIN
  IF public.ai_employee_in_work_hours('Asia/Jakarta', '2026-11-07 10:00:00+07') THEN
    RAISE EXCEPTION 'sabtu terhitung jam kerja';
  END IF;
  IF NOT public.ai_employee_in_work_hours('Asia/Jakarta', '2026-11-02 08:00:00+07') THEN
    RAISE EXCEPTION 'senin 08:00 di luar jam kerja';
  END IF;
  IF NOT public.ai_employee_in_work_hours('Asia/Jakarta', '2026-11-02 16:59:00+07') THEN
    RAISE EXCEPTION 'senin 16:59 di luar jam kerja';
  END IF;
  IF public.ai_employee_in_work_hours('Asia/Jakarta', '2026-11-02 17:00:00+07') THEN
    RAISE EXCEPTION 'senin 17:00 masih jam kerja';
  END IF;
  IF public.ai_employee_in_work_hours('Not/AZone', '2026-11-07 10:00:00+07') THEN
    RAISE EXCEPTION 'zona tidak dikenal tidak jatuh ke Jakarta';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'jobs-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'jobs-member@example.com');
  PERFORM pg_temp.insert_auth_user(v_reviewer_user, 'jobs-reviewer@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Job Queue Uji', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_owner, v_org, 'owner'),
    (v_member, v_org, 'employee'),
    (v_reviewer_user, v_org, 'employee');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_owner_emp, v_org, 'Owner Uji', v_owner, false),
    (v_member_emp, v_org, 'Anggota Uji', v_member, false),
    (v_reviewer, v_org, 'Reviewer Uji', v_reviewer_user, false),
    (v_ai, v_org, 'Naya Uji', NULL, true),
    (v_disabled, v_org, 'Naya Mati', NULL, true);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, reviewer_employee_id, time_zone, is_active, performance_status
  ) VALUES
    (v_ai, v_org, v_reviewer, 'Asia/Jakarta', true, 'on_track'),
    (v_disabled, v_org, v_reviewer, 'Asia/Jakarta', true, 'disabled');

  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES
    (v_member_task, v_org, 'Buat content plan anggota', 'konten', 'medium', v_member),
    (v_reviewer_task, v_org, 'Buat content plan reviewer', 'konten', 'low', v_reviewer_user),
    (v_medium_task, v_org, 'Buat content plan biasa', 'konten', 'medium', v_owner),
    (v_urgent_task, v_org, 'Buat content plan mendesak', 'konten', 'urgent', v_owner),
    (v_disabled_task, v_org, 'Buat content plan mati', 'konten', 'urgent', v_owner),
    (v_member_request, v_org, 'Buat content plan minta anggota', 'konten', 'high', v_member);

  UPDATE public.daily_tasks
  SET requested_ai_employee_id = v_ai
  WHERE id = v_member_request;

  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_member_request;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'permintaan anggota tidak ditolak';
  END IF;

  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_member_task, v_ai, v_member_emp);

  IF NOT EXISTS (SELECT 1 FROM public.daily_tasks WHERE id = v_member_task)
     OR NOT EXISTS (
       SELECT 1 FROM public.daily_tasks_assigned
       WHERE daily_task_id = v_member_task AND employee_id = v_ai
     ) THEN
    RAISE EXCEPTION 'tugas anggota tidak tersimpan';
  END IF;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_member_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'assignment anggota tidak ditolak';
  END IF;

  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES
    (v_org, v_reviewer_task, v_ai, v_reviewer),
    (v_org, v_medium_task, v_ai, v_owner_emp),
    (v_org, v_urgent_task, v_ai, v_owner_emp),
    (v_org, v_disabled_task, v_disabled, v_owner_emp);

  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_medium_task, v_ai, v_owner_emp);

  SELECT count(*) INTO v_count
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_medium_task;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'satu tugas masuk antrean dua kali: %', v_count;
  END IF;

  SELECT status, priority INTO v_status, v_priority
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_reviewer_task;
  IF v_status IS DISTINCT FROM 'queued' OR v_priority IS DISTINCT FROM 'low' THEN
    RAISE EXCEPTION 'reviewer tidak boleh mengantre';
  END IF;

  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_request_task, v_org, 'Buat content plan permintaan', 'konten', 'low', v_owner, v_ai
  );
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE daily_task_id = v_request_task;
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'permintaan owner tidak masuk antrean';
  END IF;
  UPDATE public.ai_employee_jobs
  SET status = 'done', finished_at = clock_timestamp()
  WHERE daily_task_id = v_request_task;

  UPDATE public.ai_employee_jobs
  SET next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE organization_id = v_org
    AND status = 'queued';

  v_job := pg_temp.claim_one('2026-11-07 10:00:00+07'::timestamptz);
  SELECT priority, status, employee_id, daily_task_id
  INTO v_priority, v_status, v_seen_emp, v_seen_task
  FROM public.ai_employee_jobs
  WHERE id = v_job;
  IF v_priority IS DISTINCT FROM 'urgent' OR v_status IS DISTINCT FROM 'claimed' OR v_seen_emp IS DISTINCT FROM v_ai THEN
    RAISE EXCEPTION 'yang diklaim sabtu bukan urgent Naya aktif';
  END IF;
  IF v_seen_task IS DISTINCT FROM v_urgent_task THEN
    RAISE EXCEPTION 'job sabtu bukan tugas urgent';
  END IF;

  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE daily_task_id = v_medium_task;
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'tugas biasa diklaim di luar jam kerja';
  END IF;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE daily_task_id = v_disabled_task;
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'profil disabled ikut diklaim';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.ai_employee_claim_due_jobs('2026-11-07 10:00:00+07'::timestamptz);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'job yang sama diklaim dua kali';
  END IF;

  PERFORM public.ai_employee_requeue_stuck_jobs('2026-11-07 10:16:00+07'::timestamptz);
  SELECT attempts, status INTO v_attempts, v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_attempts IS DISTINCT FROM 1 OR v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'job macet tidak kembali ke antrean';
  END IF;

  v_job := pg_temp.claim_one('2026-11-07 10:16:00+07'::timestamptz);
  PERFORM public.ai_employee_requeue_stuck_jobs('2026-11-07 10:32:00+07'::timestamptz);
  SELECT attempts INTO v_attempts FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_attempts IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'percobaan kedua bukan 2';
  END IF;

  v_job := pg_temp.claim_one('2026-11-07 10:32:00+07'::timestamptz);
  PERFORM public.ai_employee_requeue_stuck_jobs('2026-11-07 10:48:00+07'::timestamptz);
  SELECT attempts, status, reason INTO v_attempts, v_status, v_reason
  FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_attempts IS DISTINCT FROM 3 OR v_status IS DISTINCT FROM 'failed' OR v_reason NOT LIKE 'Job macet 3 kali%' THEN
    RAISE EXCEPTION 'job macet ketiga tidak gagal';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_task_notifications
    WHERE user_id = v_reviewer_user AND title = 'Job karyawan AI gagal' AND daily_task_id = v_urgent_task
  ) THEN
    RAISE EXCEPTION 'reviewer tidak diberitahu job gagal';
  END IF;

  v_job := pg_temp.claim_one('2026-11-02 10:00:00+07'::timestamptz);
  SELECT priority, daily_task_id INTO v_priority, v_seen_task
  FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_priority IS DISTINCT FROM 'medium' OR v_seen_task IS DISTINCT FROM v_medium_task THEN
    RAISE EXCEPTION 'senin tidak mendahulukan medium';
  END IF;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE daily_task_id = v_reviewer_task;
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'low ikut diklaim sebelum medium selesai';
  END IF;

  v_payload := public.ai_employee_job_take(v_ai, v_job);
  IF v_payload->>'source' IS DISTINCT FROM 'task' THEN
    RAISE EXCEPTION 'take tidak mengembalikan task';
  END IF;
  BEGIN
    PERFORM public.ai_employee_job_take(v_ai, v_job);
    RAISE EXCEPTION 'take kedua harus gagal';
  EXCEPTION
    WHEN no_data_found THEN
      NULL;
  END;

  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, post_date, author_employee_id, status
  ) VALUES (
    v_done_plan, v_org, 'Plan tugas', 'Brief lama', '2026-11-09 00:00:00+07', v_ai, 'draft'
  );
  PERFORM public.ai_employee_job_finish(
    v_ai, v_job, NULL, 'done', '', v_done_plan, 'Judul tugas', 'Brief tugas'
  );
  SELECT status INTO v_status FROM public.daily_tasks WHERE id = v_medium_task;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'task ditandai selesai sendiri: %', v_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.task_steps
    WHERE task_id = v_medium_task AND social_media_plan_id = v_done_plan
  ) THEN
    RAISE EXCEPTION 'langkah task tidak menyimpan plan';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.completion_approvals
    WHERE daily_task_id = v_medium_task AND status = 'pending' AND assignee_employee_id = v_ai
  ) THEN
    RAISE EXCEPTION 'tidak ada permintaan selesai';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.ai_employee_claim_due_jobs('2026-11-02 18:00:00+07'::timestamptz);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'low diklaim di luar jam kerja';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.ai_employee_claim_due_jobs('2026-11-02 10:00:00+07'::timestamptz, ARRAY[v_ai]::uuid[]);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'job diklaim padahal karyawan sedang jadwal SOP1';
  END IF;

  v_job := pg_temp.claim_one('2026-11-02 10:00:00+07'::timestamptz);
  SELECT daily_task_id INTO v_seen_task FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_seen_task IS DISTINCT FROM v_reviewer_task THEN
    RAISE EXCEPTION 'low tidak diklaim pada jam kerja';
  END IF;
  PERFORM public.ai_employee_job_take(v_ai, v_job);
  PERFORM public.ai_employee_job_finish(
    v_ai, v_job, NULL, 'rejected', 'Instruksi ini masuk wilayah payroll.', NULL, '', ''
  );
  SELECT status INTO v_status FROM public.daily_tasks WHERE id = v_reviewer_task;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'task di luar job desk ditandai selesai';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.task_steps
    WHERE task_id = v_reviewer_task AND title = 'Di luar job desk'
  ) THEN
    RAISE EXCEPTION 'alasan di luar job desk tidak ditulis ke langkah';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.completion_approvals WHERE daily_task_id = v_reviewer_task
  ) THEN
    RAISE EXCEPTION 'penolakan job desk tetap minta selesai';
  END IF;

  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, post_date, author_employee_id, status, approved
  ) VALUES (
    v_plan, v_org, 'Plan ditolak', 'Brief awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false
  );
  INSERT INTO public.ai_employee_feedback (
    employee_id, organization_id, object_type, object_id, reason, reviewer_employee_id
  ) VALUES (
    v_ai, v_org, 'plan', v_plan, 'Hook kurang kuat', v_reviewer
  );
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs
  WHERE plan_id = v_plan AND source = 'revision';
  IF v_status IS DISTINCT FROM 'queued' OR v_reason NOT LIKE '%Hook kurang kuat%' THEN
    RAISE EXCEPTION 'revisi pertama tidak masuk antrean';
  END IF;
  UPDATE public.ai_employee_jobs
  SET next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE plan_id = v_plan AND status = 'queued';
  v_job := pg_temp.claim_one('2026-11-02 10:00:00+07'::timestamptz);
  PERFORM public.ai_employee_job_take(v_ai, v_job);
  PERFORM public.ai_employee_job_finish(
    v_ai, v_job, NULL, 'done', '', NULL, 'Judul revisi 1', 'Brief revisi 1'
  );
  SELECT title, brief, status, approved INTO v_title, v_brief, v_status, v_approved
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_title IS DISTINCT FROM 'Judul revisi 1' OR v_brief IS DISTINCT FROM 'Brief revisi 1' THEN
    RAISE EXCEPTION 'plan tidak terbarui';
  END IF;
  IF v_status IS DISTINCT FROM 'Request Revision' OR v_approved THEN
    RAISE EXCEPTION 'revisi mengubah status persetujuan';
  END IF;

  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 2
  WHERE id = v_plan;
  UPDATE public.ai_employee_jobs
  SET next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE plan_id = v_plan AND status = 'queued';
  v_job := pg_temp.claim_one('2026-11-02 10:00:00+07'::timestamptz);
  PERFORM public.ai_employee_job_take(v_ai, v_job);
  PERFORM public.ai_employee_job_finish(
    v_ai, v_job, NULL, 'done', '', NULL, 'Judul revisi 2', 'Brief revisi 2'
  );

  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 3
  WHERE id = v_plan;
  IF EXISTS (
    SELECT 1 FROM public.ai_employee_jobs
    WHERE plan_id = v_plan AND source = 'revision' AND status = 'queued'
  ) THEN
    RAISE EXCEPTION 'revisi ketiga masih dikerjakan';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.ai_employee_jobs
  WHERE plan_id = v_plan AND source = 'revision' AND status = 'done';
  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'revisi selesai bukan 2: %', v_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_employee_jobs
    WHERE plan_id = v_plan AND status = 'rejected' AND reason LIKE 'Revisi sudah 2 kali%'
  ) THEN
    RAISE EXCEPTION 'revisi ketiga tidak ditolak';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.plan_status_change_notifications
    WHERE user_id = v_reviewer_user AND social_media_plan_id = v_plan AND title = 'Revisi plan berhenti'
  ) THEN
    RAISE EXCEPTION 'reviewer tidak diberitahu revisi berhenti';
  END IF;

  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_defer_task, v_org, 'Buat content plan tunda', 'konten', 'urgent', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_defer_task, v_ai, v_owner_emp);
  UPDATE public.ai_employee_jobs
  SET next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE daily_task_id = v_defer_task;
  v_job := pg_temp.claim_one('2026-11-07 12:00:00+07'::timestamptz);
  PERFORM public.ai_employee_job_take(v_ai, v_job);
  PERFORM public.ai_employee_job_finish(v_ai, v_job, NULL, 'deferred', 'Kuota model habis.', NULL, '', '');
  v_morning := public.ai_employee_next_morning('Asia/Jakarta', clock_timestamp());
  SELECT status, next_attempt_at INTO v_status, v_when
  FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'deferred' OR v_when IS DISTINCT FROM v_morning THEN
    RAISE EXCEPTION 'kuota tidak menunda ke besok 08:00';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_task_notifications
    WHERE user_id = v_reviewer_user AND daily_task_id = v_defer_task AND title = 'Job ditunda'
  ) THEN
    RAISE EXCEPTION 'reviewer tidak diberitahu kuota';
  END IF;

  INSERT INTO public.ai_employee_schedules (
    employee_id, organization_id, sop_code, weekday, start_local, due_local, is_active
  ) VALUES (
    v_ai, v_org, 'SOP1', 5, time '15:00', time '17:00', true
  );
  UPDATE public.ai_employee_schedules
  SET last_claimed_at = '2026-11-07 10:00:00+07'
  WHERE employee_id = v_ai AND sop_code = 'SOP1';
  SELECT public.ai_employee_notify_missed_sop1('2026-11-07 10:16:00+07'::timestamptz) INTO v_count;
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'alarm SOP1 tidak terkirim: %', v_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_task_notifications
    WHERE user_id = v_reviewer_user AND title = 'SOP1 tidak berjalan'
  ) THEN
    RAISE EXCEPTION 'notifikasi SOP1 tidak ada';
  END IF;
  SELECT public.ai_employee_notify_missed_sop1('2026-11-07 10:17:00+07'::timestamptz) INTO v_count;
  IF v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'alarm SOP1 terkirim dua kali';
  END IF;

  UPDATE public.ai_employee_schedules
  SET last_claimed_at = '2026-11-07 12:00:00+07'
  WHERE employee_id = v_ai AND sop_code = 'SOP1';
  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status, started_at)
  VALUES (v_ai, v_org, 'SOP1', 'running', '2026-11-07 12:01:00+07');
  SELECT public.ai_employee_notify_missed_sop1('2026-11-07 12:20:00+07'::timestamptz) INTO v_count;
  IF v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'SOP1 yang punya log tetap dianggap terlewat';
  END IF;

  v_payload := public.mcp_list_ai_employee_jobs(v_owner, v_org, v_ai);
  IF jsonb_typeof(v_payload) IS DISTINCT FROM 'array' OR jsonb_array_length(v_payload) < 1 THEN
    RAISE EXCEPTION 'daftar antrean kosong';
  END IF;
  BEGIN
    PERFORM public.mcp_list_ai_employee_jobs(v_member, v_org, v_ai);
    RAISE EXCEPTION 'anggota bisa membaca antrean';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  v_payload := public.mcp_ai_employee_job_counts(
    v_owner,
    v_org,
    v_ai,
    LEAST(clock_timestamp() - interval '1 day', '2026-11-07 00:00:00+07'::timestamptz),
    GREATEST(clock_timestamp() + interval '1 day', '2026-11-08 00:00:00+07'::timestamptz)
  );
  IF COALESCE((v_payload->>'done')::integer, 0) < 2
     OR COALESCE((v_payload->>'rejected')::integer, 0) < 1
     OR COALESCE((v_payload->>'failed')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'hitungan job salah: %', v_payload;
  END IF;

  IF has_function_privilege('anon', 'public.ai_employee_dispatch()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_dispatch()', 'EXECUTE')
     OR has_function_privilege('ai_employee_runner', 'public.ai_employee_dispatch()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_dispatch()', 'EXECUTE') THEN
    RAISE EXCEPTION 'dispatch terbuka';
  END IF;
  IF has_table_privilege('anon', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('service_role', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('ai_employee_runner', 'public.ai_employee_jobs', 'SELECT') THEN
    RAISE EXCEPTION 'tabel antrean bisa dibaca langsung';
  END IF;
  IF NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_take(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'runner tidak punya pintu job';
  END IF;
  IF has_function_privilege('service_role', 'public.ai_employee_job_take(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'pintu job terbuka di luar runner';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.mcp_list_ai_employee_jobs(uuid,uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.mcp_ai_employee_job_counts(uuid,uuid,uuid,timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role tidak punya daftar antrean';
  END IF;
  IF has_function_privilege('ai_employee_runner', 'public.mcp_list_ai_employee_jobs(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ai_employee_job_put(uuid,uuid,text,uuid,uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'fungsi dalam terbuka';
  END IF;
END;
$test$;
