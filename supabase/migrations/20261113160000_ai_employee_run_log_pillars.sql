-- Run log: the pillar filter needs each plan's and each attempt's pillar id, and the list of
-- pillars the employee may use (sent with the Thinking Lab tree as level 'pillar').

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
          'pillar_id', run.attempted_pillar_id,
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
          'pillar_id', plan.content_pillar_id,
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

CREATE OR REPLACE FUNCTION public.ai_employee_thinking_tree(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_focus uuid[];
  v_pillars uuid[];
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);

  SELECT COALESCE(brief.angle_ids, '{}'::uuid[]), COALESCE(brief.pillar_ids, '{}'::uuid[])
  INTO v_focus, v_pillars
  FROM public.ai_employee_briefs brief
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;

  RETURN COALESCE((
    SELECT jsonb_agg(node ORDER BY depth, sort_key, created_at)
    FROM (
      SELECT 0 AS depth, master.created_at, 0 AS sort_key, jsonb_build_object(
        'level', 'master', 'id', master.id, 'parent_id', NULL, 'code', '',
        'label', left(COALESCE(btrim(master.statement), ''), 200),
        'ready', master.status = 'locked', 'in_focus', false
      ) AS node
      FROM public.thinking_master_thoughts master
      WHERE master.organization_id = v_org AND master.workspace = 'thinking_lab'

      UNION ALL
      SELECT 1, thought.created_at, COALESCE(thought.sort_order, 0), jsonb_build_object(
        'level', 'bigThought', 'id', thought.id, 'parent_id', thought.master_thought_id,
        'code', left(COALESCE(btrim(thought.code), ''), 16),
        'label', left(COALESCE(NULLIF(btrim(thought.title), ''), btrim(thought.statement), ''), 200),
        'ready', thought.status = 'locked', 'in_focus', false
      )
      FROM public.thinking_big_thoughts thought
      JOIN public.thinking_master_thoughts master
        ON master.id = thought.master_thought_id AND master.organization_id = v_org AND master.workspace = 'thinking_lab'
      WHERE thought.organization_id = v_org

      UNION ALL
      SELECT 2, territory.created_at, COALESCE(territory.sort_order, 0), jsonb_build_object(
        'level', 'territory', 'id', territory.id, 'parent_id', territory.big_thought_id,
        'code', left(COALESCE(btrim(territory.code), ''), 16),
        'label', left(COALESCE(btrim(territory.statement), ''), 200),
        'ready', territory.status = 'locked', 'in_focus', false
      )
      FROM public.thinking_lab_territories territory
      WHERE territory.organization_id = v_org

      UNION ALL
      SELECT 3, angle.created_at, COALESCE(angle.sort_order, 0), jsonb_build_object(
        'level', 'angle', 'id', angle.id, 'parent_id', angle.territory_id,
        'code', left(COALESCE(btrim(angle.code), ''), 16),
        'label', left(COALESCE(btrim(angle.statement), ''), 200),
        'ready', angle.status = 'locked' AND angle.admission = 'GENERATE_VALID',
        'in_focus', angle.id = ANY (COALESCE(v_focus, '{}'::uuid[]))
      )
      FROM public.thinking_lab_angles angle
      WHERE angle.organization_id = v_org

      UNION ALL
      SELECT 4, idea.created_at, COALESCE(idea.sort_order, 0), jsonb_build_object(
        'level', 'idea', 'id', idea.id, 'parent_id', idea.angle_id,
        'code', left(COALESCE(btrim(idea.code), ''), 16),
        'label', left(COALESCE(btrim(idea.statement), ''), 200),
        'ready', idea.status = 'locked' AND COALESCE(idea.validation ->> 'decision', '') = 'LOLOS',
        'in_focus', false
      )
      FROM public.thinking_lab_ideas idea
      WHERE idea.organization_id = v_org

      -- Pillars the employee may use: the brief's pillars, or every active pillar of the
      -- organization plus the defaults when the brief names none.
      UNION ALL
      SELECT 5, pillar.created_at, 0, jsonb_build_object(
        'level', 'pillar', 'id', pillar.id, 'parent_id', NULL, 'code', '',
        'label', left(COALESCE(btrim(pillar.name), ''), 120),
        'ready', true, 'in_focus', pillar.id = ANY (COALESCE(v_pillars, '{}'::uuid[]))
      )
      FROM public.content_pillars pillar
      WHERE COALESCE(pillar.is_active, true)
        AND (pillar.organization_id = v_org OR pillar.is_default)
        AND (COALESCE(cardinality(v_pillars), 0) = 0 OR pillar.id = ANY (v_pillars))
    ) nodes
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.ai_employee_thinking_tree(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_thinking_tree(uuid) TO authenticated;
