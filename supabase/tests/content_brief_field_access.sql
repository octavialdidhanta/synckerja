-- Brief field access follows Approval Access. No active row: PIC, owner, or admin.
-- Rolls back.
-- Local: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/content_brief_field_access.sql

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
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_pic_employee uuid := gen_random_uuid();
  v_owner_employee uuid := gen_random_uuid();
  v_admin_employee uuid := gen_random_uuid();
  v_other_employee uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_completion timestamptz := '2026-11-01 00:00:00+00';
  v_saved integer;
  v_brief text;
  v_concept text;
  v_caption text;
  v_link text;
  v_status text;
  v_approved boolean;
  v_title text;
  v_production boolean;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_pic, 'brief-field-pic-' || v_pic::text || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_owner, 'brief-field-owner-' || v_owner::text || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_admin, 'brief-field-admin-' || v_admin::text || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_other, 'brief-field-other-' || v_other::text || '@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Brief Field Access Test', 'software', v_owner);
  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_pic, v_org), (v_owner, v_org), (v_admin, v_org), (v_other, v_org);
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_pic, v_org, 'employee'),
    (v_owner, v_org, 'owner'),
    (v_admin, v_org, 'admin'),
    (v_other, v_org, 'employee');
  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_pic_employee, v_org, 'PIC Uji', v_pic, false),
    (v_owner_employee, v_org, 'Owner Uji', v_owner, false),
    (v_admin_employee, v_org, 'Admin Uji', v_admin, false),
    (v_other_employee, v_org, 'Karyawan Uji', v_other, false);
  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, status, approved, completion_date, pic_id
  ) VALUES (
    v_plan, v_org, 'Field access', 'story-v1', 'Approved', true, v_completion, v_pic_employee
  );
  INSERT INTO public.brief_target_audiences (social_media_plan_id, description) VALUES (v_plan, 'concept-v1');
  INSERT INTO public.brief_captions (social_media_plan_id, content) VALUES (v_plan, 'cap-v1');
  INSERT INTO public.brief_link_references (social_media_plan_id, content) VALUES (v_plan, 'link-v1');

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 0, true, 'story-v1', 'concept-v2', 'cap-v1', 'link-v1');
    RAISE EXCEPTION 'an employee who is not PIC should not edit the concept';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT brief, status, approved INTO v_brief, v_status, v_approved
  FROM public.social_media_plans WHERE id = v_plan;
  SELECT description INTO v_concept FROM public.brief_target_audiences WHERE social_media_plan_id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v1' OR v_concept IS DISTINCT FROM 'concept-v1'
     OR v_status IS DISTINCT FROM 'Approved' OR v_approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'a forbidden save changed the brief or its approval';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_pic::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pic, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  v_saved := public.save_content_brief(v_plan, 0, true, 'story-v1', 'concept-v2', 'cap-v1', 'link-v1');
  EXECUTE 'RESET ROLE';
  SELECT status, approved, completion_date IS NULL INTO v_status, v_approved, v_production
  FROM public.social_media_plans WHERE id = v_plan;
  SELECT description INTO v_concept FROM public.brief_target_audiences WHERE social_media_plan_id = v_plan;
  IF v_saved IS DISTINCT FROM 1 OR v_concept IS DISTINCT FROM 'concept-v2'
     OR v_status IS DISTINCT FROM 'Need Review' OR v_approved IS DISTINCT FROM false
     OR v_production IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'the PIC should edit an approved brief back to Need Review';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  v_saved := public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v2', 'cap-v1', 'link-v1');
  EXECUTE 'RESET ROLE';
  SELECT brief INTO v_brief FROM public.social_media_plans WHERE id = v_plan;
  IF v_saved IS DISTINCT FROM 1 OR v_brief IS DISTINCT FROM 'story-v2' THEN
    RAISE EXCEPTION 'an owner should edit the storyboard without a config row';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  PERFORM public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v2', 'cap-v2', 'link-v1');
  EXECUTE 'RESET ROLE';
  SELECT content INTO v_caption FROM public.brief_captions WHERE social_media_plan_id = v_plan;
  IF v_caption IS DISTINCT FROM 'cap-v2' THEN
    RAISE EXCEPTION 'an admin should edit the caption without a config row';
  END IF;

  INSERT INTO public.approval_access_configurations (
    organization_id, column_type, column_name, allowed_roles, exceptions, is_active, created_by
  ) VALUES
    (v_org, 'brief_caption', 'Caption', ARRAY['owner']::text[], ARRAY[]::text[], true, v_owner),
    (v_org, 'brief_link', 'Link', ARRAY['owner']::text[], ARRAY[v_other_employee::text], true, v_owner),
    (v_org, 'brief_concept', 'Konsep', ARRAY['employee']::text[], ARRAY[]::text[], true, v_owner),
    (v_org, 'brief_storyboard', 'Storyboard', ARRAY['owner']::text[], ARRAY[]::text[], true, v_owner),
    (v_org, 'prod_approved', 'Prod Approved', ARRAY['owner']::text[], ARRAY[]::text[], true, v_owner);

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v2', 'cap-v3', 'link-v1');
    RAISE EXCEPTION 'caption config should reject the admin';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT content INTO v_caption FROM public.brief_captions WHERE social_media_plan_id = v_plan;
  IF v_caption IS DISTINCT FROM 'cap-v2' THEN
    RAISE EXCEPTION 'a rejected caption edit was saved';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  PERFORM public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v2', 'cap-v3', 'link-v1');
  EXECUTE 'RESET ROLE';
  SELECT content INTO v_caption FROM public.brief_captions WHERE social_media_plan_id = v_plan;
  IF v_caption IS DISTINCT FROM 'cap-v3' THEN
    RAISE EXCEPTION 'the owner should still edit a caption limited to owner';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  PERFORM public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v2', 'cap-v3', 'link-v2');
  EXECUTE 'RESET ROLE';
  SELECT content INTO v_link FROM public.brief_link_references WHERE social_media_plan_id = v_plan;
  IF v_link IS DISTINCT FROM 'link-v2' THEN
    RAISE EXCEPTION 'an exception employee should edit the link';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v2', 'cap-v3', 'link-v3');
    RAISE EXCEPTION 'link config should reject the admin';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  PERFORM public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v3', 'cap-v3', 'link-v2');
  EXECUTE 'RESET ROLE';
  SELECT description INTO v_concept FROM public.brief_target_audiences WHERE social_media_plan_id = v_plan;
  IF v_concept IS DISTINCT FROM 'concept-v3' THEN
    RAISE EXCEPTION 'the owner should edit a concept row that lists only employees';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 1, false, 'story-v2', 'concept-v4', 'cap-v3', 'link-v2');
    RAISE EXCEPTION 'concept config should reject the admin';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_pic::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pic, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 1, false, 'story-v3', 'concept-v3', 'cap-v3', 'link-v2');
    RAISE EXCEPTION 'storyboard config should replace the PIC fallback';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;
  BEGIN
    INSERT INTO public.brief_storyboard_images (
      social_media_plan_id, row_index, sort_order, storage_path, file_name, mime_type, file_size
    ) VALUES (
      v_plan, 0, 0, 'test/pic.png', 'pic.png', 'image/png', 1
    );
    RAISE EXCEPTION 'pic image insert should follow the storyboard right';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  EXECUTE 'RESET ROLE';
  SELECT brief INTO v_brief FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v2' THEN
    RAISE EXCEPTION 'a rejected storyboard edit was saved';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  v_saved := public.save_content_brief(v_plan, 1, true, 'story-v3', 'concept-v3', 'cap-v3', 'link-v2');
  INSERT INTO public.brief_storyboard_images (
    social_media_plan_id, row_index, sort_order, storage_path, file_name, mime_type, file_size
  ) VALUES (
    v_plan, 0, 0, 'test/owner.png', 'owner.png', 'image/png', 1
  );
  EXECUTE 'RESET ROLE';
  SELECT brief INTO v_brief FROM public.social_media_plans WHERE id = v_plan;
  IF v_saved IS DISTINCT FROM 2 OR v_brief IS DISTINCT FROM 'story-v3' THEN
    RAISE EXCEPTION 'the owner should edit a storyboard limited to owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.brief_storyboard_images WHERE social_media_plan_id = v_plan AND file_name = 'owner.png'
  ) THEN
    RAISE EXCEPTION 'the owner should add a storyboard image';
  END IF;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE 'SET ROLE service_role';
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'a service-role call should have no auth.uid()';
  END IF;
  PERFORM id FROM public.mcp_update_content_plan(v_other, v_org, v_plan, 'Renamed', NULL, NULL, NULL);
  EXECUTE 'RESET ROLE';
  SELECT title, brief INTO v_title, v_brief FROM public.social_media_plans WHERE id = v_plan;
  IF v_title IS DISTINCT FROM 'Renamed' OR v_brief IS DISTINCT FROM 'story-v3' THEN
    RAISE EXCEPTION 'a title change should stay open without storyboard access';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE 'SET ROLE service_role';
  BEGIN
    PERFORM id FROM public.mcp_update_content_plan(v_other, v_org, v_plan, NULL, NULL, 'story-v4', 2);
    RAISE EXCEPTION 'MCP should reject an account that cannot edit the storyboard';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT brief INTO v_brief FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v3' THEN
    RAISE EXCEPTION 'a forbidden MCP brief change was saved';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE 'SET ROLE service_role';
  PERFORM id FROM public.mcp_update_content_plan(v_owner, v_org, v_plan, NULL, NULL, 'story-v4', 2);
  EXECUTE 'RESET ROLE';
  SELECT brief, status, approved INTO v_brief, v_status, v_approved
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v4' OR v_status IS DISTINCT FROM 'Need Review'
     OR v_approved IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'the connected owner should edit the brief through MCP';
  END IF;

  UPDATE public.social_media_plans
  SET status = 'Approved', approved = true, completion_date = v_completion, production_approved = true
  WHERE id = v_plan;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    PERFORM public.save_content_brief(v_plan, 3, false, 'story-v4', 'concept-v5', 'cap-v3', 'link-v2');
    RAISE EXCEPTION 'production approval should still lock an allowed edit';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_edit_locked%' THEN
        RAISE;
      END IF;
  END;
  BEGIN
    PERFORM public.save_content_brief(v_plan, 0, false, 'story-v4', 'concept-v3', 'cap-v3', 'link-v2');
    RAISE EXCEPTION 'a stale version should still be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_version_conflict%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';
  SELECT description INTO v_concept FROM public.brief_target_audiences WHERE social_media_plan_id = v_plan;
  SELECT brief, approved, production_approved INTO v_brief, v_approved, v_production
  FROM public.social_media_plans WHERE id = v_plan;
  IF v_brief IS DISTINCT FROM 'story-v4' OR v_concept IS DISTINCT FROM 'concept-v3'
     OR v_approved IS DISTINCT FROM true OR v_production IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'a lock or version rejection changed the brief';
  END IF;

  RAISE NOTICE 'CONTENT_BRIEF_FIELD_ACCESS_OK';
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;

ROLLBACK;
