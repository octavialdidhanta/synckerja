-- Brief save guard: a stale base_version writes nothing, one session autosaves once,
-- and a brief change from MCP needs the current version. Rolls back.
-- Local: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/content_brief_save_guard.sql

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
  v_pic_employee uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_completion timestamptz := '2026-11-01 00:00:00+00';
  v_saved integer;
  v_count integer;
  v_brief text;
  v_concept text;
  v_status text;
  v_approved boolean;
  v_completion_after timestamptz;
  v_title text;
  v_latest_brief text;
  v_source text;
  v_actor uuid;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_pic, 'brief-save-guard-' || v_pic::text || '@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Brief Save Guard Test', 'software', v_pic);

  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_pic, v_org);

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES (v_pic_employee, v_org, 'PIC Uji', v_pic, false);

  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, status, approved, completion_date, pic_id
  ) VALUES (
    v_plan, v_org, 'Brief save guard', 'story-v1', 'Approved', true, v_completion, v_pic_employee
  );

  INSERT INTO public.brief_target_audiences (social_media_plan_id, description)
  VALUES (v_plan, 'concept-v1');
  INSERT INTO public.brief_captions (social_media_plan_id, content)
  VALUES (v_plan, 'cap-v1');
  INSERT INTO public.brief_link_references (social_media_plan_id, content)
  VALUES (v_plan, 'link-v1');

  PERFORM set_config('request.jwt.claim.sub', v_pic::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pic, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';

  v_saved := public.save_content_brief(v_plan, 0, true, 'story-v2', 'concept-v2', 'cap-v2', 'link-v2');
  IF v_saved IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'first save should return version 1, got %', v_saved;
  END IF;

  SELECT brief INTO v_latest_brief
  FROM public.content_brief_versions
  WHERE social_media_plan_id = v_plan AND version_no = 1;
  IF v_latest_brief IS DISTINCT FROM 'story-v1' THEN
    RAISE EXCEPTION 'the first snapshot should keep the brief from before the save';
  END IF;

  BEGIN
    PERFORM public.save_content_brief(v_plan, 0, true, 'story-stale', 'concept-stale', 'cap-stale', 'link-stale');
    RAISE EXCEPTION 'stale save should fail';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_version_conflict%' THEN
        RAISE;
      END IF;
  END;

  SELECT brief, status, approved, completion_date
    INTO v_brief, v_status, v_approved, v_completion_after
  FROM public.social_media_plans
  WHERE id = v_plan;
  SELECT description INTO v_concept
  FROM public.brief_target_audiences
  WHERE social_media_plan_id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v2' OR v_concept IS DISTINCT FROM 'concept-v2' THEN
    RAISE EXCEPTION 'a stale save overwrote the first session';
  END IF;
  IF v_status IS DISTINCT FROM 'Approved' OR v_approved IS DISTINCT FROM true OR v_completion_after IS DISTINCT FROM v_completion THEN
    RAISE EXCEPTION 'a rejected save changed status, approval, or completion';
  END IF;

  v_saved := public.save_content_brief(v_plan, 1, false, 'story-v3', 'concept-v3', 'cap-v3', 'link-v3');
  IF v_saved IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'autosave in the same session should keep version 1, got %', v_saved;
  END IF;
  SELECT count(*) INTO v_count FROM public.content_brief_versions WHERE social_media_plan_id = v_plan;
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'autosave created another version';
  END IF;
  SELECT brief INTO v_brief FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v3' THEN
    RAISE EXCEPTION 'autosave did not update the live brief';
  END IF;

  EXECUTE 'RESET ROLE';

  PERFORM id
  FROM public.mcp_update_content_plan(v_pic, v_org, v_plan, 'Renamed', NULL, NULL, NULL);
  SELECT title, brief, status, approved
    INTO v_title, v_brief, v_status, v_approved
  FROM public.social_media_plans
  WHERE id = v_plan;
  IF v_title IS DISTINCT FROM 'Renamed' OR v_brief IS DISTINCT FROM 'story-v3' THEN
    RAISE EXCEPTION 'a title change should not need a brief version';
  END IF;
  IF v_status IS DISTINCT FROM 'Approved' OR v_approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'a title change changed approval';
  END IF;

  BEGIN
    PERFORM id
    FROM public.mcp_update_content_plan(v_pic, v_org, v_plan, NULL, NULL, 'story-v4', NULL);
    RAISE EXCEPTION 'a brief change without a version should fail';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_version_required%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM id
    FROM public.mcp_update_content_plan(v_pic, v_org, v_plan, NULL, NULL, 'story-v4', 0);
    RAISE EXCEPTION 'a stale MCP brief should fail';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_version_conflict%' THEN
        RAISE;
      END IF;
  END;

  SELECT brief, status, approved, completion_date
    INTO v_brief, v_status, v_approved, v_completion_after
  FROM public.social_media_plans
  WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v3'
     OR v_status IS DISTINCT FROM 'Approved'
     OR v_approved IS DISTINCT FROM true
     OR v_completion_after IS DISTINCT FROM v_completion THEN
    RAISE EXCEPTION 'a rejected MCP brief changed the plan';
  END IF;

  PERFORM id
  FROM public.mcp_update_content_plan(v_pic, v_org, v_plan, NULL, NULL, 'story-v4', 1);

  SELECT count(*) INTO v_count FROM public.content_brief_versions WHERE social_media_plan_id = v_plan;
  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'MCP save should add one version, got %', v_count;
  END IF;
  SELECT brief, source, created_by
    INTO v_latest_brief, v_source, v_actor
  FROM public.content_brief_versions
  WHERE social_media_plan_id = v_plan
  ORDER BY version_no DESC
  LIMIT 1;
  IF v_latest_brief IS DISTINCT FROM 'story-v3' OR v_source IS DISTINCT FROM 'mcp' OR v_actor IS DISTINCT FROM v_pic THEN
    RAISE EXCEPTION 'MCP snapshot should store the previous brief for the connected user';
  END IF;
  SELECT brief, status, approved INTO v_brief, v_status, v_approved
  FROM public.social_media_plans
  WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v4' OR v_status IS DISTINCT FROM 'Approved' OR v_approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'MCP brief save changed status or did not write the brief';
  END IF;

  SELECT version_no INTO v_saved
  FROM public.mcp_get_content_brief(v_pic, v_org, v_plan);
  IF v_saved IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'content brief read should return version %, got %', 2, v_saved;
  END IF;

  RAISE NOTICE 'CONTENT_BRIEF_SAVE_GUARD_OK';
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;

ROLLBACK;
