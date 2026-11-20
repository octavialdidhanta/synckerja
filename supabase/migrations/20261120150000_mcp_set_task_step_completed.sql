-- MCP tool: tasks.steps.complete
-- Tandai satu step daily task selesai (atau batalkan selesai).
-- Pola sama dengan mcp_update_task_step: SECURITY DEFINER, cek member org + employee,
-- hanya bisa dipanggil service_role (server MCP).
--
-- Aturan yang sama dengan checkbox di UI (src/8-2-DailyTask/section/TaskStep.tsx):
--   * Step yang punya sub-step dikendalikan sub-step: tidak bisa dicentang selama ada sub-step
--     yang belum selesai (substeps_incomplete) dan tidak bisa dibuka lagi manual (substeps_managed).
--   * Step yang terhubung ke content plan terkunci (content_plan_locked):
--       - concept step  -> hanya boleh dicentang kalau plan.approved = true
--       - content step  -> hanya boleh dicentang kalau google_drive_link terisi atau production_approved = true

CREATE OR REPLACE FUNCTION public.mcp_set_task_step_completed(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_completed boolean DEFAULT true
)
RETURNS TABLE(id uuid, title text, step_order integer, is_completed boolean, completed_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_id uuid;
  v_title text;
  v_order integer;
  v_done boolean;
  v_completed_at timestamptz;
  v_plan_id uuid;
  v_is_concept boolean;
  v_has_substeps boolean;
  v_plan_ok boolean;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL OR p_completed IS NULL THEN
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

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Step harus milik org ini
  SELECT step.social_media_plan_id, COALESCE(step.is_concept_step, false)
  INTO v_plan_id, v_is_concept
  FROM public.task_steps step
  JOIN public.daily_tasks task ON task.id = step.task_id
  WHERE step.id = p_id
    AND task.organization_id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  v_has_substeps := EXISTS (
    SELECT 1 FROM public.task_steps_to_steps sub WHERE sub.parent_step_id = p_id
  );

  IF v_has_substeps THEN
    -- Jangan centang step kalau masih ada sub-step yang belum selesai
    IF p_completed AND EXISTS (
      SELECT 1
      FROM public.task_steps_to_steps sub
      WHERE sub.parent_step_id = p_id
        AND COALESCE(sub.is_completed, false) = false
    ) THEN
      RAISE EXCEPTION 'substeps_incomplete' USING ERRCODE = '22023';
    END IF;
    -- Step dengan sub-step dibuka lagi lewat sub-step-nya, bukan manual
    IF NOT p_completed THEN
      RAISE EXCEPTION 'substeps_managed' USING ERRCODE = '22023';
    END IF;
  ELSIF p_completed AND v_plan_id IS NOT NULL THEN
    SELECT CASE
      WHEN v_is_concept THEN COALESCE(plan.approved, false)
      ELSE NULLIF(btrim(COALESCE(plan.google_drive_link, '')), '') IS NOT NULL
        OR COALESCE(plan.production_approved, false)
    END
    INTO v_plan_ok
    FROM public.social_media_plans plan
    WHERE plan.id = v_plan_id;
    IF NOT COALESCE(v_plan_ok, false) THEN
      RAISE EXCEPTION 'content_plan_locked' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.task_steps step
  SET
    is_completed = p_completed,
    completed_at = CASE
      WHEN p_completed THEN COALESCE(step.completed_at, now())
      ELSE NULL
    END,
    updated_at = now()
  WHERE step.id = p_id
  RETURNING step.id, step.title, step."order", step.is_completed, step.completed_at
  INTO v_id, v_title, v_order, v_done, v_completed_at;

  id := v_id;
  title := v_title;
  step_order := v_order;
  is_completed := v_done;
  completed_at := v_completed_at;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_set_task_step_completed(uuid, uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_set_task_step_completed(uuid, uuid, uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_task_step_completed(uuid, uuid, uuid, boolean) TO service_role;
