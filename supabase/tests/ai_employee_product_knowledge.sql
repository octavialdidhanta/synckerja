-- Badan uji Product Knowledge. Dipakai di dalam ai_employee_product_knowledge_dryrun.sql.
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
  v_member uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_quiet uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_other_service uuid := gen_random_uuid();
  v_outside_service uuid := gen_random_uuid();
  v_sub uuid := gen_random_uuid();
  v_pillar uuid := gen_random_uuid();
  v_open uuid := gen_random_uuid();
  v_used uuid := gen_random_uuid();
  v_sub_row uuid := gen_random_uuid();
  v_outside uuid := gen_random_uuid();
  v_foreign uuid := gen_random_uuid();
  v_extra uuid;
  v_i integer;
  v_run uuid;
  v_quiet_run uuid;
  v_rows jsonb;
  v_saved jsonb;
  v_plan uuid;
BEGIN
  IF to_regprocedure('public.mcp_list_product_knowledge(uuid,uuid,uuid,uuid,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'migration 20261103109000 belum diterapkan';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'product-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_admin, 'product-admin@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'product-member@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES
    (v_org, 'Product Knowledge Test', 'software', v_owner),
    (v_other, 'Org Lain Test', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_owner, v_org, 'owner'),
    (v_admin, v_org, 'admin'),
    (v_member, v_org, 'employee');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_ai, v_org, 'Naya Uji', NULL, true),
    (v_quiet, v_org, 'Naya Tanpa Izin', NULL, true);

  INSERT INTO public.ai_employee_profiles (employee_id, organization_id, time_zone, is_active, performance_status)
  VALUES
    (v_ai, v_org, 'Asia/Jakarta', true, 'on_track'),
    (v_quiet, v_org, 'Asia/Jakarta', true, 'on_track');

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  VALUES
    (v_ai, v_org, 'product.knowledge.list'),
    (v_ai, v_org, 'content.plans.create');

  INSERT INTO public.services (id, organization_id, name, is_active)
  VALUES
    (v_service, v_org, 'Sate', true),
    (v_outside_service, v_org, 'Lain', true),
    (v_other_service, v_other, 'Org Lain Service', true);

  INSERT INTO public.sub_services (id, organization_id, service_id, name)
  VALUES (v_sub, v_org, v_service, 'Sate Bakar');

  INSERT INTO public.content_pillars (id, organization_id, name, is_active)
  VALUES (v_pillar, v_org, 'Produk Uji', true);

  INSERT INTO public.product_knowledge (
    id, organization_id, service_id, sub_service_id, feature_name, target_audience, false_belief, updated_at
  ) VALUES
    (v_open, v_org, v_service, NULL, 'Terpilih kosong', '{"name":"ibu muda"}'::jsonb, 'mitos mahal', now() - interval '30 days'),
    (v_used, v_org, v_service, NULL, 'Terpilih terpakai', '{"name":"keluarga"}'::jsonb, NULL, now() - interval '1 day'),
    (v_sub_row, v_org, NULL, v_sub, 'Lewat sub', '{"name":"anak"}'::jsonb, NULL, now() - interval '20 days'),
    (v_outside, v_org, v_outside_service, NULL, 'Di luar', '{"name":"bukan katalog"}'::jsonb, NULL, now()),
    (v_foreign, v_other, v_other_service, NULL, 'Org lain', '{"name":"rahasia"}'::jsonb, NULL, now());

  FOR v_i IN 1..6 LOOP
    v_extra := gen_random_uuid();
    INSERT INTO public.product_knowledge (
      id, organization_id, service_id, feature_name, updated_at
    ) VALUES (
      v_extra, v_org, v_service, 'Baru ' || v_i, now() - make_interval(hours => v_i)
    );
  END LOOP;

  INSERT INTO public.social_media_plans (
    organization_id, title, post_date, content_pillar_id, service_id, product_knowledge_id, author_employee_id
  ) VALUES (
    v_org, 'Plan sudah pakai', '2026-10-01 00:00:00+07', v_pillar, v_service, v_used, v_ai
  );

  BEGIN
    PERFORM public.ai_employee_brief_write(
      v_owner, v_org, v_ai,
      jsonb_build_object(
        'service_ids', jsonb_build_array(v_service),
        'persona_ids', jsonb_build_array(v_open),
        'pillar_ids', jsonb_build_array(v_pillar),
        'product_knowledge_ids', jsonb_build_array(v_outside)
      )
    );
    RAISE EXCEPTION 'baris di luar katalog tidak boleh masuk brief';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  v_saved := public.ai_employee_brief_write(
    v_owner, v_org, v_ai,
    jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'audience', 'keluarga',
      'persona_ids', jsonb_build_array(v_open),
      'voice', 'hangat',
      'required_notes', '',
      'forbidden_notes', '',
      'pillar_ids', jsonb_build_array(v_pillar),
      'product_knowledge_ids', jsonb_build_array(v_open, v_used, v_sub_row),
      'split_rule', ''
    )
  );
  IF v_saved->'brief'->'personas'->0->>'audience' IS DISTINCT FROM 'ibu muda' THEN
    RAISE EXCEPTION 'persona lama harus tetap tampil';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_saved->'brief'->'products') row
    WHERE row->>'feature_name' = 'Terpilih kosong'
      AND row->>'audience' = 'ibu muda'
      AND NOT (row ? 'use_cases')
  ) THEN
    RAISE EXCEPTION 'ringkasan brief harus memuat baris yang dipilih';
  END IF;

  v_run := public.ai_employee_run_start(v_ai, 'SOP1');
  v_quiet_run := public.ai_employee_run_start(v_quiet, 'SOP1');

  BEGIN
    PERFORM public.ai_employee_context(v_quiet, v_quiet_run, 'product', '{}'::jsonb);
    RAISE EXCEPTION 'tanpa izin tidak boleh mendapat scope product';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'product', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 3
    OR v_rows->0->>'feature_name' IS DISTINCT FROM 'Lewat sub'
    OR v_rows->1->>'feature_name' IS DISTINCT FROM 'Terpilih kosong'
    OR v_rows->2->>'feature_name' IS DISTINCT FROM 'Terpilih terpakai'
    OR (v_rows->0->>'unused')::boolean IS DISTINCT FROM true
    OR (v_rows->2->>'unused')::boolean IS DISTINCT FROM false
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_rows) row
      WHERE row->>'feature_name' IN ('Di luar', 'Org lain', 'Baru 1')
        OR row ? 'use_cases'
        OR row ? 'sort_selected'
    )
  THEN
    RAISE EXCEPTION 'scope product harus hanya baris brief, terpilih lalu yang belum terpakai';
  END IF;

  v_saved := public.ai_employee_perform(
    v_ai, v_run, 'content.plans.create',
    jsonb_build_object(
      'title', 'Plan dari product',
      'brief', 'Pakai baris kosong',
      'post_date', '2026-11-11',
      'content_pillar_id', v_pillar,
      'service_id', v_service,
      'product_knowledge_id', v_open,
      'product_knowledge_fields', jsonb_build_array('false_belief', 'rahasia', 'feature_name', 'impact', 'false_belief', 12)
    )
  );
  v_plan := (v_saved->>'id')::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM public.social_media_plans plan
    WHERE plan.id = v_plan
      AND plan.organization_id = v_org
      AND plan.product_knowledge_id = v_open
      AND plan.product_knowledge_fields = ARRAY['false_belief', 'feature_name']::text[]
  ) THEN
    RAISE EXCEPTION 'plan harus menyimpan product_knowledge_id dan kolom yang berisi data';
  END IF;

  BEGIN
    PERFORM public.ai_employee_perform(
      v_ai, v_run, 'content.plans.create',
      jsonb_build_object(
        'title', 'Plan luar',
        'brief', 'Tidak boleh',
        'post_date', '2026-11-12',
        'content_pillar_id', v_pillar,
        'service_id', v_outside_service,
        'product_knowledge_id', v_outside
      )
    );
    RAISE EXCEPTION 'baris di luar katalog tidak boleh disimpan ke plan';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'product', '{}'::jsonb))
    AS x(rows jsonb);
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_rows) row
    WHERE row->>'feature_name' = 'Terpilih kosong'
      AND (row->>'unused')::boolean IS FALSE
  ) THEN
    RAISE EXCEPTION 'baris yang sudah jadi plan harus ditandai terpakai';
  END IF;

  PERFORM public.ai_employee_brief_write(
    v_owner, v_org, v_ai,
    jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'persona_ids', jsonb_build_array(v_open),
      'pillar_ids', jsonb_build_array(v_pillar),
      'product_knowledge_ids', '[]'::jsonb
    )
  );
  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'product', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 6
    OR v_rows->0->>'feature_name' IS DISTINCT FROM 'Baru 1'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_rows) row
      WHERE row->>'feature_name' IN ('Di luar', 'Org lain', 'Terpilih terpakai', 'Terpilih kosong')
    )
  THEN
    RAISE EXCEPTION 'tanpa pilihan brief, scope harus katalog saja dan mendahulukan yang belum terpakai';
  END IF;

  v_rows := public.mcp_list_product_knowledge(v_admin, v_org, NULL, NULL, 'Terpilih', 8);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 2
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) row
      WHERE row->>'feature_name' = 'Org lain' OR row ? 'use_cases'
    )
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) row
      WHERE row->>'feature_name' = 'Terpilih kosong'
    )
  THEN
    RAISE EXCEPTION 'admin harus membaca baris organisasi sesi saja';
  END IF;

  v_rows := public.mcp_list_product_knowledge(v_owner, v_org, NULL, NULL, 'Org lain', 8);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'pencarian tidak boleh menemukan baris organisasi lain';
  END IF;

  v_rows := public.mcp_list_product_knowledge(v_owner, v_org, v_other_service, NULL, NULL, 8);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'filter layanan organisasi lain harus kosong';
  END IF;

  v_rows := public.mcp_list_product_knowledge(v_owner, v_org, NULL, NULL, '%', 8);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'karakter pencarian harus diperlakukan sebagai teks';
  END IF;

  BEGIN
    PERFORM public.mcp_list_product_knowledge(v_owner, v_other, NULL, NULL, NULL, 8);
    RAISE EXCEPTION 'org lain tidak boleh dibaca';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.mcp_list_product_knowledge(v_member, v_org, NULL, NULL, NULL, 8);
    RAISE EXCEPTION 'anggota biasa tidak boleh membaca';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  IF has_function_privilege('anon', 'public.mcp_list_product_knowledge(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.mcp_list_product_knowledge(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.mcp_list_product_knowledge(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_product_clip(jsonb,integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.mcp_list_product_knowledge(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
    OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'hak akses product knowledge tidak sesuai';
  END IF;
END
$test$;
