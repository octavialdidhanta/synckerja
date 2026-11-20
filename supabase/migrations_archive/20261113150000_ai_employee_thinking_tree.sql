-- The whole Thinking Lab tree of an AI employee's organization (Master Thought → Big Thought →
-- Territory → Angle → Idea) for the run log filters, including branches never used, so an owner
-- can see what is uneven or untouched. Owners and admins only, through the page gate.
CREATE OR REPLACE FUNCTION public.ai_employee_thinking_tree(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_focus uuid[];
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);

  SELECT COALESCE(brief.angle_ids, '{}'::uuid[])
  INTO v_focus
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
    ) nodes
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.ai_employee_thinking_tree(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_thinking_tree(uuid) TO authenticated;
