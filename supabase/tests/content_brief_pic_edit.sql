-- PIC, owner, and admin may save a brief. Another employee may not.
-- The old "Only the PIC" rejection stays out of the live trigger.
-- Rolls back.
-- Local: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/content_brief_pic_edit.sql

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_owner_employee uuid := gen_random_uuid();
  v_admin_employee uuid := gen_random_uuid();
  v_staff_employee uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_owner_confirm uuid := gen_random_uuid();
  v_admin_confirm uuid := gen_random_uuid();
  v_staff_confirm uuid := gen_random_uuid();
  v_story boolean;
  v_concept boolean;
  v_caption_right boolean;
  v_caption text;
  v_source text;
  v_actor uuid;
  v_version_count integer;
  v_staff_confirms integer;
  v_guard text;
BEGIN
  v_guard := pg_get_functiondef('public.guard_social_media_plan_brief_pic()'::regprocedure);
  IF position('Only the PIC' in v_guard) > 0 OR position('brief_field_forbidden' in v_guard) = 0 THEN
    RAISE EXCEPTION 'the brief trigger still uses the old PIC rejection';
  END IF;

  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) VALUES
    (
      v_owner, 'authenticated', 'authenticated',
      'brief-pic-owner-' || v_owner::text || '@example.com', 'test-not-a-real-password', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', false, false
    ),
    (
      v_admin, 'authenticated', 'authenticated',
      'brief-pic-admin-' || v_admin::text || '@example.com', 'test-not-a-real-password', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', false, false
    ),
    (
      v_staff, 'authenticated', 'authenticated',
      'brief-pic-staff-' || v_staff::text || '@example.com', 'test-not-a-real-password', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', false, false
    );

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Brief Pic Edit Test', 'software', v_owner);
  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_owner, v_org), (v_admin, v_org), (v_staff, v_org);
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner'), (v_admin, v_org, 'admin'), (v_staff, v_org, 'employee');
  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_owner_employee, v_org, 'Owner Uji', v_owner, false),
    (v_admin_employee, v_org, 'Admin Uji', v_admin, false),
    (v_staff_employee, v_org, 'Karyawan Uji', v_staff, false);
  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, status, approved, pic_id
  ) VALUES (
    v_plan, v_org, 'PIC edit', 'story', 'Need Review', false, v_owner_employee
  );
  INSERT INTO public.brief_target_audiences (social_media_plan_id, description)
  VALUES (v_plan, 'concept-v1');
  INSERT INTO public.brief_captions (social_media_plan_id, content)
  VALUES (v_plan, 'cap-v1');
  INSERT INTO public.brief_link_references (social_media_plan_id, content)
  VALUES (v_plan, 'link-v1');

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE 'SET ROLE service_role';

  SELECT row.can_storyboard, row.can_concept, row.can_caption
    INTO v_story, v_concept, v_caption_right
  FROM public.mcp_read_content_brief_for_update(v_owner, v_org, v_plan) AS row;
  IF v_story IS DISTINCT FROM true
     OR v_concept IS DISTINCT FROM true
     OR v_caption_right IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'the owner PIC should be allowed to edit the brief';
  END IF;

  PERFORM public.mcp_confirm_content_brief(
    v_owner, v_org, v_plan, 0, v_owner_confirm, 'story', 'concept-v1', 'cap-owner', 'link-v1'
  );

  SELECT row.can_caption
    INTO v_caption_right
  FROM public.mcp_read_content_brief_for_update(v_admin, v_org, v_plan) AS row;
  IF v_caption_right IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'an admin who is not the PIC should be allowed to edit the caption';
  END IF;

  PERFORM public.mcp_confirm_content_brief(
    v_admin, v_org, v_plan, 1, v_admin_confirm, 'story', 'concept-v1', 'cap-admin', 'link-v1'
  );

  SELECT row.can_caption
    INTO v_caption_right
  FROM public.mcp_read_content_brief_for_update(v_staff, v_org, v_plan) AS row;
  IF v_caption_right IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'an employee who is not the PIC should not receive caption rights';
  END IF;

  BEGIN
    PERFORM public.mcp_confirm_content_brief(
      v_staff, v_org, v_plan, 2, v_staff_confirm, 'story', 'concept-v1', 'cap-staff', 'link-v1'
    );
    RAISE EXCEPTION 'an employee who is not the PIC should not save the caption';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_field_forbidden%' THEN
        RAISE;
      END IF;
  END;

  EXECUTE 'RESET ROLE';

  SELECT caption_row.content INTO v_caption
  FROM public.brief_captions AS caption_row
  WHERE caption_row.social_media_plan_id = v_plan;
  SELECT versions.source, versions.created_by
    INTO v_source, v_actor
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = v_plan
    AND versions.version_no = 1;
  IF v_caption IS DISTINCT FROM 'cap-admin'
     OR v_source IS DISTINCT FROM 'mcp'
     OR v_actor IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'the owner PIC save did not keep an mcp snapshot';
  END IF;

  SELECT versions.source, versions.created_by
    INTO v_source, v_actor
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = v_plan
    AND versions.version_no = 2;
  SELECT count(*) INTO v_version_count
  FROM public.content_brief_versions
  WHERE social_media_plan_id = v_plan;
  SELECT count(*) INTO v_staff_confirms
  FROM public.mcp_tool_confirmations
  WHERE id = v_staff_confirm;
  IF v_source IS DISTINCT FROM 'mcp'
     OR v_actor IS DISTINCT FROM v_admin
     OR v_version_count IS DISTINCT FROM 2
     OR v_staff_confirms IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'the admin save or the rejected employee save did not stay in bounds';
  END IF;

  RAISE EXCEPTION 'CONTENT_BRIEF_PIC_EDIT_OK' USING ERRCODE = 'P0001';
EXCEPTION
  WHEN raise_exception THEN
    EXECUTE 'RESET ROLE';
    RAISE;
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;
