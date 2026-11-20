-- Run log on /ai-employees/{id}: where each content plan came from (Master Thought down to
-- Idea and pillar), how often that idea was used this month, the Canva result, and whether
-- the run was started by hand, by the schedule, or by a job.

ALTER TABLE public.ai_employee_runs
  ADD COLUMN IF NOT EXISTS trigger_source text,
  ADD COLUMN IF NOT EXISTS attempted_idea_id uuid,
  ADD COLUMN IF NOT EXISTS attempted_pillar_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_employee_runs_trigger_source_check'
      AND conrelid = 'public.ai_employee_runs'::regclass
  ) THEN
    ALTER TABLE public.ai_employee_runs
      ADD CONSTRAINT ai_employee_runs_trigger_source_check
      CHECK (trigger_source IS NULL OR trigger_source IN ('manual', 'schedule', 'job', 'chat'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ai_employee_runs_employee_started_idx
  ON public.ai_employee_runs (employee_id, started_at DESC);

-- Scheduled SOP1, jobs (SOP2/SOP3) and chat start here; the manual button has its own begin.
CREATE OR REPLACE FUNCTION public.ai_employee_run_start(p_employee_id uuid, p_sop_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_is_ai boolean;
  v_active boolean;
  v_performance text;
  v_run uuid;
  v_sop text := NULLIF(btrim(COALESCE(p_sop_code, '')), '');
BEGIN
  SELECT e.organization_id, e.is_ai, p.is_active, p.performance_status
  INTO v_org, v_is_ai, v_active, v_performance
  FROM public.employees e
  LEFT JOIN public.ai_employee_profiles p
    ON p.employee_id = e.id
   AND p.organization_id IS NOT DISTINCT FROM e.organization_id
  WHERE e.id = p_employee_id
  FOR UPDATE OF e;

  IF NOT FOUND OR v_org IS NULL OR COALESCE(v_is_ai, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_ai_employee' USING ERRCODE = '42501';
  END IF;

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status, trigger_source)
  VALUES (
    p_employee_id,
    v_org,
    v_sop,
    'running',
    CASE v_sop WHEN 'SOP1' THEN 'schedule' WHEN 'CHAT' THEN 'chat' ELSE 'job' END
  )
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_employee_sop1_manual_begin(p_user_id uuid, p_employee_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_active boolean;
  v_performance text;
  v_run uuid;
BEGIN
  SELECT employee.organization_id, profile.is_active, profile.performance_status
  INTO v_org, v_active, v_performance
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND COALESCE(employee.is_ai, false)
  FOR UPDATE OF employee;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.ai_employee_require_owner(p_user_id, v_org);

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_runs run
    WHERE run.employee_id = p_employee_id
      AND run.organization_id = v_org
      AND run.sop_code = 'SOP1'
      AND run.status = 'running'
  ) THEN
    RAISE EXCEPTION 'too_soon' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status, note, trigger_source)
  VALUES (p_employee_id, v_org, 'SOP1', 'running', 'manual', 'manual')
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$function$;

-- Master Thought → Big Thought → Territory → Angle → Idea of one idea, inside one organization.
CREATE OR REPLACE FUNCTION public.ai_employee_idea_chain(p_organization_id uuid, p_idea_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'idea', jsonb_build_object(
      'id', idea.id,
      'code', left(COALESCE(btrim(idea.code), ''), 16),
      'statement', left(COALESCE(btrim(idea.statement), ''), 400)
    ),
    'angle', CASE WHEN angle.id IS NULL THEN NULL ELSE jsonb_build_object(
      'code', left(COALESCE(btrim(angle.code), ''), 16),
      'statement', left(COALESCE(btrim(angle.statement), ''), 400)
    ) END,
    'territory', CASE WHEN territory.id IS NULL THEN NULL ELSE jsonb_build_object(
      'code', left(COALESCE(btrim(territory.code), ''), 16),
      'statement', left(COALESCE(btrim(territory.statement), ''), 400)
    ) END,
    'big_thought', CASE WHEN thought.id IS NULL THEN NULL ELSE jsonb_build_object(
      'code', left(COALESCE(btrim(thought.code), ''), 16),
      'statement', left(COALESCE(btrim(thought.statement), ''), 400)
    ) END,
    'master', CASE WHEN master.id IS NULL THEN NULL ELSE jsonb_build_object(
      'statement', left(COALESCE(btrim(master.statement), ''), 400)
    ) END
  )
  FROM public.thinking_lab_ideas idea
  LEFT JOIN public.thinking_lab_angles angle
    ON angle.id = idea.angle_id AND angle.organization_id = idea.organization_id
  LEFT JOIN public.thinking_lab_territories territory
    ON territory.id = angle.territory_id AND territory.organization_id = idea.organization_id
  LEFT JOIN public.thinking_big_thoughts thought
    ON thought.id = territory.big_thought_id AND thought.organization_id = idea.organization_id
  LEFT JOIN public.thinking_master_thoughts master
    ON master.id = thought.master_thought_id AND master.organization_id = idea.organization_id
  WHERE idea.id = p_idea_id
    AND idea.organization_id = p_organization_id
$function$;

REVOKE ALL ON FUNCTION public.ai_employee_idea_chain(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Content plan runs of one AI employee in one month (Asia/Jakarta), newest first, for owners and admins.
CREATE OR REPLACE FUNCTION public.ai_employee_run_log(p_employee_id uuid, p_month date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_month date;
  v_from timestamptz;
  v_to timestamptz;
  v_summary jsonb;
  v_rows jsonb;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);
  v_month := date_trunc('month', COALESCE(p_month, timezone('Asia/Jakarta', now())::date))::date;
  v_from := v_month::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_to := (v_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Jakarta';

  WITH runs AS (
    SELECT run.*
    FROM public.ai_employee_runs run
    WHERE run.employee_id = p_employee_id
      AND run.organization_id = v_org
      AND run.sop_code IN ('SOP1', 'SOP2', 'SOP3')
      AND run.started_at >= v_from
      AND run.started_at < v_to
  ),
  plans AS (
    SELECT plan.id, plan.thinking_idea_id
    FROM runs
    CROSS JOIN LATERAL unnest(COALESCE(runs.object_ids, '{}'::uuid[])) AS object_id
    JOIN public.social_media_plans plan
      ON plan.id = object_id AND plan.organization_id = v_org
  )
  SELECT jsonb_build_object(
    'runs', (SELECT count(*) FROM runs),
    'succeeded', (SELECT count(*) FROM runs WHERE status = 'succeeded'),
    'failed', (SELECT count(*) FROM runs WHERE status = 'failed'),
    'deferred', (SELECT count(*) FROM runs WHERE status IN ('deferred', 'late')),
    'running', (SELECT count(*) FROM runs WHERE status = 'running'),
    'plans', (SELECT count(*) FROM plans),
    'unique_ideas', (SELECT count(DISTINCT thinking_idea_id) FROM plans)
  )
  INTO v_summary;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY started_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT run.started_at, jsonb_build_object(
      'id', run.id,
      'sop_code', run.sop_code,
      'status', run.status,
      'trigger_source', run.trigger_source,
      'started_at', run.started_at,
      'finished_at', run.finished_at,
      'note', left(COALESCE(run.note, ''), 200),
      'plan_count', COALESCE(run.plan_count, 0),
      'attempt', CASE
        WHEN run.attempted_idea_id IS NULL AND run.attempted_pillar_id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'chain', CASE WHEN run.attempted_idea_id IS NULL THEN NULL
            ELSE public.ai_employee_idea_chain(v_org, run.attempted_idea_id) END,
          'pillar_name', (
            SELECT pillar.name FROM public.content_pillars pillar
            WHERE pillar.id = run.attempted_pillar_id
              AND (pillar.organization_id = v_org OR pillar.is_default)
          )
        )
      END,
      'plans', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', plan.id,
          'title', left(COALESCE(plan.title, ''), 200),
          'post_date', plan.post_date,
          'pillar_name', pillar.name,
          'chain', CASE WHEN plan.thinking_idea_id IS NULL THEN NULL
            ELSE public.ai_employee_idea_chain(v_org, plan.thinking_idea_id) END,
          'idea_month_count', CASE WHEN plan.thinking_idea_id IS NULL THEN 0 ELSE (
            SELECT count(*)
            FROM public.social_media_plans used
            WHERE used.organization_id = v_org
              AND used.thinking_idea_id = plan.thinking_idea_id
              AND used.created_at >= v_from
              AND used.created_at < v_to
          ) END,
          'canva', (
            SELECT jsonb_build_object(
              'status', canva.status,
              'images_ready', canva.images_ready,
              'logo_placed', canva.logo_placed,
              'error', left(COALESCE(canva.error, ''), 160),
              'design_url', canva.design_url
            )
            FROM public.canva_carousel_runs canva
            WHERE canva.social_media_plan_id = plan.id
          )
        ) ORDER BY plan.created_at)
        FROM unnest(COALESCE(run.object_ids, '{}'::uuid[])) AS object_id
        JOIN public.social_media_plans plan
          ON plan.id = object_id AND plan.organization_id = v_org
        LEFT JOIN public.content_pillars pillar
          ON pillar.id = plan.content_pillar_id
      ), '[]'::jsonb)
    ) AS row_data
    FROM public.ai_employee_runs run
    WHERE run.employee_id = p_employee_id
      AND run.organization_id = v_org
      AND run.sop_code IN ('SOP1', 'SOP2', 'SOP3')
      AND run.started_at >= v_from
      AND run.started_at < v_to
    ORDER BY run.started_at DESC
    LIMIT 300
  ) listed;

  RETURN jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'summary', v_summary,
    'rows', v_rows
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ai_employee_run_log(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_run_log(uuid, date) TO authenticated;
