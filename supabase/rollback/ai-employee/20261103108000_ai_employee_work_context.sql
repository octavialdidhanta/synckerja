-- Kembalikan pintu konteks dan perform ke badan sebelum brief kerja.
-- Tidak menghapus plan yang sudah terhubung ke Idea; kolom thinking_idea_id ikut dihapus.
-- Execution yang author_employee_id-nya terisi dihapus supaya indeks unik lama bisa kembali.

CREATE OR REPLACE FUNCTION public.ai_employee_context(
  p_employee_id uuid,
  p_run_id uuid,
  p_scope text,
  p_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_from date;
  v_to date;
  v_rows jsonb;
BEGIN
  IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks') THEN
    RAISE EXCEPTION 'scope_forbidden' USING ERRCODE = '42501';
  END IF;

  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);
  v_from := COALESCE((NULLIF(p_params->>'from', ''))::date, (timezone('Asia/Jakarta', now()))::date);
  v_to := COALESCE((NULLIF(p_params->>'to', ''))::date, v_from + 7);

  IF p_scope IN ('plans', 'calendar') THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT p.id, p.title, p.brief, p.post_date, p.production_status,
             p.content_pillar_id, p.approved, p.production_approved
      FROM public.social_media_plans p
      WHERE p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
        AND (
          p_scope = 'plans'
          OR (timezone('Asia/Jakarta', p.post_date))::date BETWEEN v_from AND v_to
        )
      ORDER BY p.post_date DESC NULLS LAST
      LIMIT 100
    ) x;
  ELSIF p_scope = 'catalog' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT s.id, s.name
      FROM public.services s
      WHERE s.organization_id = v_org
        AND s.is_active
      ORDER BY s.name
      LIMIT 100
    ) x;
  ELSIF p_scope = 'pillars' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT c.id, c.name
      FROM public.content_pillars c
      WHERE c.is_active
        AND (c.organization_id = v_org OR c.is_default)
      ORDER BY c.name
      LIMIT 100
    ) x;
  ELSIF p_scope = 'thinking' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.statement
      FROM public.thinking_master_thoughts t
      WHERE t.organization_id = v_org
        AND t.status = 'locked'
      ORDER BY t.updated_at DESC
      LIMIT 100
    ) x;
  ELSIF p_scope = 'feedback' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT f.id, f.object_type, f.object_id, f.reason, f.expires_at
      FROM public.ai_employee_feedback f
      WHERE f.employee_id = p_employee_id
        AND f.organization_id = v_org
        AND f.dismissed_at IS NULL
        AND f.expires_at > now()
      ORDER BY f.created_at DESC
      LIMIT 10
    ) x;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.title, t.status, t.due_date, t.priority, t.ai_revision_count,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'title', s.title,
              'order', s."order",
              'is_completed', s.is_completed
            )
            ORDER BY s."order"
          )
          FROM public.task_steps s
          WHERE s.task_id = t.id
        ), '[]'::jsonb) AS steps
      FROM public.daily_tasks t
      WHERE t.organization_id = v_org
        AND (
          t.requested_ai_employee_id = p_employee_id
          OR EXISTS (
            SELECT 1 FROM public.daily_tasks_assigned a
            WHERE a.daily_task_id = t.id
              AND a.employee_id = p_employee_id
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 100
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'scope', p_scope,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_perform(
  p_employee_id uuid,
  p_run_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_payload_org uuid;
  v_id uuid;
  v_task uuid;
  v_parent uuid;
  v_assigner uuid;
  v_title text;
  v_brief text;
  v_pillar uuid;
  v_post timestamptz;
  v_order integer;
  v_entity text;
  v_brief_token text;
BEGIN
  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);

  IF p_action = ANY (ARRAY[
    'content.plans.schedule',
    'tasks.delete',
    'tasks.steps.delete',
    'tasks.substeps.delete',
    'session.switchOrg'
  ]) OR p_action LIKE 'finance.%'
    OR p_action LIKE 'payroll.%'
    OR p_action LIKE 'hr.%'
    OR p_action LIKE 'crm.%'
    OR p_action LIKE 'ads.%'
  THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT (p_action = ANY (ARRAY[
    'content.plans.create',
    'content.plans.update',
    'content.briefs.create',
    'thinking.plan.save',
    'thinking.plan.direct',
    'thinking.execution.check',
    'tasks.update',
    'tasks.steps.create',
    'tasks.steps.update',
    'tasks.substeps.create',
    'tasks.completion.request'
  ])) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_permissions perm
    WHERE perm.employee_id = p_employee_id
      AND perm.action_code = p_action
  ) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_payload->>'approved', '') IN ('true', 't', '1')
    OR COALESCE(v_payload->>'production_approved', '') IN ('true', 't', '1')
    OR lower(btrim(COALESCE(v_payload->>'production_status', ''))) = 'approved'
    OR (
      p_action = 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', 'pending'))) <> 'pending'
    )
    OR (
      p_action LIKE 'tasks.%'
      AND p_action <> 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', ''))) IN ('completed', 'cancelled', 'approved')
    )
  THEN
    RAISE EXCEPTION 'approval_forbidden' USING ERRCODE = '42501';
  END IF;

  IF jsonb_exists(v_payload, 'organization_id') THEN
    BEGIN
      v_payload_org := NULLIF(v_payload->>'organization_id', '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END;
    IF v_payload_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'thinking.execution.check' THEN
    RETURN jsonb_build_object('ok', true, 'accepted', true, 'model_call', true);
  END IF;

  IF p_action IN ('content.plans.create', 'thinking.plan.save', 'thinking.plan.direct') THEN
    v_title := NULLIF(btrim(COALESCE(v_payload->>'title', '')), '');
    v_brief := NULLIF(v_payload->>'brief', '');
    IF v_title IS NULL OR char_length(v_title) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF v_brief IS NOT NULL AND char_length(v_brief) > 200000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(v_payload->>'post_date', '') IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';

    IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL
      OR p_action LIKE 'thinking.%'
    THEN
      v_pillar := NULLIF(v_payload->>'content_pillar_id', '')::uuid;
      IF v_pillar IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.content_pillars c
        WHERE c.id = v_pillar
          AND c.is_active
          AND (c.organization_id = v_org OR c.is_default)
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id,
      author_employee_id, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar,
      p_employee_id, 'Need Review', false, false, 'draft'
    )
    RETURNING id INTO v_id;

    UPDATE public.ai_employee_runs
    SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END,
        plan_count = plan_count + 1
    WHERE id = p_run_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action IN ('content.plans.update', 'content.briefs.create') THEN
    v_id := NULLIF(v_payload->>'plan_id', '')::uuid;
    IF v_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.social_media_plans p
      WHERE p.id = v_id
        AND p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'content.briefs.create' THEN
      v_brief := NULLIF(v_payload->>'brief', '');
      IF v_brief IS NULL THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET brief = v_brief,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    ELSE
      IF jsonb_exists(v_payload, 'title') THEN
        v_title := NULLIF(btrim(v_payload->>'title'), '');
        IF v_title IS NULL OR char_length(v_title) > 200 THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NULLIF(v_payload->>'post_date', '') IS NOT NULL THEN
        v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';
      END IF;
      IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL THEN
        v_pillar := (v_payload->>'content_pillar_id')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.content_pillars c
          WHERE c.id = v_pillar
            AND c.is_active
            AND (c.organization_id = v_org OR c.is_default)
        ) THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET title = COALESCE(v_title, title),
          brief = CASE WHEN jsonb_exists(v_payload, 'brief') THEN v_payload->>'brief' ELSE brief END,
          post_date = COALESCE(v_post, post_date),
          content_pillar_id = COALESCE(v_pillar, content_pillar_id),
          author_employee_id = p_employee_id,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.update' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.daily_tasks
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        priority = COALESCE(NULLIF(v_payload->>'priority', ''), priority),
        due_date = CASE
          WHEN NULLIF(v_payload->>'due_date', '') IS NULL THEN due_date
          ELSE (v_payload->>'due_date')::timestamptz
        END,
        updated_at = now()
    WHERE id = v_task
      AND organization_id = v_org;
    RETURN jsonb_build_object('ok', true, 'id', v_task);
  END IF;

  IF p_action = 'tasks.steps.create' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_title := COALESCE(NULLIF(v_payload->>'title', ''), '');
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps (task_id, title, description, "order")
    VALUES (v_task, v_title, v_payload->>'description', v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_steps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.steps.update' THEN
    v_id := NULLIF(v_payload->>'step_id', '')::uuid;
    SELECT task_id INTO v_task FROM public.task_steps WHERE id = v_id;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.task_steps
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        "order" = COALESCE((NULLIF(v_payload->>'order', ''))::integer, "order"),
        is_completed = CASE
          WHEN jsonb_exists(v_payload, 'is_completed') THEN (v_payload->>'is_completed')::boolean
          ELSE is_completed
        END,
        updated_at = now()
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.substeps.create' THEN
    v_parent := NULLIF(v_payload->>'parent_step_id', '')::uuid;
    SELECT s.task_id INTO v_task
    FROM public.task_steps s
    JOIN public.daily_tasks t ON t.id = s.task_id
    WHERE s.id = v_parent
      AND t.organization_id = v_org;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps_to_steps (parent_step_id, organization_id, title, "order")
    VALUES (v_parent, v_org, COALESCE(NULLIF(v_payload->>'title', ''), ''), v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_substeps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  v_entity := COALESCE(NULLIF(v_payload->>'entity_type', ''), 'task');
  IF v_entity NOT IN ('task', 'step', 'substep') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_task := NULLIF(v_payload->>'task_id', '')::uuid;
  IF v_entity = 'step' THEN
    SELECT task_id INTO v_task
    FROM public.task_steps
    WHERE id = NULLIF(v_payload->>'step_id', '')::uuid;
  ELSIF v_entity = 'substep' THEN
    SELECT s.task_id INTO v_task
    FROM public.task_steps_to_steps sub
    JOIN public.task_steps s ON s.id = sub.parent_step_id
    WHERE sub.id = NULLIF(v_payload->>'substep_id', '')::uuid;
  END IF;

  PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);

  SELECT a.assigned_by INTO v_assigner
  FROM public.daily_tasks_assigned a
  WHERE a.daily_task_id = v_task
  ORDER BY a.assigned_at DESC
  LIMIT 1;

  IF v_assigner IS NULL THEN
    RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.completion_approvals (
    organization_id, entity_type, daily_task_id, task_step_id, task_steps_to_steps_id,
    assignee_employee_id, assigner_employee_id, status
  ) VALUES (
    v_org,
    v_entity,
    v_task,
    NULLIF(v_payload->>'step_id', '')::uuid,
    NULLIF(v_payload->>'substep_id', '')::uuid,
    p_employee_id,
    v_assigner,
    'pending'
  )
  RETURNING id INTO v_id;

  UPDATE public.ai_employee_runs
  SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END
  WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_save_thinking_execution(
  p_user_id uuid,
  p_organization_id uuid,
  p_idea_id uuid,
  p_content_pillar_id uuid,
  p_statement text,
  p_script jsonb,
  p_facts jsonb,
  p_admission text
)
RETURNS TABLE (
  id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_pillar_name text;
  v_existing uuid;
  v_id uuid;
  v_statement text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_idea_id IS NULL OR p_content_pillar_id IS NULL THEN
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.thinking_lab_ideas idea
    WHERE idea.id = p_idea_id
      AND idea.organization_id = p_organization_id
      AND idea.status = 'locked'
      AND idea.validation->>'decision' = 'LOLOS'
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT pillar.name
  INTO v_pillar_name
  FROM public.content_pillars pillar
  WHERE pillar.id = p_content_pillar_id
    AND pillar.is_active = true
    AND (pillar.organization_id = p_organization_id OR pillar.is_default = true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_statement := NULLIF(left(btrim(COALESCE(p_statement, '')), 20000), '');
  IF v_statement IS NULL
    OR p_admission IS DISTINCT FROM 'GENERATE_VALID'
    OR jsonb_typeof(p_script) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_facts) IS DISTINCT FROM 'object'
    OR COALESCE(p_facts->>'relationToParent', '') IS DISTINCT FROM 'VALID_EXECUTION'
    OR COALESCE(p_facts->>'resolution', '') IS DISTINCT FROM 'RESOLVED'
    OR position('portraitPath' IN p_script::text) > 0
    OR position('bodyPath' IN p_script::text) > 0
    OR position('sheetPath' IN p_script::text) > 0
    OR position('locationPath' IN p_script::text) > 0
    OR position('propertyPath' IN p_script::text) > 0
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT ex.id
  INTO v_existing
  FROM public.thinking_lab_executions ex
  WHERE ex.organization_id = p_organization_id
    AND ex.idea_id = p_idea_id
    AND ex.content_pillar_id = p_content_pillar_id
    AND ex.creative_idea_id IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.thinking_lab_executions ex
    SET pillar = p_content_pillar_id::text,
        pillar_name = v_pillar_name,
        statement = v_statement,
        script = p_script,
        canonical_semantic = p_facts || jsonb_build_object('pillar', v_pillar_name),
        admission = 'GENERATE_VALID'
    WHERE ex.id = v_existing
      AND ex.organization_id = p_organization_id
    RETURNING ex.id INTO v_id;
  ELSE
    INSERT INTO public.thinking_lab_executions (
      organization_id,
      idea_id,
      pillar,
      content_pillar_id,
      pillar_name,
      statement,
      script,
      canonical_semantic,
      admission
    )
    VALUES (
      p_organization_id,
      p_idea_id,
      p_content_pillar_id::text,
      p_content_pillar_id,
      v_pillar_name,
      v_statement,
      p_script,
      p_facts || jsonb_build_object('pillar', v_pillar_name),
      'GENERATE_VALID'
    )
    RETURNING thinking_lab_executions.id INTO v_id;
  END IF;

  id := v_id;
  RETURN NEXT;
END;
$mcp$;

DELETE FROM public.thinking_lab_executions WHERE author_employee_id IS NOT NULL;

DROP INDEX IF EXISTS public.thinking_lab_executions_legacy_idea_pillar_human_key;
DROP INDEX IF EXISTS public.thinking_lab_executions_legacy_idea_content_pillar_human_key;
DROP INDEX IF EXISTS public.thinking_lab_executions_legacy_idea_pillar_author_key;
DROP INDEX IF EXISTS public.thinking_lab_executions_legacy_idea_content_pillar_author_key;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_pillar_key
  ON public.thinking_lab_executions (idea_id, pillar)
  WHERE creative_idea_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_content_pillar_key
  ON public.thinking_lab_executions (idea_id, content_pillar_id)
  WHERE creative_idea_id IS NULL AND content_pillar_id IS NOT NULL;

ALTER TABLE public.thinking_lab_executions
  DROP CONSTRAINT IF EXISTS thinking_lab_executions_author_employee_fkey;
ALTER TABLE public.thinking_lab_executions
  DROP COLUMN IF EXISTS author_employee_id;

DROP FUNCTION IF EXISTS public.ai_employee_accept_execution(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.ai_employee_accept_execution(uuid, jsonb);
DROP FUNCTION IF EXISTS public.ai_employee_brief_write(uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.ai_employee_brief_read(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.ai_employee_brief_payload(uuid);
DROP FUNCTION IF EXISTS public.ai_employee_brief_ids(jsonb);
DROP FUNCTION IF EXISTS public.ai_employee_require_owner(uuid, uuid);

DROP INDEX IF EXISTS public.social_media_plans_one_idea_idx;
ALTER TABLE public.social_media_plans
  DROP CONSTRAINT IF EXISTS social_media_plans_thinking_idea_fkey;
ALTER TABLE public.social_media_plans
  DROP COLUMN IF EXISTS thinking_idea_id;

DROP TABLE IF EXISTS public.ai_employee_briefs;
