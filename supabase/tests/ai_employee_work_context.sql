-- Badan uji konteks kerja. Dipakai di dalam ai_employee_work_context_dryrun.sql.
-- Tidak punya BEGIN, COMMIT, atau ROLLBACK sendiri.

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
  v_human uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_persona uuid := gen_random_uuid();
  v_pillar uuid := gen_random_uuid();
  v_master uuid := gen_random_uuid();
  v_thought uuid := gen_random_uuid();
  v_territory uuid := gen_random_uuid();
  v_angle uuid := gen_random_uuid();
  v_idea uuid := gen_random_uuid();
  v_extra uuid;
  v_human_ex uuid := gen_random_uuid();
  v_ai_ex uuid;
  v_i integer;
  v_run uuid;
  v_rows jsonb;
  v_saved jsonb;
  v_check jsonb;
  v_plan jsonb;
  v_checks jsonb;
BEGIN
  IF to_regprocedure('public.ai_employee_brief_read(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'migration 20261103108000 belum diterapkan';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'work-context-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_admin, 'work-context-admin@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Work Context Test', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner'), (v_admin, v_org, 'admin');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_ai, v_org, 'Naya Uji', NULL, true),
    (v_human, v_org, 'PIC Manusia', v_owner, false);

  INSERT INTO public.ai_employee_profiles (employee_id, organization_id, time_zone, is_active, performance_status)
  VALUES (v_ai, v_org, 'Asia/Jakarta', true, 'on_track');

  INSERT INTO public.services (id, organization_id, name, is_active)
  VALUES (v_service, v_org, 'Sate Sultan', true);

  INSERT INTO public.product_knowledge (id, organization_id, feature_name, target_audience)
  VALUES (v_persona, v_org, 'Persona uji', '{"name":"ibu muda"}'::jsonb);

  INSERT INTO public.content_pillars (id, organization_id, name, is_active)
  VALUES (v_pillar, v_org, 'Produk Uji', true);

  INSERT INTO public.social_media_plans (
    organization_id, title, post_date, content_pillar_id, service_id, author_employee_id, pic_id
  ) VALUES
    (v_org, 'Plan Naya', '2026-11-10 00:00:00+07', v_pillar, v_service, v_ai, v_ai),
    (v_org, 'Plan Manusia', '2026-11-09 00:00:00+07', v_pillar, v_service, v_human, v_human),
    (v_org, 'Plan lalu', now(), v_pillar, v_service, v_ai, v_ai);

  INSERT INTO public.thinking_master_thoughts (
    id, organization_id, statement, original_input, status, workspace, canonical_semantic
  ) VALUES (
    v_master, v_org, 'Master uji', 'Master uji', 'locked', 'thinking_lab', '{"subject":"keluarga"}'::jsonb
  );

  INSERT INTO public.thinking_big_thoughts (id, organization_id, master_thought_id, code, title, statement, status)
  VALUES (v_thought, v_org, v_master, 'BT1', 'Big', 'Big uji', 'locked');

  INSERT INTO public.thinking_lab_territories (
    id, organization_id, big_thought_id, code, statement, canonical_semantic, admission
  ) VALUES (
    v_territory, v_org, v_thought, 'TR1', 'Territory uji', '{}'::jsonb, 'GENERATE_VALID'
  );

  INSERT INTO public.thinking_lab_angles (
    id, organization_id, territory_id, code, statement, parent_territory_fingerprint,
    canonical_semantic, admission, status
  ) VALUES (
    v_angle, v_org, v_territory, 'AN1', 'Angle uji', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked'
  );

  INSERT INTO public.thinking_lab_ideas (
    id, organization_id, angle_id, code, statement, parent_angle_fingerprint,
    canonical_semantic, admission, status, validation, updated_at
  ) VALUES (
    v_idea, v_org, v_angle, 'ID1', 'Idea uji', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked',
    '{"decision":"LOLOS"}'::jsonb, now() - interval '30 days'
  );

  v_saved := public.ai_employee_brief_write(
    v_owner, v_org, v_ai,
    jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'audience', 'keluarga',
      'persona_ids', jsonb_build_array(v_persona),
      'voice', 'hangat',
      'required_notes', 'sebut sate',
      'forbidden_notes', 'jangan harga',
      'pillar_ids', jsonb_build_array(v_pillar),
      'split_rule', ''
    )
  );
  IF v_saved->'brief'->'personas'->0->>'audience' IS DISTINCT FROM 'ibu muda' THEN
    RAISE EXCEPTION 'persona brief harus berisi audiens, bukan data lain';
  END IF;
  IF v_saved->'previous'->>'voice' IS DISTINCT FROM '' OR v_saved->'brief'->>'voice' IS DISTINCT FROM 'hangat' THEN
    RAISE EXCEPTION 'brief harus menyimpan isi lama dan baru';
  END IF;

  BEGIN
    PERFORM public.ai_employee_brief_write(v_admin, v_org, v_ai, '{"service_ids":[],"persona_ids":[],"pillar_ids":[]}'::jsonb);
    RAISE EXCEPTION 'admin tidak boleh mengubah brief';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  UPDATE public.user_roles
  SET role = ' Owner '
  WHERE user_id = v_owner AND organization_id = v_org;
  PERFORM public.ai_employee_brief_read(v_owner, v_org, v_ai);
  UPDATE public.user_roles
  SET role = 'owner'
  WHERE user_id = v_owner AND organization_id = v_org;

  v_run := public.ai_employee_run_start(v_ai, 'SOP1');

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'calendar', '{"from":"2026-11-09","to":"2026-11-15"}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 2
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) row WHERE row->>'author_name' = 'PIC Manusia')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) row WHERE row ? 'brief')
  THEN
    RAISE EXCEPTION 'kalender harus memuat plan semua orang, tanpa brief';
  END IF;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'plans', '{"from":"2026-11-09","to":"2026-11-15"}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'scope plans harus tetap hanya plan Naya';
  END IF;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'thinking', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 1
    OR v_rows->0->>'idea_statement' IS DISTINCT FROM 'Idea uji'
    OR v_rows->0->>'master_statement' IS DISTINCT FROM 'Master uji'
    OR v_rows->0->>'big_thought_statement' IS DISTINCT FROM 'Big uji'
    OR v_rows->0->>'territory_statement' IS DISTINCT FROM 'Territory uji'
    OR v_rows->0->>'angle_statement' IS DISTINCT FROM 'Angle uji'
    OR (v_rows->0->>'used')::boolean IS DISTINCT FROM false
    OR v_rows->0 ? 'development_paths'
  THEN
    RAISE EXCEPTION 'thinking harus rantai yang sudah lolos dan belum jadi plan';
  END IF;

  FOR v_i IN 1..8 LOOP
    v_extra := gen_random_uuid();
    INSERT INTO public.thinking_lab_ideas (
      id, organization_id, angle_id, code, statement, parent_angle_fingerprint,
      canonical_semantic, admission, status, validation, updated_at
    ) VALUES (
      v_extra, v_org, v_angle, 'USED' || v_i, 'Idea terpakai ' || v_i, 'fp',
      '{}'::jsonb, 'GENERATE_VALID', 'locked', '{"decision":"LOLOS"}'::jsonb,
      now() - make_interval(hours => v_i)
    );
    INSERT INTO public.social_media_plans (
      organization_id, title, post_date, content_pillar_id, service_id,
      author_employee_id, pic_id, thinking_idea_id
    ) VALUES (
      v_org, 'Plan terpakai ' || v_i, '2026-10-01 00:00:00+07', v_pillar, v_service,
      v_human, v_human, v_extra
    );
  END LOOP;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'thinking', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 8
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) row
      WHERE row->>'idea_id' = v_idea::text
        AND (row->>'used')::boolean = false
    )
  THEN
    RAISE EXCEPTION 'idea lama yang belum dipakai harus tetap muncul';
  END IF;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'performance', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) < 1
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) row
      WHERE row ? 'account_id' OR row ? 'open_id' OR row ? 'email'
    )
  THEN
    RAISE EXCEPTION 'performa harus angka agregat tanpa data pribadi';
  END IF;

  v_check := public.ai_employee_accept_execution(v_org, v_ai, '{"accepted":true}'::jsonb);
  IF (v_check->>'accepted')::boolean IS DISTINCT FROM false OR v_check->>'check_id' IS DISTINCT FROM 'input' THEN
    RAISE EXCEPTION 'accepted true tanpa cek tidak boleh lolos';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('id', id, 'state', 'pass'))
  INTO v_checks
  FROM unnest(ARRAY[
    'hookHolds', 'soundsSpoken', 'usesSlang', 'pillarFits', 'formatHolds',
    'mechanismVisible', 'messageStays', 'causeChain', 'viewerClimb', 'emotionalTone'
  ]) AS id;

  INSERT INTO public.thinking_lab_executions (
    id, organization_id, idea_id, pillar, content_pillar_id, pillar_name,
    statement, canonical_semantic, admission, script
  ) VALUES (
    v_human_ex, v_org, v_idea, v_pillar::text, v_pillar, 'Produk Uji',
    'teks manusia',
    jsonb_build_object(
      'resolution', 'RESOLVED',
      'relationToParent', 'VALID_EXECUTION',
      'unresolvedReasons', '[]'::jsonb
    ),
    'GENERATE_VALID',
    jsonb_build_object('title', 'Manusia')
  );

  v_check := public.ai_employee_accept_execution(v_org, v_ai, jsonb_build_object(
    'idea_id', v_idea,
    'content_pillar_id', v_pillar,
    'statement', 'Makan malam keluarga',
    'checks', v_checks,
    'facts', jsonb_build_object(
      'resolution', 'RESOLVED',
      'relationToParent', 'VALID_EXECUTION',
      'unresolvedReasons', '[]'::jsonb
    ),
    'script', jsonb_build_object('title', 'Makan malam')
  ));
  v_ai_ex := NULLIF(v_check->>'execution_id', '')::uuid;
  IF (v_check->>'accepted')::boolean IS DISTINCT FROM true OR v_ai_ex IS NULL OR v_ai_ex = v_human_ex THEN
    RAISE EXCEPTION 'cek lengkap harus menyimpan execution AI sendiri';
  END IF;

  v_check := public.ai_employee_accept_execution(v_org, v_ai, jsonb_build_object(
    'idea_id', v_idea,
    'content_pillar_id', v_pillar,
    'statement', 'Makan malam diubah',
    'checks', v_checks,
    'facts', jsonb_build_object(
      'resolution', 'RESOLVED',
      'relationToParent', 'VALID_EXECUTION',
      'unresolvedReasons', '[]'::jsonb
    ),
    'script', jsonb_build_object('title', 'Makan malam')
  ));
  IF v_check->>'execution_id' IS DISTINCT FROM v_ai_ex::text
    OR NOT EXISTS (
      SELECT 1 FROM public.thinking_lab_executions ex
      WHERE ex.id = v_human_ex
        AND ex.statement = 'teks manusia'
        AND ex.author_employee_id IS NULL
        AND ex.script->>'title' = 'Manusia'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.thinking_lab_executions ex
      WHERE ex.id = v_ai_ex
        AND ex.author_employee_id = v_ai
        AND ex.statement = 'Makan malam diubah'
    )
    OR (
      SELECT count(*) FROM public.thinking_lab_executions ex
      WHERE ex.idea_id = v_idea AND ex.content_pillar_id = v_pillar
    ) IS DISTINCT FROM 2
  THEN
    RAISE EXCEPTION 'execution buatan manusia tidak boleh berubah';
  END IF;

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  VALUES
    (v_ai, v_org, 'thinking.plan.save'),
    (v_ai, v_org, 'thinking.execution.check'),
    (v_ai, v_org, 'ads.campaign.create');

  v_plan := public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
    'title', 'Plan dari idea',
    'brief', 'Makan malam',
    'post_date', '2026-11-11',
    'content_pillar_id', v_pillar,
    'service_id', v_service,
    'idea_id', v_idea,
    'execution_id', v_check->>'execution_id'
  ));
  IF v_plan->>'id' IS NULL THEN
    RAISE EXCEPTION 'plan harus terhubung ke idea';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.social_media_plans plan
    WHERE plan.id = (v_plan->>'id')::uuid
      AND plan.thinking_idea_id = v_idea
      AND plan.production_status = 'Need Review'
      AND plan.approved = false
  ) THEN
    RAISE EXCEPTION 'plan idea harus Need Review dan belum disetujui';
  END IF;

  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
      'title', 'Plan kedua',
      'post_date', '2026-11-12',
      'content_pillar_id', v_pillar,
      'idea_id', v_idea,
      'execution_id', v_check->>'execution_id'
    ));
    RAISE EXCEPTION 'idea yang sudah jadi plan harus ditolak';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'ads.campaign.create', '{}'::jsonb);
    RAISE EXCEPTION 'aksi iklan harus tetap ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  IF has_table_privilege('anon', 'public.ai_employee_briefs', 'SELECT')
    OR has_table_privilege('authenticated', 'public.ai_employee_briefs', 'SELECT')
    OR has_table_privilege('service_role', 'public.ai_employee_briefs', 'SELECT')
    OR has_function_privilege('anon', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_accept_execution(uuid,uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'hak akses brief atau pintu tidak sesuai';
  END IF;
END
$test$;
