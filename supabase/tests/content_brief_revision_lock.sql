-- Approved brief edits return to Need Review. Production, schedule, and publish lock
-- the edit until the brief status is Request Revision. Rolls back.
-- Local: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/content_brief_revision_lock.sql

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
  v_org uuid := gen_random_uuid();
  v_employee uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_completion timestamptz := '2026-11-01 00:00:00+00';
  v_saved integer;
  v_version uuid;
  v_brief text;
  v_status text;
  v_approved boolean;
  v_completion_after timestamptz;
  v_title text;
  v_production boolean;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_pic, 'brief-revision-lock-' || v_pic::text || '@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Brief Revision Lock Test', 'software', v_pic);
  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_pic, v_org);
  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES (v_employee, v_org, 'PIC Uji', v_pic, false);
  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, status, approved, completion_date, pic_id
  ) VALUES (
    v_plan, v_org, 'Revision lock', 'story-v1', 'Approved', true, v_completion, v_employee
  );
  INSERT INTO public.brief_target_audiences (social_media_plan_id, description) VALUES (v_plan, 'concept-v1');
  INSERT INTO public.brief_captions (social_media_plan_id, content) VALUES (v_plan, 'cap-v1');
  INSERT INTO public.brief_link_references (social_media_plan_id, content) VALUES (v_plan, 'link-v1');

  PERFORM set_config('request.jwt.claim.sub', v_pic::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pic, 'role', 'authenticated')::text, true);

  EXECUTE 'SET ROLE authenticated';
  v_saved := public.save_content_brief(v_plan, 0, false, 'story-v1', 'concept-v1', 'cap-v1', 'link-v1');
  EXECUTE 'RESET ROLE';
  SELECT brief, status, approved, completion_date
    INTO v_brief, v_status, v_approved, v_completion_after
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_saved IS DISTINCT FROM 0 OR v_brief IS DISTINCT FROM 'story-v1'
     OR v_status IS DISTINCT FROM 'Approved' OR v_approved IS DISTINCT FROM true
     OR v_completion_after IS DISTINCT FROM v_completion THEN
    RAISE EXCEPTION 'an unchanged save should keep approval';
  END IF;

  EXECUTE 'SET ROLE authenticated';
  v_saved := public.save_content_brief(v_plan, 0, true, 'story-v2', 'concept-v2', 'cap-v2', 'link-v2');
  EXECUTE 'RESET ROLE';
  SELECT brief, status, approved, completion_date
    INTO v_brief, v_status, v_approved, v_completion_after
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_saved IS DISTINCT FROM 1 OR v_brief IS DISTINCT FROM 'story-v2'
     OR v_status IS DISTINCT FROM 'Need Review' OR v_approved IS DISTINCT FROM false
     OR v_completion_after IS NOT NULL THEN
    RAISE EXCEPTION 'editing an approved brief should return it to Need Review';
  END IF;

  UPDATE public.social_media_plans
  SET status = 'Approved', approved = true, completion_date = v_completion, production_approved = true
  WHERE id = v_plan;

  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 1, true, 'story-v3', 'concept-v3', 'cap-v3', 'link-v3');
    RAISE EXCEPTION 'production approval should lock the edit';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_edit_locked%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT brief, status, approved, production_approved
    INTO v_brief, v_status, v_approved, v_production
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v2' OR v_status IS DISTINCT FROM 'Approved'
     OR v_approved IS DISTINCT FROM true OR v_production IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'a locked save changed the brief or its approval';
  END IF;

  PERFORM id FROM public.mcp_update_content_plan(v_pic, v_org, v_plan, 'Renamed', NULL, NULL, NULL);
  SELECT title, brief, status, approved INTO v_title, v_brief, v_status, v_approved
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_title IS DISTINCT FROM 'Renamed' OR v_brief IS DISTINCT FROM 'story-v2'
     OR v_status IS DISTINCT FROM 'Approved' OR v_approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'a title change should stay open while the brief is locked';
  END IF;

  BEGIN
    PERFORM id FROM public.mcp_update_content_plan(v_pic, v_org, v_plan, NULL, NULL, 'story-v4', 1);
    RAISE EXCEPTION 'MCP brief change should be locked';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_edit_locked%' THEN RAISE; END IF;
  END;

  UPDATE public.social_media_plans
  SET status = 'Request Revision', approved = false, completion_date = NULL
  WHERE id = v_plan;
  EXECUTE 'SET ROLE authenticated';
  v_saved := public.save_content_brief(v_plan, 1, false, 'story-v3', 'concept-v3', 'cap-v3', 'link-v3');
  EXECUTE 'RESET ROLE';
  SELECT brief, status, approved, production_approved
    INTO v_brief, v_status, v_approved, v_production
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_saved IS DISTINCT FROM 1 OR v_brief IS DISTINCT FROM 'story-v3'
     OR v_status IS DISTINCT FROM 'Request Revision' OR v_approved IS DISTINCT FROM false
     OR v_production IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Request Revision should allow the edit without returning to Need Review';
  END IF;

  UPDATE public.social_media_plans
  SET status = 'Approved', approved = true, completion_date = v_completion, production_approved = false
  WHERE id = v_plan;
  INSERT INTO public.social_media_scheduled_posts (
    organization_id, social_media_plan_id, platform, scheduled_at, media_url_snapshot, status
  ) VALUES (
    v_org, v_plan, 'instagram', now(), 'https://example.com/a.mp4', 'pending'
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 1, false, 'story-v4', 'concept-v4', 'cap-v4', 'link-v4');
    RAISE EXCEPTION 'a pending schedule should lock the edit';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_edit_locked%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';

  UPDATE public.social_media_scheduled_posts
  SET status = 'cancelled'
  WHERE social_media_plan_id = v_plan;
  EXECUTE 'SET ROLE authenticated';
  v_saved := public.save_content_brief(v_plan, 1, true, 'story-v4', 'concept-v4', 'cap-v4', 'link-v4');
  EXECUTE 'RESET ROLE';
  SELECT status, approved INTO v_status, v_approved
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_saved IS DISTINCT FROM 2 OR v_status IS DISTINCT FROM 'Need Review' OR v_approved IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'a cancelled schedule should allow the edit and clear approval';
  END IF;

  UPDATE public.social_media_plans
  SET status = 'Approved', approved = true, completion_date = v_completion,
      post_link = '{"url":"https://example.com/post"}'::jsonb
  WHERE id = v_plan;
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 2, false, 'story-v5', 'concept-v5', 'cap-v5', 'link-v5');
    RAISE EXCEPTION 'a published link should lock the edit';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_edit_locked%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT brief, approved INTO v_brief, v_approved FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v4' OR v_approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'a published lock changed the brief';
  END IF;

  UPDATE public.social_media_plans
  SET post_link = NULL, production_status = 'Approved', production_approved = false
  WHERE id = v_plan;
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 2, false, 'story-v5', 'concept-v5', 'cap-v5', 'link-v5');
    RAISE EXCEPTION 'production status Approved should lock the edit';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_edit_locked%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';

  UPDATE public.social_media_plans
  SET production_status = NULL, status = 'Approved', approved = true
  WHERE id = v_plan;
  SELECT id INTO v_version
  FROM public.content_brief_versions
  WHERE social_media_plan_id = v_plan AND version_no = 2;
  EXECUTE 'SET ROLE authenticated';
  PERFORM public.restore_content_brief_version(v_version);
  EXECUTE 'RESET ROLE';
  SELECT brief, status, approved, completion_date
    INTO v_brief, v_status, v_approved, v_completion_after
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v3' OR v_status IS DISTINCT FROM 'Need Review'
     OR v_approved IS DISTINCT FROM false OR v_completion_after IS NOT NULL THEN
    RAISE EXCEPTION 'restore should return an approved brief to Need Review';
  END IF;

  UPDATE public.social_media_plans
  SET status = 'Approved', approved = true, production_approved = true, production_status = NULL
  WHERE id = v_plan;
  SELECT id INTO v_version
  FROM public.content_brief_versions
  WHERE social_media_plan_id = v_plan AND version_no = 1;
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.restore_content_brief_version(v_version);
    RAISE EXCEPTION 'restore should be locked while production is approved';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_edit_locked%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT brief, approved INTO v_brief, v_approved FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v3' OR v_approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'a locked restore changed the brief';
  END IF;

  UPDATE public.social_media_plans
  SET production_approved = false, status = 'Approved', approved = true
  WHERE id = v_plan;
  SELECT COALESCE(MAX(version_no), 0) INTO v_saved
  FROM public.content_brief_versions WHERE social_media_plan_id = v_plan;
  PERFORM id FROM public.mcp_update_content_plan(v_pic, v_org, v_plan, NULL, NULL, 'story-v6', v_saved);
  SELECT brief, status, approved, production_approved
    INTO v_brief, v_status, v_approved, v_production
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v6' OR v_status IS DISTINCT FROM 'Need Review'
     OR v_approved IS DISTINCT FROM false OR v_production IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'MCP brief change should return an approved brief to Need Review';
  END IF;
  RAISE NOTICE 'CONTENT_BRIEF_REVISION_LOCK_OK';
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;

ROLLBACK;
