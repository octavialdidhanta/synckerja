-- Brief version history: one snapshot when content changes, restore of an approved brief returns it to Need Review, an account that cannot edit the changed fields is rejected.
-- Rolls back. Local: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/content_brief_versions.sql

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
  v_pic uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_pic_employee uuid := gen_random_uuid();
  v_member_employee uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_completion timestamptz := '2026-11-01 00:00:00+00';
  v_first uuid;
  v_second uuid;
  v_restored uuid;
  v_count integer;
  v_brief text;
  v_concept text;
  v_caption text;
  v_link text;
  v_status text;
  v_approved boolean;
  v_completion_after timestamptz;
  v_latest_brief text;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_pic, 'brief-version-pic@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'brief-version-member@example.com');
  PERFORM pg_temp.insert_auth_user(v_outsider, 'brief-version-outsider@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Brief Version Test', 'software', v_pic);

  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_pic, v_org), (v_member, v_org);

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_pic_employee, v_org, 'PIC Uji', v_pic, false),
    (v_member_employee, v_org, 'Bukan PIC', v_member, false);

  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, status, approved, completion_date, pic_id
  ) VALUES (
    v_plan, v_org, 'Brief version test', 'story-v1', 'Approved', true, v_completion, v_pic_employee
  );

  INSERT INTO public.brief_target_audiences (social_media_plan_id, description)
  VALUES (v_plan, '{"v":1,"voiceOver":"vo-v1"}');
  INSERT INTO public.brief_captions (social_media_plan_id, content)
  VALUES (v_plan, 'cap-v1');
  INSERT INTO public.brief_link_references (social_media_plan_id, content)
  VALUES (v_plan, 'link-v1');

  PERFORM set_config('request.jwt.claim.sub', v_pic::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pic, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';

  v_first := public.record_content_brief_version(v_plan);
  IF v_first IS NULL THEN
    RAISE EXCEPTION 'first snapshot should be stored';
  END IF;
  v_second := public.record_content_brief_version(v_plan);
  IF v_second IS NOT NULL THEN
    RAISE EXCEPTION 'unchanged brief should not create another version';
  END IF;

  UPDATE public.social_media_plans SET brief = 'story-v2' WHERE id = v_plan;
  UPDATE public.brief_target_audiences
  SET description = '{"v":1,"voiceOver":"vo-v2"}'
  WHERE social_media_plan_id = v_plan;
  UPDATE public.brief_captions SET content = 'cap-v2' WHERE social_media_plan_id = v_plan;
  UPDATE public.brief_link_references SET content = 'link-v2' WHERE social_media_plan_id = v_plan;

  v_restored := public.restore_content_brief_version(v_first);
  IF v_restored IS NULL THEN
    RAISE EXCEPTION 'restore should snapshot the current brief before replacing it';
  END IF;

  SELECT brief, status, approved, completion_date
    INTO v_brief, v_status, v_approved, v_completion_after
  FROM public.social_media_plans
  WHERE id = v_plan;
  SELECT description INTO v_concept FROM public.brief_target_audiences WHERE social_media_plan_id = v_plan;
  SELECT content INTO v_caption FROM public.brief_captions WHERE social_media_plan_id = v_plan;
  SELECT content INTO v_link FROM public.brief_link_references WHERE social_media_plan_id = v_plan;

  IF v_brief IS DISTINCT FROM 'story-v1'
     OR v_concept IS DISTINCT FROM '{"v":1,"voiceOver":"vo-v1"}'
     OR v_caption IS DISTINCT FROM 'cap-v1'
     OR v_link IS DISTINCT FROM 'link-v1' THEN
    RAISE EXCEPTION 'restore did not return the four brief fields';
  END IF;
  IF v_status IS DISTINCT FROM 'Need Review' OR v_approved IS DISTINCT FROM false OR v_completion_after IS NOT NULL THEN
    RAISE EXCEPTION 'restore should return an approved brief to Need Review';
  END IF;

  SELECT count(*) INTO v_count FROM public.content_brief_versions WHERE social_media_plan_id = v_plan;
  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected 2 versions, got %', v_count;
  END IF;

  SELECT brief INTO v_latest_brief
  FROM public.content_brief_versions
  WHERE social_media_plan_id = v_plan
  ORDER BY version_no DESC
  LIMIT 1;
  IF v_latest_brief IS DISTINCT FROM 'story-v2' THEN
    RAISE EXCEPTION 'the overwritten brief should remain the newest version';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.restore_content_brief_version(v_first);
    RAISE EXCEPTION 'non-pic restore should fail';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;

  SELECT count(*) INTO v_count FROM public.content_brief_versions WHERE social_media_plan_id = v_plan;
  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'org member should be able to read history';
  END IF;

  BEGIN
    INSERT INTO public.content_brief_versions (
      organization_id, social_media_plan_id, version_no, content_hash
    ) VALUES (v_org, v_plan, 99, 'forged');
    RAISE EXCEPTION 'direct insert should fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.record_content_brief_version(v_plan);
    RAISE EXCEPTION 'outsider should not record a version';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%Not allowed%' THEN
        RAISE;
      END IF;
  END;

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'CONTENT_BRIEF_VERSIONS_OK';
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;

ROLLBACK;
