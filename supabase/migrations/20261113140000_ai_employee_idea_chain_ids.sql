-- Run log filters (Master Thought → Big Thought → Territory → Angle → Idea) need the id of
-- every level, not only its code: codes repeat across parents.
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
      'id', angle.id,
      'code', left(COALESCE(btrim(angle.code), ''), 16),
      'statement', left(COALESCE(btrim(angle.statement), ''), 400)
    ) END,
    'territory', CASE WHEN territory.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', territory.id,
      'code', left(COALESCE(btrim(territory.code), ''), 16),
      'statement', left(COALESCE(btrim(territory.statement), ''), 400)
    ) END,
    'big_thought', CASE WHEN thought.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', thought.id,
      'code', left(COALESCE(btrim(thought.code), ''), 16),
      'statement', left(COALESCE(btrim(thought.statement), ''), 400)
    ) END,
    'master', CASE WHEN master.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', master.id,
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
