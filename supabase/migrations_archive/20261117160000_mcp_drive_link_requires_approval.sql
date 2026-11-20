-- content.plans.media.set_link follows the Office rule: a Google Drive link can
-- only be saved on a content plan whose brief is approved. Office shows
-- "Approve first to add link" and blocks the cell; the MCP RPC used to accept it.

CREATE OR REPLACE FUNCTION public.mcp_set_content_plan_drive_link(
  p_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_url text
)
RETURNS TABLE(
  id uuid,
  title text,
  google_drive_link text,
  production_status text,
  changed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_plan public.social_media_plans%ROWTYPE;
  v_status text;
  v_baseline text;
  v_same boolean;
  v_folder boolean;
  v_promote boolean := false;
  v_only_link boolean := false;
  v_employee uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_url := btrim(COALESCE(p_url, ''));
  IF char_length(v_url) < 20 OR char_length(v_url) > 2000
     OR v_url !~* '^https://'
     OR v_url !~* 'drive\.google\.com' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_folder := v_url ~* 'drive\.google\.com/drive/folders/[a-zA-Z0-9_-]+';
  IF NOT v_folder
     AND v_url !~* '/file/d/[a-zA-Z0-9_-]+'
     AND v_url !~* '/d/[a-zA-Z0-9_-]+'
     AND v_url !~* '[?&]id=[a-zA-Z0-9_-]+' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT plan.*
  INTO v_plan
  FROM public.social_media_plans plan
  WHERE plan.id = p_plan_id
    AND plan.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Office locks the Google Drive Link cell until the brief is approved
  -- (ContentPlanRow: isGoogleDriveLinkDisabled = !plan.approved). Same rule here.
  IF NOT COALESCE(v_plan.approved, false) THEN
    RAISE EXCEPTION 'not_approved' USING ERRCODE = '42501';
  END IF;

  v_status := lower(btrim(COALESCE(v_plan.production_status, '')));
  v_baseline := COALESCE(
    NULLIF(btrim(COALESCE(v_plan.production_revision_baseline_link, '')), ''),
    NULLIF(btrim(COALESCE(v_plan.google_drive_link, '')), ''),
    ''
  );
  v_same := public.mcp_drive_link_key(v_url) = public.mcp_drive_link_key(v_baseline);

  IF v_status = 'request revision' THEN
    IF v_folder AND v_same THEN
      IF btrim(COALESCE(v_plan.google_drive_link, '')) = v_url THEN
        v_promote := false;
      ELSE
        v_only_link := true;
      END IF;
    ELSIF NOT v_same THEN
      v_promote := true;
    ELSIF btrim(COALESCE(v_plan.google_drive_link, '')) = v_url THEN
      v_promote := false;
    ELSE
      v_only_link := true;
    END IF;
  ELSE
    v_promote := true;
  END IF;

  IF v_only_link THEN
    UPDATE public.social_media_plans plan
    SET google_drive_link = v_url,
        updated_at = now()
    WHERE plan.id = p_plan_id
      AND plan.organization_id = p_organization_id
    RETURNING * INTO v_plan;
  ELSIF v_promote THEN
    IF COALESCE(v_plan.pic_production_source, '') IS DISTINCT FROM 'task_steps_assigned' THEN
      SELECT emp.id
      INTO v_employee
      FROM public.employees emp
      LEFT JOIN public.employee_statuses es ON es.id = emp.employee_status_id
      WHERE emp.organization_id = p_organization_id
        AND emp.user_id = p_user_id
        AND COALESCE(emp.pending_removal, false) = false
        AND lower(COALESCE(emp.status, 'active')) NOT IN ('inactive', 'terminated', 'resigned')
        AND lower(regexp_replace(COALESCE(es.name, ''), '[\s_]+', '', 'g'))
          NOT IN ('inactive', 'terminated', 'pendingremoval')
      ORDER BY emp.id ASC
      LIMIT 1;
    END IF;

    UPDATE public.social_media_plans plan
    SET google_drive_link = v_url,
        production_status = 'Need Review',
        production_completion_date = now(),
        production_revision_baseline_link = NULL,
        pic_production_id = CASE
          WHEN COALESCE(plan.pic_production_source, '') = 'task_steps_assigned' OR v_employee IS NULL
            THEN plan.pic_production_id
          ELSE v_employee
        END,
        pic_production_source = CASE
          WHEN COALESCE(plan.pic_production_source, '') = 'task_steps_assigned' OR v_employee IS NULL
            THEN plan.pic_production_source
          ELSE 'google_drive_link'
        END,
        updated_at = now()
    WHERE plan.id = p_plan_id
      AND plan.organization_id = p_organization_id
    RETURNING * INTO v_plan;
  END IF;

  id := v_plan.id;
  title := v_plan.title;
  google_drive_link := v_plan.google_drive_link;
  production_status := v_plan.production_status;
  changed := v_only_link OR v_promote;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_set_content_plan_drive_link(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_set_content_plan_drive_link(uuid, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_content_plan_drive_link(uuid, uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.mcp_set_content_plan_drive_link(uuid, uuid, uuid, text) IS
  'MCP content.plans.media.set_link: save a Google Drive file or folder URL on one approved content plan.';
