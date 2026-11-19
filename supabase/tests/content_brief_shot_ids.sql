-- Permanent storyboard row ids survive insert and delete.
-- One DO. The success signal is the raised exception, which rolls the test back.

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
  v_other uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_owner_employee uuid := gen_random_uuid();
  v_other_employee uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_shot uuid;
  v_clip uuid := gen_random_uuid();
  v_kept uuid;
  v_row integer;
  v_count integer;
  v_paths text[];
BEGIN
  PERFORM pg_temp.insert_auth_user(v_owner, 'brief-shot-owner-' || v_owner::text || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_other, 'brief-shot-other-' || v_other::text || '@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Brief Shot Id Test', 'software', v_owner);
  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_owner, v_org), (v_other, v_org);
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner'), (v_other, v_org, 'employee');
  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_owner_employee, v_org, 'Owner Uji', v_owner, false),
    (v_other_employee, v_org, 'Karyawan Uji', v_other, false);
  INSERT INTO public.social_media_plans (id, organization_id, title, brief, pic_id)
  VALUES (v_plan, v_org, 'Shot ids', 'story', v_owner_employee);

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  PERFORM public.ensure_brief_storyboard_shots(v_plan, 2);
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_count FROM public.brief_storyboard_shots WHERE social_media_plan_id = v_plan;
  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ensure should create one id per row';
  END IF;

  SELECT id INTO v_shot
  FROM public.brief_storyboard_shots
  WHERE social_media_plan_id = v_plan AND row_index = 0;

  INSERT INTO public.brief_voice_clips (
    id, organization_id, social_media_plan_id, kind, row_index, shot_id, storage_path, file_name, spoken_text
  ) VALUES (
    v_clip, v_org, v_plan, 'vo', 0, NULL, v_org::text || '/voice/keep.mp3', 'keep.mp3', 'Halo'
  );
  UPDATE public.brief_voice_clips SET shot_id = NULL WHERE id = v_clip;

  EXECUTE 'SET ROLE authenticated';
  PERFORM public.ensure_brief_storyboard_shots(v_plan, 2);
  EXECUTE 'RESET ROLE';
  SELECT shot_id INTO v_kept FROM public.brief_voice_clips WHERE id = v_clip;
  IF v_kept IS DISTINCT FROM v_shot THEN
    RAISE EXCEPTION 'ensure should attach an existing clip by its current row';
  END IF;

  INSERT INTO public.brief_storyboard_images (
    social_media_plan_id, row_index, shot_id, sort_order, storage_path, file_name, mime_type, file_size
  ) VALUES (
    v_plan, 0, v_shot, 0, v_org::text || '/image/keep.png', 'keep.png', 'image/png', 10
  );
  INSERT INTO public.brief_voice_clips (
    organization_id, social_media_plan_id, kind, row_index, storage_path, file_name
  ) VALUES (
    v_org, v_plan, 'seedance', 0, v_org::text || '/voice/seed.mp3', 'seed.mp3'
  );

  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.ensure_brief_storyboard_shots(v_plan, 9);
    RAISE EXCEPTION 'a different row count should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_shot_mismatch%' THEN
        RAISE;
      END IF;
  END;
  PERFORM public.move_brief_storyboard_row(v_plan, 'insert', 0);
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_count FROM public.brief_storyboard_shots WHERE social_media_plan_id = v_plan;
  SELECT row_index, shot_id INTO v_row, v_kept FROM public.brief_voice_clips WHERE id = v_clip;
  IF v_count IS DISTINCT FROM 3 OR v_row IS DISTINCT FROM 1 OR v_kept IS DISTINCT FROM v_shot THEN
    RAISE EXCEPTION 'insert should keep the clip on its shot and move it to row 1';
  END IF;
  SELECT row_index, shot_id INTO v_row, v_kept
  FROM public.brief_storyboard_images
  WHERE social_media_plan_id = v_plan;
  IF v_row IS DISTINCT FROM 1 OR v_kept IS DISTINCT FROM v_shot THEN
    RAISE EXCEPTION 'insert should keep the image on its shot';
  END IF;
  SELECT row_index INTO v_row
  FROM public.brief_voice_clips
  WHERE social_media_plan_id = v_plan AND kind = 'seedance';
  IF v_row IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'seedance clips stay on their row index';
  END IF;

  EXECUTE 'SET ROLE authenticated';
  SELECT COALESCE(array_agg(moved.storage_path), ARRAY[]::text[])
    INTO v_paths
  FROM public.move_brief_storyboard_row(v_plan, 'delete', 0) AS moved;
  EXECUTE 'RESET ROLE';
  SELECT row_index, shot_id INTO v_row, v_kept FROM public.brief_voice_clips WHERE id = v_clip;
  IF v_paths <> ARRAY[]::text[] OR v_row IS DISTINCT FROM 0 OR v_kept IS DISTINCT FROM v_shot THEN
    RAISE EXCEPTION 'deleting the new row should return the clip to row 0';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.move_brief_storyboard_row(v_plan, 'insert', 0);
    RAISE EXCEPTION 'an employee without storyboard access should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_count FROM public.brief_storyboard_shots WHERE social_media_plan_id = v_plan;
  SELECT row_index INTO v_row FROM public.brief_voice_clips WHERE id = v_clip;
  IF v_count IS DISTINCT FROM 2 OR v_row IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'a rejected move changed the rows';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  SELECT COALESCE(array_agg(moved.storage_path), ARRAY[]::text[])
    INTO v_paths
  FROM public.move_brief_storyboard_row(v_plan, 'delete', 0) AS moved;
  EXECUTE 'RESET ROLE';
  IF v_paths <> ARRAY[v_org::text || '/voice/keep.mp3'] THEN
    RAISE EXCEPTION 'deleting a row should return its VO file path';
  END IF;
  IF EXISTS (SELECT 1 FROM public.brief_voice_clips WHERE id = v_clip)
     OR EXISTS (SELECT 1 FROM public.brief_storyboard_images WHERE social_media_plan_id = v_plan) THEN
    RAISE EXCEPTION 'deleting a row should remove its VO clip and image';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.brief_voice_clips
    WHERE social_media_plan_id = v_plan AND kind = 'seedance' AND row_index = 0
  ) THEN
    RAISE EXCEPTION 'deleting a row should leave seedance clips in place';
  END IF;

  RAISE EXCEPTION 'CONTENT_BRIEF_SHOT_IDS_OK';
END;
$test$;
