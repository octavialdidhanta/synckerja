-- Pillar ids locked on each angle, so the brief dropdown can hide pillars Naya cannot use.

CREATE OR REPLACE FUNCTION public.ai_employee_angle_options(
  p_organization_id uuid,
  p_selected uuid[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $options$
  WITH linked AS (
    SELECT
      angle.id,
      left(COALESCE(btrim(master.statement), ''), 240) AS master,
      master.service_id,
      left(COALESCE(btrim(angle.code), ''), 16) AS code,
      left(
        COALESCE(
          NULLIF(btrim(angle.canonical_semantic->>'subject'), ''),
          NULLIF(btrim(angle.code), ''),
          'Angle'
        ),
        80
      ) AS name,
      left(COALESCE(btrim(angle.statement), ''), 500) AS statement,
      angle.admission,
      master.statement AS master_sort
    FROM public.thinking_lab_angles angle
    JOIN public.thinking_lab_territories territory
      ON territory.id = angle.territory_id
     AND territory.organization_id = angle.organization_id
    JOIN public.thinking_big_thoughts thought
      ON thought.id = territory.big_thought_id
     AND thought.organization_id = angle.organization_id
    JOIN public.thinking_master_thoughts master
      ON master.id = thought.master_thought_id
     AND master.organization_id = angle.organization_id
     AND master.workspace = 'thinking_lab'
    WHERE angle.organization_id = p_organization_id
  ),
  chosen AS (
    SELECT fresh.id
    FROM (
      SELECT linked.id
      FROM linked
      WHERE linked.admission = 'GENERATE_VALID'
      ORDER BY linked.master_sort, linked.code
      LIMIT 200
    ) fresh
    UNION
    SELECT linked.id
    FROM linked
    WHERE linked.id = ANY (COALESCE(p_selected, '{}'::uuid[]))
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', 'Angle - ' || item.code,
    'master', item.master,
    'code', item.code,
    'name', item.name,
    'statement', item.statement,
    'service_id', item.service_id,
    'ideas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', idea.id,
        'code', left(COALESCE(btrim(idea.code), ''), 16),
        'name', left(
          COALESCE(
            NULLIF(btrim(idea.canonical_semantic->>'subject'), ''),
            NULLIF(btrim(idea.code), ''),
            'Idea'
          ),
          80
        ),
        'statement', left(COALESCE(btrim(idea.statement), ''), 400)
      ) ORDER BY idea.sort_order, idea.code)
      FROM (
        SELECT idea.id, idea.code, idea.statement, idea.canonical_semantic, idea.sort_order
        FROM public.thinking_lab_ideas idea
        WHERE idea.angle_id = item.id
          AND idea.organization_id = p_organization_id
          AND idea.status = 'locked'
          AND idea.validation->>'decision' = 'LOLOS'
        ORDER BY idea.sort_order, idea.code
        LIMIT 12
      ) idea
    ), '[]'::jsonb),
    'pillar_ids', COALESCE((
      SELECT jsonb_agg(DISTINCT pillar.id)
      FROM public.thinking_lab_ideas idea
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(idea.development_paths, '[]'::jsonb)) AS path
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(path->'reviews', '[]'::jsonb)) AS review
      JOIN public.content_pillars pillar
        ON pillar.id = CASE
          WHEN path->>'contentPillarId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (path->>'contentPillarId')::uuid
          ELSE NULL
        END
       AND pillar.is_active
       AND (pillar.organization_id = p_organization_id OR pillar.is_default)
      WHERE idea.angle_id = item.id
        AND idea.organization_id = p_organization_id
        AND idea.status = 'locked'
        AND idea.validation->>'decision' = 'LOLOS'
        AND path->>'status' = 'RECOMMENDED'
        AND (
          path->'format' = 'null'::jsonb
          OR path->>'format' IS NULL
          OR path->>'format' = 'carousel'
        )
        AND review->>'contentPillarId' = path->>'contentPillarId'
        AND btrim(COALESCE(review->>'development', '')) <> ''
    ), '[]'::jsonb),
    'other_idea_count', (
      SELECT count(*)::int
      FROM public.thinking_lab_ideas idea
      WHERE idea.angle_id = item.id
        AND idea.organization_id = p_organization_id
        AND NOT (idea.status = 'locked' AND idea.validation->>'decision' = 'LOLOS')
    )
  ) ORDER BY item.master, item.code), '[]'::jsonb)
  FROM linked item
  WHERE item.id IN (SELECT chosen.id FROM chosen);
$options$;

REVOKE ALL ON FUNCTION public.ai_employee_angle_options(uuid, uuid[])
  FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
