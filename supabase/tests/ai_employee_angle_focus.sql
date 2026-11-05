-- Uji fokus angle, giliran pilar, dan satu pengulangan di atas median.
-- Jalankan di dalam transaksi, lalu ROLLBACK. File ini sudah membungkus keduanya.

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
  v_other_org uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_persona uuid := gen_random_uuid();
  v_pillar_a uuid := gen_random_uuid();
  v_pillar_b uuid := gen_random_uuid();
  v_pillar_video uuid := gen_random_uuid();
  v_master uuid := gen_random_uuid();
  v_other_master uuid := gen_random_uuid();
  v_thought uuid := gen_random_uuid();
  v_other_thought uuid := gen_random_uuid();
  v_territory uuid := gen_random_uuid();
  v_other_territory uuid := gen_random_uuid();
  v_angle uuid := gen_random_uuid();
  v_angle_2 uuid := gen_random_uuid();
  v_angle_3 uuid := gen_random_uuid();
  v_angle_4 uuid := gen_random_uuid();
  v_angle_other uuid := gen_random_uuid();
  v_idea uuid := gen_random_uuid();
  v_idea_plain uuid := gen_random_uuid();
  v_run uuid;
  v_saved jsonb;
  v_rows jsonb;
  v_plan jsonb;
  v_plan_b jsonb;
  v_repeat jsonb;
  v_low uuid;
  v_i integer;
  v_count integer;
  v_repeat_count integer;
  v_first uuid;
  v_voice text;
  v_title text;
  v_caption text;
BEGIN
  IF to_regprocedure('public.ai_employee_carousel_paths(uuid)') IS NULL
    OR to_regclass('public.content_plan_post_metrics') IS NULL
    OR to_regclass('public.social_media_plans_idea_pillar_voice_idx') IS NULL
    OR to_regclass('public.social_media_plans_one_idea_idx') IS NOT NULL
  THEN
    RAISE EXCEPTION 'migration fokus angle belum lengkap';
  END IF;

  IF has_function_privilege('anon', 'public.ai_employee_carousel_paths(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_carousel_paths(uuid)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_carousel_paths(uuid)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.content_plan_post_metrics', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.content_plan_post_metrics', 'INSERT')
    OR NOT has_function_privilege('service_role', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR position('''angles'', v_angles' IN pg_get_functiondef('public.ai_employee_page_read(uuid)'::regprocedure)) = 0
    OR position('carousel_paths' IN pg_get_functiondef('public.ai_employee_context(uuid,uuid,text,jsonb)'::regprocedure)) = 0
    OR position('path_not_allowed' IN pg_get_functiondef('public.ai_employee_perform(uuid,uuid,text,jsonb)'::regprocedure)) = 0
  THEN
    RAISE EXCEPTION 'hak akses atau sambungan antrean belum sesuai';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'angle-focus-owner@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES
    (v_org, 'Angle Focus Test', 'software', v_owner),
    (v_other_org, 'Angle Focus Other', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES (v_ai, v_org, 'Naya Uji', NULL, true);

  INSERT INTO public.ai_employee_profiles (employee_id, organization_id, time_zone, is_active, performance_status)
  VALUES (v_ai, v_org, 'Asia/Jakarta', true, 'on_track');

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  VALUES (v_ai, v_org, 'thinking.plan.save');

  INSERT INTO public.services (id, organization_id, name, is_active)
  VALUES (v_service, v_org, 'Sate Sultan', true);

  INSERT INTO public.product_knowledge (id, organization_id, feature_name, target_audience)
  VALUES (v_persona, v_org, 'Persona uji', '{"name":"ibu muda"}'::jsonb);

  INSERT INTO public.content_pillars (id, organization_id, name, is_active)
  VALUES
    (v_pillar_a, v_org, 'Awal', true),
    (v_pillar_b, v_org, 'Berikut', true),
    (v_pillar_video, v_org, 'Video', true);

  INSERT INTO public.thinking_master_thoughts (
    id, organization_id, statement, original_input, status, workspace, canonical_semantic
  ) VALUES
    (v_master, v_org, 'Dia ibu yang baik', 'Dia ibu yang baik', 'locked', 'thinking_lab', '{"subject":"keluarga"}'::jsonb),
    (v_other_master, v_other_org, 'Master lain', 'Master lain', 'locked', 'thinking_lab', '{}'::jsonb);

  INSERT INTO public.thinking_big_thoughts (id, organization_id, master_thought_id, code, title, statement, status)
  VALUES
    (v_thought, v_org, v_master, 'BT1', 'Big', 'Big uji', 'locked'),
    (v_other_thought, v_other_org, v_other_master, 'BT1', 'Big', 'Big lain', 'locked');

  INSERT INTO public.thinking_lab_territories (
    id, organization_id, big_thought_id, code, statement, canonical_semantic, admission
  ) VALUES
    (v_territory, v_org, v_thought, 'TR1', 'Territory uji', '{}'::jsonb, 'GENERATE_VALID'),
    (v_other_territory, v_other_org, v_other_thought, 'TR1', 'Territory lain', '{}'::jsonb, 'GENERATE_VALID');

  INSERT INTO public.thinking_lab_angles (
    id, organization_id, territory_id, code, statement, parent_territory_fingerprint,
    canonical_semantic, admission, status
  ) VALUES
    (v_angle, v_org, v_territory, 'AN1', 'Perlindungan', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked'),
    (v_angle_2, v_org, v_territory, 'AN2', 'Visi', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked'),
    (v_angle_3, v_org, v_territory, 'AN3', 'Ritme', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked'),
    (v_angle_4, v_org, v_territory, 'AN4', 'Jeda', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked'),
    (v_angle_other, v_other_org, v_other_territory, 'AN1', 'Angle lain', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked');

  INSERT INTO public.thinking_lab_ideas (
    id, organization_id, angle_id, code, statement, parent_angle_fingerprint,
    canonical_semantic, admission, status, validation, development_paths
  ) VALUES (
    v_idea, v_org, v_angle, 'ID1', 'Memprediksi solusi diri', 'fp',
    '{}'::jsonb, 'GENERATE_VALID', 'locked', '{"decision":"LOLOS"}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'contentPillarId', v_pillar_a,
        'format', NULL,
        'status', 'RECOMMENDED',
        'savedAt', '2026-11-01T00:00:00Z',
        'reviews', jsonb_build_array(jsonb_build_object(
          'contentPillarId', v_pillar_a,
          'development', 'Biarkan anak mencoba',
          'status', 'RECOMMENDED'
        ))
      ),
      jsonb_build_object(
        'contentPillarId', v_pillar_b,
        'format', 'carousel',
        'status', 'RECOMMENDED',
        'savedAt', '2026-11-02T00:00:00Z',
        'reviews', jsonb_build_array(jsonb_build_object(
          'contentPillarId', v_pillar_b,
          'development', 'Ulangi pertanyaan kecil',
          'status', 'RECOMMENDED'
        ))
      ),
      jsonb_build_object(
        'contentPillarId', v_pillar_video,
        'format', 'video',
        'status', 'RECOMMENDED',
        'savedAt', '2026-11-03T00:00:00Z',
        'reviews', jsonb_build_array(jsonb_build_object(
          'contentPillarId', v_pillar_video,
          'development', 'Jalur video tidak masuk',
          'status', 'RECOMMENDED'
        ))
      )
    )
  );

  INSERT INTO public.thinking_lab_ideas (
    id, organization_id, angle_id, code, statement, parent_angle_fingerprint,
    canonical_semantic, admission, status, validation
  ) VALUES (
    v_idea_plain, v_org, v_angle, 'ID2', 'Idea tanpa jalur', 'fp',
    '{}'::jsonb, 'GENERATE_VALID', 'locked', '{"decision":"LOLOS"}'::jsonb
  );

  BEGIN
    PERFORM public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'persona_ids', '[]'::jsonb,
      'pillar_ids', '[]'::jsonb,
      'angle_ids', jsonb_build_array(v_angle, v_angle_2, v_angle_3, v_angle_4),
      'repeat_voices', '[]'::jsonb
    ));
    RAISE EXCEPTION 'chip angle keempat harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'persona_ids', '[]'::jsonb,
      'pillar_ids', '[]'::jsonb,
      'angle_ids', jsonb_build_array(v_angle_other),
      'repeat_voices', '[]'::jsonb
    ));
    RAISE EXCEPTION 'angle organisasi lain harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'persona_ids', '[]'::jsonb,
      'pillar_ids', '[]'::jsonb,
      'angle_ids', jsonb_build_array(v_angle),
      'repeat_voices', jsonb_build_array(repeat('a', 501))
    ));
    RAISE EXCEPTION 'gaya yang lebih dari 500 karakter harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;

  v_saved := public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'keluarga',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat',
    'required_notes', '',
    'forbidden_notes', '',
    'pillar_ids', '[]'::jsonb,
    'angle_ids', jsonb_build_array(v_angle),
    'repeat_voices', jsonb_build_array('lugas', 'ringkas'),
    'split_rule', ''
  ));
  IF v_saved->'brief'->'angle_ids' IS DISTINCT FROM jsonb_build_array(v_angle)
    OR v_saved->'brief'->'repeat_voices' IS DISTINCT FROM jsonb_build_array('lugas', 'ringkas')
  THEN
    RAISE EXCEPTION 'brief fokus angle tidak tersimpan';
  END IF;

  v_saved := public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'keluarga',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat tetap',
    'required_notes', '',
    'forbidden_notes', '',
    'pillar_ids', '[]'::jsonb,
    'split_rule', ''
  ));
  IF v_saved->'brief'->>'voice' IS DISTINCT FROM 'hangat tetap'
    OR v_saved->'brief'->'angle_ids' IS DISTINCT FROM jsonb_build_array(v_angle)
    OR v_saved->'brief'->'repeat_voices' IS DISTINCT FROM jsonb_build_array('lugas', 'ringkas')
  THEN
    RAISE EXCEPTION 'kunci angle yang tidak dikirim harus mempertahankan isi lama';
  END IF;

  v_saved := public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'keluarga',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat',
    'required_notes', '',
    'forbidden_notes', '',
    'pillar_ids', jsonb_build_array(v_pillar_a),
    'angle_ids', jsonb_build_array(v_angle),
    'repeat_voices', jsonb_build_array('lugas', 'ringkas'),
    'split_rule', ''
  ));

  SELECT count(*)::int, (array_agg(content_pillar_id))[1]
  INTO v_count, v_first
  FROM public.ai_employee_carousel_paths(v_ai);
  IF v_count IS DISTINCT FROM 1 OR v_first IS DISTINCT FROM v_pillar_a THEN
    RAISE EXCEPTION 'filter pilar harus menyisakan satu jalur awal';
  END IF;

  PERFORM public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'keluarga',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat',
    'required_notes', '',
    'forbidden_notes', '',
    'pillar_ids', '[]'::jsonb,
    'angle_ids', jsonb_build_array(v_angle),
    'repeat_voices', jsonb_build_array('lugas', 'ringkas'),
    'split_rule', ''
  ));

  SELECT count(*)::int,
         count(*) FILTER (WHERE is_repeat)::int,
         (array_agg(content_pillar_id ORDER BY queue_order))[1]
  INTO v_count, v_repeat_count, v_first
  FROM public.ai_employee_carousel_paths(v_ai);
  IF v_count IS DISTINCT FROM 2
    OR v_repeat_count IS DISTINCT FROM 0
    OR v_first IS DISTINCT FROM v_pillar_a
    OR EXISTS (
      SELECT 1 FROM public.ai_employee_carousel_paths(v_ai) path
      WHERE path.content_pillar_id = v_pillar_video
         OR path.prompt_voice IS DISTINCT FROM 'hangat'
         OR path.development IS NULL
    )
  THEN
    RAISE EXCEPTION 'antrean baru harus dua jalur carousel, video di luar';
  END IF;

  v_run := public.ai_employee_run_start(v_ai, 'SOP1');
  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'carousel_paths', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'konteks jadwal harus memuat antrean yang sama';
  END IF;

  v_plan := public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
    'title', 'Plan jalur awal',
    'post_date', '2026-11-20',
    'content_pillar_id', v_pillar_a,
    'service_id', v_service,
    'idea_id', v_idea
  ));

  SELECT count(*)::int, (array_agg(content_pillar_id))[1]
  INTO v_count, v_first
  FROM public.ai_employee_carousel_paths(v_ai);
  IF v_count IS DISTINCT FROM 1 OR v_first IS DISTINCT FROM v_pillar_b THEN
    RAISE EXCEPTION 'jalur yang sudah tersimpan harus keluar dari antrean baru';
  END IF;

  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
      'title', 'Plan tanpa jalur',
      'post_date', '2026-11-22',
      'content_pillar_id', v_pillar_b,
      'idea_id', v_idea
    ));
    RAISE EXCEPTION 'idea yang sudah punya plan harus ditolak bila tanpa jalur';
  EXCEPTION
    WHEN unique_violation THEN
      IF SQLERRM NOT LIKE '%idea_used%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    INSERT INTO public.social_media_plans (
      organization_id, title, post_date, content_pillar_id, thinking_idea_id
    ) VALUES (
      v_org, 'Duplikat awal', '2026-11-23 00:00:00+07', v_pillar_a, v_idea
    );
    RAISE EXCEPTION 'pasangan idea dan pilar yang sama harus ditolak indeks';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  v_plan_b := public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
    'title', 'Plan jalur berikut',
    'post_date', '2026-11-21',
    'content_pillar_id', v_pillar_video,
    'path_pillar_id', v_pillar_b,
    'delivery_voice', '',
    'service_id', v_service,
    'idea_id', v_idea
  ));
  IF NOT EXISTS (
    SELECT 1 FROM public.social_media_plans plan
    WHERE plan.id = (v_plan_b->>'id')::uuid
      AND plan.content_pillar_id = v_pillar_b
      AND plan.thinking_idea_id = v_idea
      AND plan.delivery_voice IS NULL
      AND plan.status = 'Need Review'
      AND plan.approved = false
      AND plan.production_approved = false
  ) THEN
    RAISE EXCEPTION 'jalur pilar kedua dari idea yang sama harus lolos';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ai_employee_carousel_paths(v_ai)) THEN
    RAISE EXCEPTION 'tanpa metrik tidak boleh ada pengulangan';
  END IF;

  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
      'title', 'Ulang terlalu cepat',
      'post_date', '2026-11-27',
      'content_pillar_id', v_pillar_a,
      'path_pillar_id', v_pillar_a,
      'delivery_voice', 'lugas',
      'idea_id', v_idea
    ));
    RAISE EXCEPTION 'pengulangan tanpa metrik harus ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%path_not_allowed%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.brief_captions (social_media_plan_id, content)
  VALUES ((v_plan->>'id')::uuid, 'Caption lama #awal');

  INSERT INTO public.social_media_scheduled_posts (
    organization_id, social_media_plan_id, platform, status,
    scheduled_at, published_at, media_url_snapshot
  ) VALUES (
    v_org, (v_plan->>'id')::uuid, 'TikTok', 'published',
    now() - interval '8 days', now() - interval '8 days', 'https://example.test/awal.jpg'
  );

  INSERT INTO public.content_plan_post_metrics (
    organization_id, plan_id, platform, views, likes, comments, shares
  ) VALUES (
    v_org, (v_plan->>'id')::uuid, 'tiktok', 10, 4, 0, 0
  );

  FOR v_i IN 1..2 LOOP
    INSERT INTO public.social_media_plans (organization_id, title, post_date, content_pillar_id)
    VALUES (v_org, 'Cohort ' || v_i, '2026-10-01 00:00:00+07', v_pillar_a)
    RETURNING id INTO v_low;
    INSERT INTO public.social_media_scheduled_posts (
      organization_id, social_media_plan_id, platform, status,
      scheduled_at, published_at, media_url_snapshot
    ) VALUES (
      v_org, v_low, 'TikTok', 'published',
      now() - interval '8 days', now() - interval '8 days', 'https://example.test/low.jpg'
    );
    INSERT INTO public.content_plan_post_metrics (
      organization_id, plan_id, platform, views, likes, comments, shares
    ) VALUES (
      v_org, v_low, 'tiktok', 10, 4, 0, 0
    );
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.ai_employee_carousel_paths(v_ai) WHERE is_repeat) THEN
    RAISE EXCEPTION 'cohort di bawah 4 tidak boleh membuka pengulangan';
  END IF;

  INSERT INTO public.social_media_plans (organization_id, title, post_date, content_pillar_id)
  VALUES (v_org, 'Cohort 3', '2026-10-02 00:00:00+07', v_pillar_a)
  RETURNING id INTO v_low;
  INSERT INTO public.social_media_scheduled_posts (
    organization_id, social_media_plan_id, platform, status,
    scheduled_at, published_at, media_url_snapshot
  ) VALUES (
    v_org, v_low, 'TikTok', 'published',
    now() - interval '8 days', now() - interval '8 days', 'https://example.test/low-3.jpg'
  );
  INSERT INTO public.content_plan_post_metrics (
    organization_id, plan_id, platform, views, likes, comments, shares
  ) VALUES (
    v_org, v_low, 'tiktok', 10, 4, 0, 0
  );

  IF EXISTS (SELECT 1 FROM public.ai_employee_carousel_paths(v_ai) WHERE is_repeat) THEN
    RAISE EXCEPTION 'angka yang sama dengan median tidak boleh diulang';
  END IF;

  UPDATE public.content_plan_post_metrics
  SET views = 11, likes = 5
  WHERE plan_id = (v_plan->>'id')::uuid
    AND platform = 'tiktok';

  SELECT count(*)::int, min(delivery_voice), min(previous_title), min(previous_caption)
  INTO v_count, v_voice, v_title, v_caption
  FROM public.ai_employee_carousel_paths(v_ai)
  WHERE is_repeat;
  IF v_count IS DISTINCT FROM 1
    OR v_voice IS DISTINCT FROM 'lugas'
    OR v_title IS DISTINCT FROM 'Plan jalur awal'
    OR v_caption IS DISTINCT FROM 'Caption lama #awal'
  THEN
    RAISE EXCEPTION 'pengulangan di atas median harus memakai gaya pertama';
  END IF;

  PERFORM public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'keluarga',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat',
    'pillar_ids', '[]'::jsonb,
    'angle_ids', jsonb_build_array(v_angle),
    'repeat_voices', '[]'::jsonb,
    'split_rule', ''
  ));
  IF EXISTS (SELECT 1 FROM public.ai_employee_carousel_paths(v_ai)) THEN
    RAISE EXCEPTION 'gaya cadangan kosong harus menutup pengulangan';
  END IF;

  PERFORM public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'keluarga',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat',
    'pillar_ids', '[]'::jsonb,
    'angle_ids', jsonb_build_array(v_angle),
    'repeat_voices', jsonb_build_array('lugas', 'ringkas'),
    'split_rule', ''
  ));

  FOR v_i IN 1..3 LOOP
    SELECT plan.id INTO v_low
    FROM public.social_media_plans plan
    WHERE plan.organization_id = v_org
      AND plan.title = 'Cohort ' || v_i;
    IF v_i = 3 THEN
      SELECT plan.id INTO v_low
      FROM public.social_media_plans plan
      WHERE plan.organization_id = v_org
        AND plan.title = 'Cohort 3';
    END IF;
    INSERT INTO public.social_media_scheduled_posts (
      organization_id, social_media_plan_id, platform, status,
      scheduled_at, published_at, media_url_snapshot
    ) VALUES (
      v_org, v_low, 'Instagram', 'published',
      now() - interval '8 days', now() - interval '8 days', 'https://example.test/ig.jpg'
    );
    INSERT INTO public.content_plan_post_metrics (
      organization_id, plan_id, platform, views, likes, comments, shares
    ) VALUES (
      v_org, v_low, 'instagram', 10, 4, 0, 0
    );
  END LOOP;

  INSERT INTO public.social_media_scheduled_posts (
    organization_id, social_media_plan_id, platform, status,
    scheduled_at, published_at, media_url_snapshot
  ) VALUES (
    v_org, (v_plan->>'id')::uuid, 'Instagram', 'published',
    now() - interval '8 days', now() - interval '8 days', 'https://example.test/ig-awal.jpg'
  );
  INSERT INTO public.content_plan_post_metrics (
    organization_id, plan_id, platform, views, likes, comments, shares
  ) VALUES (
    v_org, (v_plan->>'id')::uuid, 'instagram', 1, 1, 0, 0
  );

  IF EXISTS (SELECT 1 FROM public.ai_employee_carousel_paths(v_ai) WHERE is_repeat) THEN
    RAISE EXCEPTION 'satu platform di bawah median harus menahan pengulangan';
  END IF;

  DELETE FROM public.content_plan_post_metrics
  WHERE plan_id = (v_plan->>'id')::uuid
    AND platform = 'instagram';

  v_repeat := public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
    'title', 'Plan ulang',
    'post_date', '2026-11-28',
    'content_pillar_id', v_pillar_video,
    'path_pillar_id', v_pillar_a,
    'delivery_voice', 'lugas',
    'service_id', v_service,
    'idea_id', v_idea
  ));
  IF NOT EXISTS (
    SELECT 1 FROM public.social_media_plans plan
    WHERE plan.id = (v_repeat->>'id')::uuid
      AND plan.content_pillar_id = v_pillar_a
      AND plan.delivery_voice = 'lugas'
      AND plan.status = 'Need Review'
      AND plan.approved = false
      AND plan.production_approved = false
  ) THEN
    RAISE EXCEPTION 'plan ulang harus tetap Need Review dengan gaya cadangan';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ai_employee_carousel_paths(v_ai)) THEN
    RAISE EXCEPTION 'jalur hanya boleh diulang satu kali';
  END IF;

  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
      'title', 'Plan ulang kedua',
      'post_date', '2026-12-05',
      'content_pillar_id', v_pillar_a,
      'path_pillar_id', v_pillar_a,
      'delivery_voice', 'ringkas',
      'idea_id', v_idea
    ));
    RAISE EXCEPTION 'pengulangan kedua harus ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%path_not_allowed%' THEN
        RAISE;
      END IF;
  END;

  PERFORM public.ai_employee_brief_write(v_owner, v_org, v_ai, jsonb_build_object(
    'service_ids', jsonb_build_array(v_service),
    'audience', 'keluarga',
    'persona_ids', jsonb_build_array(v_persona),
    'voice', 'hangat',
    'pillar_ids', '[]'::jsonb,
    'angle_ids', '[]'::jsonb,
    'repeat_voices', '[]'::jsonb,
    'split_rule', ''
  ));
  IF EXISTS (SELECT 1 FROM public.ai_employee_carousel_paths(v_ai)) THEN
    RAISE EXCEPTION 'brief tanpa angle tidak memakai antrean jalur';
  END IF;

  PERFORM public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
    'title', 'Plan idea biasa',
    'post_date', '2026-11-29',
    'content_pillar_id', v_pillar_a,
    'service_id', v_service,
    'idea_id', v_idea_plain
  ));
  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
      'title', 'Plan idea biasa kedua',
      'post_date', '2026-11-30',
      'content_pillar_id', v_pillar_b,
      'idea_id', v_idea_plain
    ));
    RAISE EXCEPTION 'brief tanpa angle harus tetap menolak idea yang sudah dipakai';
  EXCEPTION
    WHEN unique_violation THEN
      IF SQLERRM NOT LIKE '%idea_used%' THEN
        RAISE;
      END IF;
  END;
END
$test$;

ROLLBACK;
