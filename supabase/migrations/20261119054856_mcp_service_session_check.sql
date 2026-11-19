-- MCP brief edits always failed with "forbidden" / brief_field_forbidden.
-- content_brief_revision_locked, can_edit_content_brief_field and the
-- guard_social_media_plan_brief_pic trigger trusted the MCP server by checking
-- session_user IN ('service_role', ...). Through PostgREST session_user is
-- always 'authenticator' (it only SETs ROLE service_role), so the MCP server
-- was never trusted. Trust the verified JWT role instead, like
-- _lead_merge_assert_org_access already does. Direct owner sessions
-- (SQL editor, migrations) with no JWT stay trusted.

CREATE OR REPLACE FUNCTION public.is_service_session()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT CASE
    WHEN COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN true
    WHEN COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '') = ''
         AND session_user IN ('postgres', 'supabase_admin') THEN true
    ELSE false
  END;
$fn$;

COMMENT ON FUNCTION public.is_service_session() IS
  'True for the service_role JWT (MCP server, edge functions) and for owner sessions without a JWT (SQL editor, migrations).';

REVOKE ALL ON FUNCTION public.is_service_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_service_session() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.content_brief_revision_locked(p_plan_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_status text;
  v_production_approved boolean;
  v_production_status text;
  v_post_link text;
BEGIN
  IF p_plan_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan.organization_id,
         plan.status,
         plan.production_approved,
         plan.production_status,
         plan.post_link::text
    INTO v_org, v_status, v_production_approved, v_production_status, v_post_link
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF v_org NOT IN (SELECT public.user_organization_ids()) THEN
      RAISE EXCEPTION 'Not allowed'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.is_service_session() THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF v_status = 'Request Revision' THEN
    RETURN false;
  END IF;

  IF COALESCE(v_production_approved, false) OR v_production_status = 'Approved' THEN
    RETURN true;
  END IF;

  IF COALESCE(v_post_link, 'null') NOT IN ('null', '[]', '{}', '""')
     AND NULLIF(btrim(v_post_link), '') IS NOT NULL THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.social_media_scheduled_posts AS scheduled
    WHERE scheduled.social_media_plan_id = p_plan_id
      AND scheduled.status IN ('pending', 'publishing', 'published')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_content_brief_field(p_plan_id uuid, p_field text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_pic uuid;
  v_role text;
  v_roles text[];
  v_exceptions text[];
  v_is_pic boolean;
BEGIN
  IF p_plan_id IS NULL
     OR p_field NOT IN ('brief_storyboard', 'brief_concept', 'brief_caption', 'brief_link') THEN
    RETURN false;
  END IF;

  v_actor := COALESCE(p_user_id, auth.uid());
  IF auth.uid() IS NOT NULL AND v_actor IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  IF auth.uid() IS NULL THEN
    IF NOT public.is_service_session() OR v_actor IS NULL THEN
      RETURN false;
    END IF;
  END IF;
  IF v_actor IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan.organization_id, plan.pic_id
    INTO v_org, v_pic
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations AS member
    WHERE member.user_id = v_actor
      AND member.organization_id = v_org
      AND COALESCE(member.is_active, true) = true
  ) THEN
    RETURN false;
  END IF;

  SELECT lower(btrim(role.role))
    INTO v_role
  FROM public.user_roles AS role
  WHERE role.user_id = v_actor
    AND role.organization_id = v_org
  ORDER BY CASE lower(btrim(role.role))
    WHEN 'owner' THEN 0
    WHEN 'admin' THEN 1
    ELSE 2
  END
  LIMIT 1;

  v_is_pic := EXISTS (
    SELECT 1
    FROM public.employees AS employee
    WHERE employee.organization_id = v_org
      AND employee.user_id = v_actor
      AND employee.id = v_pic
  );

  SELECT config.allowed_roles, config.exceptions
    INTO v_roles, v_exceptions
  FROM public.approval_access_configurations AS config
  WHERE config.organization_id = v_org
    AND config.column_type = p_field
    AND config.is_active IS TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN v_is_pic OR v_role IN ('owner', 'admin');
  END IF;

  RETURN v_role = 'owner'
    OR v_role = ANY (
      SELECT lower(btrim(allowed))
      FROM unnest(COALESCE(v_roles, ARRAY[]::text[])) AS allowed
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees AS employee
      WHERE employee.organization_id = v_org
        AND employee.user_id = v_actor
        AND employee.id::text = ANY (COALESCE(v_exceptions, ARRAY[]::text[]))
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_social_media_plan_brief_pic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_setting text;
  v_token text;
BEGIN
  IF NEW.brief IS NOT DISTINCT FROM OLD.brief THEN
    RETURN NEW;
  END IF;

  v_actor := auth.uid();
  IF v_actor IS NULL AND public.is_service_session() THEN
    v_setting := current_setting('mcp.plan_brief_user', true);
    IF v_setting IS NOT NULL AND btrim(v_setting) <> '' THEN
      BEGIN
        v_actor := btrim(v_setting)::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_actor := NULL;
      END;
    END IF;
  END IF;

  IF v_actor IS NOT NULL
     AND public.can_edit_content_brief_field(OLD.id, 'brief_storyboard', v_actor) THEN
    RETURN NEW;
  END IF;

  v_token := current_setting('ai_employee.brief_write', true);
  IF v_token IS NOT NULL AND v_token <> '' THEN
    DELETE FROM public.ai_employee_brief_tickets
    WHERE plan_id = OLD.id
      AND token = v_token;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'brief_field_forbidden'
    USING ERRCODE = 'P0001', DETAIL = 'brief_storyboard';
END;
$function$;

NOTIFY pgrst, 'reload schema';
