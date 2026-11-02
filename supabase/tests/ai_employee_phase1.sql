-- Uji migration AI Employee fase 1 pada Supabase lokal.
-- Gagal dengan RAISE EXCEPTION. Transaksi di-rollback agar tidak menyisakan data.
--
-- psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/ai_employee_phase1.sql

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

  IF to_regclass('auth.identities') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = p_id) THEN
    BEGIN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        p_id,
        jsonb_build_object('sub', p_id::text, 'email', p_email),
        'email',
        p_id::text,
        now(),
        now()
      );
    EXCEPTION
      WHEN undefined_column OR not_null_violation THEN
        NULL;
    END;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.assert_denied(p_sql text, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected % but the statement succeeded', p_message;
EXCEPTION
  WHEN insufficient_privilege THEN
    IF SQLERRM IS DISTINCT FROM p_message THEN
      RAISE EXCEPTION 'expected "%" but got "%"', p_message, SQLERRM;
    END IF;
END;
$fn$;

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_human uuid := gen_random_uuid();
  v_human_b uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_ai_b uuid := gen_random_uuid();
  v_other_ai uuid := gen_random_uuid();
  v_disposable uuid := gen_random_uuid();
  v_alt_reviewer uuid := gen_random_uuid();
  v_run uuid;
  v_other_run uuid;
  v_closed uuid;
  v_plan uuid;
  v_day text;
  v_friday date;
  v_start timestamptz;
  v_on_time timestamptz;
  v_late timestamptz;
  v_task uuid;
  v_cycle uuid;
  v_objective uuid;
  v_keep_org uuid;
  v_keep_author uuid;
  v_count integer;
  v_status text;
  v_context jsonb;
  v_rows integer;
  v_progress numeric;
  v_metric text;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_owner, 'ai-employee-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'ai-employee-member@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES
    (v_org, 'AI Employee Test Org', 'software', v_owner),
    (v_org_b, 'AI Employee Other Org', 'software', v_owner);

  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_owner, v_org), (v_member, v_org), (v_owner, v_org_b);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_owner, v_org, 'owner'),
    (v_member, v_org, 'employee'),
    (v_owner, v_org_b, 'owner');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_human, v_org, 'Reviewer Uji', v_owner, false),
    (v_alt_reviewer, v_org, 'Reviewer Lain Org Sama', v_owner, false),
    (v_human_b, v_org_b, 'Reviewer Org Lain', v_owner, false),
    (v_ai, v_org, 'Karyawan AI Uji', NULL, true),
    (v_ai_b, v_org_b, 'Karyawan AI Org Lain', NULL, true),
    (v_other_ai, v_org, 'Karyawan AI Kedua', NULL, true),
    (v_disposable, v_org, 'Karyawan AI Hapus', NULL, true);

  BEGIN
    INSERT INTO public.ai_employee_profiles (employee_id, organization_id)
    VALUES (v_ai, v_org_b);
    RAISE EXCEPTION 'cross-org profile should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.ai_employee_profiles (employee_id, organization_id, reviewer_employee_id)
    VALUES (v_ai, v_org, v_human_b);
    RAISE EXCEPTION 'cross-org reviewer should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.social_media_plans (organization_id, title, author_employee_id)
    VALUES (v_org_b, 'Plan lintas org', v_ai);
    RAISE EXCEPTION 'cross-org plan should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.daily_tasks (organization_id, title, requested_ai_employee_id)
    VALUES (v_org_b, 'Tugas lintas org', v_ai);
    RAISE EXCEPTION 'cross-org task should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, reviewer_employee_id, is_active, performance_status
  ) VALUES
    (v_ai, v_org, v_human, true, 'on_track'),
    (v_other_ai, v_org, v_human, true, 'on_track'),
    (v_disposable, v_org, v_human, true, 'on_track');

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    INSERT INTO public.ai_employee_feedback (
      employee_id, organization_id, object_type, reason, reviewer_employee_id
    ) VALUES (
      v_ai, v_org, 'plan', 'Reviewer bukan di profil', v_alt_reviewer
    );
    RAISE EXCEPTION 'feedback from a different reviewer should fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%row-level security%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.ai_employee_feedback (
    employee_id, organization_id, object_type, reason, reviewer_employee_id
  ) VALUES (
    v_ai, v_org, 'plan', 'Masukan reviewer profil', v_human
  );
  EXECUTE 'RESET ROLE';

  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_feedback
    WHERE employee_id = v_ai
      AND reviewer_employee_id = v_human
      AND reason = 'Masukan reviewer profil'
  ) THEN
    RAISE EXCEPTION 'profile reviewer feedback was not stored';
  END IF;

  INSERT INTO public.social_media_plans (organization_id, title, author_employee_id, production_status)
  VALUES (v_org, 'Plan yang org-nya harus tetap', v_disposable, 'Need Review')
  RETURNING id, organization_id, author_employee_id
  INTO v_plan, v_keep_org, v_keep_author;

  INSERT INTO public.daily_tasks (organization_id, title, requested_ai_employee_id)
  VALUES (v_org, 'Tugas yang org-nya harus tetap', v_disposable)
  RETURNING id INTO v_task;

  DELETE FROM public.employees WHERE id = v_disposable;

  SELECT organization_id, author_employee_id
  INTO v_keep_org, v_keep_author
  FROM public.social_media_plans
  WHERE id = v_plan;

  IF v_keep_org IS DISTINCT FROM v_org OR v_keep_author IS NOT NULL THEN
    RAISE EXCEPTION 'deleting AI employee nulled organization or kept author: org=% author=%', v_keep_org, v_keep_author;
  END IF;

  SELECT organization_id, requested_ai_employee_id
  INTO v_keep_org, v_keep_author
  FROM public.daily_tasks
  WHERE id = v_task;

  IF v_keep_org IS DISTINCT FROM v_org OR v_keep_author IS NOT NULL THEN
    RAISE EXCEPTION 'deleting AI employee nulled task organization or kept requester: org=% requester=%', v_keep_org, v_keep_author;
  END IF;

  v_count := public.count_active_employees_for_org(v_org);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'human employees should be counted and AI employees excluded, got %', v_count;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member)::text, true);
  PERFORM pg_temp.assert_denied(
    format('SELECT public.ai_employee_set_performance_status(%L, %L)', v_ai, 'attention'),
    'owner_required'
  );

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);
  PERFORM public.ai_employee_set_performance_status(v_ai, 'attention');

  SELECT performance_status INTO v_status
  FROM public.ai_employee_profiles
  WHERE employee_id = v_ai;
  IF v_status IS DISTINCT FROM 'attention' THEN
    RAISE EXCEPTION 'owner function did not set status, got %', v_status;
  END IF;

  PERFORM pg_temp.assert_denied(
    format('UPDATE public.ai_employee_profiles SET performance_status = %L WHERE employee_id = %L', 'coaching', v_ai),
    'performance_status_locked'
  );

  PERFORM set_config('ai_employee.status_write', 'forged-token', true);
  PERFORM pg_temp.assert_denied(
    format('UPDATE public.ai_employee_profiles SET performance_status = %L WHERE employee_id = %L', 'disabled', v_ai),
    'performance_status_locked'
  );

  SELECT performance_status INTO v_status
  FROM public.ai_employee_profiles
  WHERE employee_id = v_ai;
  IF v_status IS DISTINCT FROM 'attention' THEN
    RAISE EXCEPTION 'direct update changed performance_status to %', v_status;
  END IF;

  PERFORM public.ai_employee_set_performance_status(v_ai, 'on_track');

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  SELECT v_ai, v_org, action_code
  FROM unnest(ARRAY[
    'content.plans.create',
    'content.plans.update',
    'content.briefs.create',
    'thinking.plan.save',
    'thinking.plan.direct',
    'thinking.execution.check',
    'tasks.update',
    'tasks.steps.create',
    'tasks.steps.update',
    'tasks.substeps.create',
    'tasks.completion.request'
  ]) AS action_code;

  v_day := to_char((timezone('Asia/Jakarta', now()))::date, 'YYYY-MM-DD');
  v_run := public.ai_employee_run_start(v_ai, 'SOP2');
  v_other_run := public.ai_employee_run_start(v_other_ai, 'SOP2');

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_other_ai, v_run, 'content.plans.create',
      format('{"title":"Milik orang lain","post_date":"%s"}', v_day)
    ),
    'run_not_running'
  );

  v_closed := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_run_finish(v_ai, v_closed, 'succeeded', 0, 0, NULL, NULL);
  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_closed, 'content.plans.create',
      format('{"title":"Run selesai","post_date":"%s"}', v_day)
    ),
    'run_not_running'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.schedule', '{}'
    ),
    'action_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'finance.report.read', '{}'
    ),
    'action_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.create',
      format('{"title":"Jangan disetujui","post_date":"%s","approved":true}', v_day)
    ),
    'approval_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.create',
      format('{"title":"Jangan produksi","post_date":"%s","production_approved":true}', v_day)
    ),
    'approval_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.create',
      format('{"title":"Pindah org","post_date":"%s","organization_id":"%s"}', v_day, v_org_b)
    ),
    'organization_mismatch'
  );

  v_plan := (public.ai_employee_perform(
    v_ai, v_run, 'content.plans.create',
    jsonb_build_object('title', 'Rencana uji', 'post_date', v_day, 'brief', 'Uji pintu')
  )->>'id')::uuid;

  SELECT production_status, author_employee_id, organization_id
  INTO v_status, v_keep_author, v_keep_org
  FROM public.social_media_plans
  WHERE id = v_plan;

  IF v_status IS DISTINCT FROM 'Need Review'
    OR v_keep_author IS DISTINCT FROM v_ai
    OR v_keep_org IS DISTINCT FROM v_org
  THEN
    RAISE EXCEPTION 'plan door wrote the wrong attribution or status: %', v_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.social_media_plans
    WHERE id = v_plan AND (approved OR production_approved)
  ) THEN
    RAISE EXCEPTION 'plan door set an approval flag';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text,
    true
  );
  PERFORM pg_temp.assert_denied(
    format(
      'UPDATE public.social_media_plans SET brief = %L WHERE id = %L',
      'Brief curian', v_plan
    ),
    'Only the PIC can edit brief content'
  );

  INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
  VALUES (v_plan, 'tiket-asli');
  PERFORM set_config('ai_employee.brief_write', 'tiket-palsu', true);
  PERFORM pg_temp.assert_denied(
    format(
      'UPDATE public.social_media_plans SET brief = %L WHERE id = %L',
      'Brief tiket palsu', v_plan
    ),
    'Only the PIC can edit brief content'
  );
  PERFORM set_config('ai_employee.brief_write', '', true);
  DELETE FROM public.ai_employee_brief_tickets WHERE plan_id = v_plan;

  IF EXISTS (
    SELECT 1 FROM public.social_media_plans
    WHERE id = v_plan AND brief IS DISTINCT FROM 'Uji pintu'
  ) THEN
    RAISE EXCEPTION 'non-PIC or forged ticket changed the brief';
  END IF;

  PERFORM public.ai_employee_perform(
    v_ai, v_run, 'content.briefs.create',
    jsonb_build_object('plan_id', v_plan, 'brief', 'Brief uji')
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.social_media_plans
    WHERE id = v_plan
      AND brief = 'Brief uji'
      AND production_status = 'Need Review'
      AND author_employee_id = v_ai
  ) THEN
    RAISE EXCEPTION 'brief was not saved on the AI employee plan';
  END IF;

  INSERT INTO public.daily_tasks_assigned (
    organization_id, daily_task_id, employee_id, assigned_by
  )
  SELECT v_org, t.id, v_human, v_human
  FROM public.daily_tasks t
  WHERE t.id = (
    SELECT id FROM public.daily_tasks
    WHERE organization_id = v_org AND title = 'Tugas yang org-nya harus tetap'
  );

  INSERT INTO public.daily_tasks (id, organization_id, title, requested_ai_employee_id)
  VALUES (gen_random_uuid(), v_org, 'Tugas Naya', v_ai)
  RETURNING id INTO v_task;

  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_task, v_ai, v_human);

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'tasks.completion.request',
      format('{"task_id":"%s","status":"approved"}', v_task)
    ),
    'approval_forbidden'
  );

  PERFORM public.ai_employee_perform(
    v_ai, v_run, 'tasks.completion.request',
    jsonb_build_object('task_id', v_task, 'entity_type', 'task')
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.completion_approvals
    WHERE daily_task_id = v_task
      AND status = 'pending'
      AND assignee_employee_id = v_ai
  ) THEN
    RAISE EXCEPTION 'completion request did not stay pending';
  END IF;

  PERFORM pg_temp.assert_denied(
    format('SELECT public.ai_employee_context(%L, %L, %L, %L::jsonb)', v_ai, v_run, 'finance', '{}'),
    'scope_forbidden'
  );

  IF NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_set_performance_status(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.ai_employee_set_performance_status(uuid,text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'runner grants do not match the phase 1 rule';
  END IF;

  IF has_table_privilege('ai_employee_runner', 'public.employees', 'SELECT')
    OR has_table_privilege('ai_employee_runner', 'public.social_media_plans', 'INSERT')
    OR has_table_privilege('ai_employee_runner', 'public.ai_employee_runs', 'SELECT')
  THEN
    RAISE EXCEPTION 'ai_employee_runner has direct table privileges';
  END IF;

  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'ai_employee_runner') THEN
    RAISE EXCEPTION 'ai_employee_runner bypasses RLS';
  END IF;

  EXECUTE 'SET ROLE ai_employee_runner';
  BEGIN
    PERFORM 1 FROM public.employees LIMIT 1;
    RAISE EXCEPTION 'runner select should fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  v_context := public.ai_employee_context(v_ai, v_run, 'plans', '{}'::jsonb);
  EXECUTE 'RESET ROLE';

  IF v_context->>'organization_id' IS DISTINCT FROM v_org::text
    OR jsonb_array_length(v_context->'rows') < 1
  THEN
    RAISE EXCEPTION 'runner context did not return the owned plan: %', v_context;
  END IF;

  INSERT INTO public.daily_task_completion_push_queue (
    organization_id, recipient_user_id, event_type, entity_type, daily_task_id, title
  ) VALUES
    (v_org, v_owner, 'completed', 'task', NULL, 'Selesai lama'),
    (v_org, v_owner, 'rejected', 'task', NULL, 'Ditolak lama'),
    (v_org, v_owner, 'run_failed', 'ai_run', NULL, 'Gagal baru'),
    (v_org, v_owner, 'run_late', 'ai_run', NULL, 'Terlambat baru'),
    (v_org, v_owner, 'run_deferred', 'ai_run', NULL, 'Tertunda baru'),
    (v_org, v_owner, 'revision_returned', 'ai_run', NULL, 'Revisi baru');

  BEGIN
    INSERT INTO public.daily_task_completion_push_queue (
      organization_id, recipient_user_id, event_type, entity_type, title
    ) VALUES (v_org, v_owner, 'not-an-event', 'task', 'Tidak sah');
    RAISE EXCEPTION 'unknown event should fail';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  v_closed := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_run_finish(v_ai, v_closed, 'failed', 1, 0, NULL, 'uji gagal');

  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_task_completion_push_queue
    WHERE recipient_user_id = v_owner
      AND event_type = 'run_failed'
      AND entity_type = 'ai_run'
      AND daily_task_id IS NULL
  ) THEN
    RAISE EXCEPTION 'run_failed notification was not queued';
  END IF;

  INSERT INTO public.okr_cycles (id, organization_id, name, year)
  VALUES (gen_random_uuid(), v_org, 'Siklus uji', 2026)
  RETURNING id INTO v_cycle;

  INSERT INTO public.individual_objectives (
    id, organization_id, cycle_id, employee_id, title, created_by
  ) VALUES (
    gen_random_uuid(), v_org, v_cycle, v_ai, 'KPI uji', v_owner
  )
  RETURNING id INTO v_objective;

  INSERT INTO public.key_results (
    title, individual_objective_id, ai_kr_code, weight, metric_type, progress_percentage
  ) VALUES
    ('KR1', v_objective, 'KR1', 1, 'percentage', 0),
    ('KR3', v_objective, 'KR3', 1, 'percentage', 0);

  v_friday := (timezone('Asia/Jakarta', now()))::date
    - ((EXTRACT(ISODOW FROM timezone('Asia/Jakarta', now()))::int - 5 + 7) % 7);
  v_start := (v_friday::timestamp + time '15:00') AT TIME ZONE 'Asia/Jakarta';
  v_on_time := (v_friday::timestamp + time '16:00') AT TIME ZONE 'Asia/Jakarta';
  v_late := (v_friday::timestamp + time '18:00') AT TIME ZONE 'Asia/Jakarta';

  INSERT INTO public.ai_employee_runs (
    employee_id, organization_id, sop_code, status, started_at, finished_at
  ) VALUES
    (v_ai, v_org, 'SOP1', 'succeeded', v_start, v_on_time),
    (v_ai, v_org, 'SOP1', 'late', v_start, v_late);

  PERFORM public.ai_employee_refresh_krs(v_ai);

  SELECT progress_percentage INTO v_progress
  FROM public.key_results
  WHERE individual_objective_id = v_objective AND ai_kr_code = 'KR1';
  IF v_progress IS DISTINCT FROM 50 THEN
    RAISE EXCEPTION 'KR1 expected 50, got %', v_progress;
  END IF;

  SELECT metric_type, progress_percentage INTO v_metric, v_progress
  FROM public.key_results
  WHERE individual_objective_id = v_objective AND ai_kr_code = 'KR3';
  IF v_metric IS DISTINCT FROM 'unrated' OR v_progress IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'KR3 should stay unrated, got % %', v_metric, v_progress;
  END IF;

  SELECT progress_percentage INTO v_progress
  FROM public.individual_objectives
  WHERE id = v_objective;
  IF v_progress IS DISTINCT FROM 50 THEN
    RAISE EXCEPTION 'unrated KR3 should not lower the objective, got %', v_progress;
  END IF;

  RAISE NOTICE 'AI_EMPLOYEE_PHASE1_OK';
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;

ROLLBACK;
