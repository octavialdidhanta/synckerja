-- Confirmed MCP brief edit: source mcp, a stale version writes nothing, and a token is used once.
-- Rolls back.
-- Local: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/mcp_content_brief_update.sql

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_employee uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_confirm uuid := gen_random_uuid();
  v_other_confirm uuid := gen_random_uuid();
  v_completion timestamptz := '2026-11-01 00:00:00+00';
  v_caption text;
  v_link text;
  v_status text;
  v_approved boolean;
  v_completion_left timestamptz;
  v_source text;
  v_actor uuid;
  v_version_caption text;
  v_version_count integer;
  v_confirm_count integer;
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) VALUES (
    v_owner, 'authenticated', 'authenticated',
    'brief-update-' || v_owner::text || '@example.com', 'test-not-a-real-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', false, false
  );

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Brief Update Preview Test', 'software', v_owner);
  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_owner, v_org);
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner');
  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES (v_employee, v_org, 'Owner Uji', v_owner, false);
  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, status, approved, completion_date, pic_id
  ) VALUES (
    v_plan, v_org, 'Preview edit', 'story', 'Approved', true, v_completion, v_employee
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

  PERFORM public.mcp_confirm_content_brief(
    v_owner, v_org, v_plan, 0, v_confirm, 'story', 'concept-v1', 'cap-v2', 'link-v1'
  );

  BEGIN
    PERFORM public.mcp_confirm_content_brief(
      v_owner, v_org, v_plan, 0, v_other_confirm, 'story', 'concept-v1', 'cap-v3', 'link-v1'
    );
    RAISE EXCEPTION 'a stale version should not save';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%brief_version_conflict%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.mcp_confirm_content_brief(
      v_owner, v_org, v_plan, 1, v_confirm, 'story', 'concept-v1', 'cap-v3', 'link-v1'
    );
    RAISE EXCEPTION 'the same confirmation should not save twice';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%confirmation_used%' THEN
        RAISE;
      END IF;
  END;

  EXECUTE 'RESET ROLE';

  SELECT caption_row.content INTO v_caption
  FROM public.brief_captions AS caption_row
  WHERE caption_row.social_media_plan_id = v_plan;
  SELECT link_row.content INTO v_link
  FROM public.brief_link_references AS link_row
  WHERE link_row.social_media_plan_id = v_plan;
  SELECT plan.status, plan.approved, plan.completion_date
    INTO v_status, v_approved, v_completion_left
  FROM public.social_media_plans AS plan
  WHERE plan.id = v_plan;
  SELECT versions.source, versions.created_by, versions.caption
    INTO v_source, v_actor, v_version_caption
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = v_plan
    AND versions.version_no = 1;
  SELECT count(*) INTO v_version_count
  FROM public.content_brief_versions
  WHERE social_media_plan_id = v_plan;
  SELECT count(*) INTO v_confirm_count
  FROM public.mcp_tool_confirmations
  WHERE id = v_confirm;

  IF v_caption IS DISTINCT FROM 'cap-v2'
     OR v_link IS DISTINCT FROM 'link-v1'
     OR v_status IS DISTINCT FROM 'Need Review'
     OR v_approved IS DISTINCT FROM false
     OR v_completion_left IS NOT NULL
     OR v_source IS DISTINCT FROM 'mcp'
     OR v_actor IS DISTINCT FROM v_owner
     OR v_version_caption IS DISTINCT FROM 'cap-v1'
     OR v_version_count IS DISTINCT FROM 1
     OR v_confirm_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'confirmed caption edit did not keep the mcp snapshot';
  END IF;

  RAISE EXCEPTION 'CONTENT_BRIEF_UPDATE_PREVIEW_OK' USING ERRCODE = 'P0001';
EXCEPTION
  WHEN raise_exception THEN
    EXECUTE 'RESET ROLE';
    RAISE;
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;
