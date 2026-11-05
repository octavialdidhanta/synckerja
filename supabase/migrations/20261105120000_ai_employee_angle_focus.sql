-- Fokus angle Content Plan Carousel: maksimal 3 angle, jalur pilar yang sudah di-lock,
-- dan satu pengulangan bila tayangan serta engagement berada di atas median organisasi.

ALTER TABLE public.ai_employee_briefs
  ADD COLUMN IF NOT EXISTS angle_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS repeat_voices text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.ai_employee_briefs
  DROP CONSTRAINT IF EXISTS ai_employee_briefs_text_length;

ALTER TABLE public.ai_employee_briefs
  ADD CONSTRAINT ai_employee_briefs_text_length CHECK (
    char_length(audience) <= 1000
    AND char_length(voice) <= 1000
    AND char_length(required_notes) <= 2000
    AND char_length(forbidden_notes) <= 2000
    AND char_length(split_rule) <= 1000
    AND cardinality(service_ids) <= 12
    AND cardinality(persona_ids) <= 12
    AND cardinality(pillar_ids) <= 12
    AND cardinality(product_knowledge_ids) <= 12
    AND cardinality(angle_ids) <= 3
    AND cardinality(repeat_voices) <= 3
  );

CREATE OR REPLACE FUNCTION public.ai_employee_repeat_voices_ok(p_voices text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $ok$
  SELECT COALESCE(
    bool_and(char_length(btrim(voice)) BETWEEN 1 AND 500),
    true
  )
  FROM unnest(COALESCE(p_voices, '{}'::text[])) AS voice;
$ok$;

REVOKE ALL ON FUNCTION public.ai_employee_repeat_voices_ok(text[])
  FROM PUBLIC, anon, authenticated, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_repeat_voices_ok(text[]) TO service_role;

ALTER TABLE public.ai_employee_briefs
  DROP CONSTRAINT IF EXISTS ai_employee_briefs_repeat_voices_check;

ALTER TABLE public.ai_employee_briefs
  ADD CONSTRAINT ai_employee_briefs_repeat_voices_check CHECK (
    public.ai_employee_repeat_voices_ok(repeat_voices)
  );

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS delivery_voice text;

ALTER TABLE public.social_media_plans
  DROP CONSTRAINT IF EXISTS social_media_plans_delivery_voice_check;

ALTER TABLE public.social_media_plans
  ADD CONSTRAINT social_media_plans_delivery_voice_check CHECK (
    delivery_voice IS NULL OR char_length(btrim(delivery_voice)) BETWEEN 1 AND 500
  );

COMMENT ON COLUMN public.social_media_plans.delivery_voice IS
  'Gaya bahasa cadangan pada plan ulang. NULL pada plan pertama jalur itu.';

DROP INDEX IF EXISTS public.social_media_plans_one_idea_idx;

CREATE UNIQUE INDEX IF NOT EXISTS social_media_plans_idea_pillar_voice_idx
  ON public.social_media_plans (
    organization_id,
    thinking_idea_id,
    content_pillar_id,
    coalesce(delivery_voice, '')
  )
  WHERE thinking_idea_id IS NOT NULL
    AND content_pillar_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.content_plan_post_metrics (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  platform text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, platform),
  CONSTRAINT content_plan_post_metrics_platform_check CHECK (
    platform = ANY (ARRAY['tiktok'::text, 'instagram'::text])
  ),
  CONSTRAINT content_plan_post_metrics_counts_check CHECK (
    views >= 0 AND likes >= 0 AND comments >= 0 AND shares >= 0
  )
);

CREATE INDEX IF NOT EXISTS content_plan_post_metrics_org_fetched_idx
  ON public.content_plan_post_metrics (organization_id, fetched_at DESC);

ALTER TABLE public.content_plan_post_metrics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_plan_post_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_plan_post_metrics TO service_role;

COMMENT ON TABLE public.content_plan_post_metrics IS
  'Angka organik terakhir yang tertaut ke satu content plan. Diisi saat metrik TikTok atau Instagram disegarkan.';

CREATE OR REPLACE FUNCTION public.ai_employee_brief_voices(p_values jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $voices$
DECLARE
  v_voices text[] := '{}';
  v_text text;
BEGIN
  IF p_values IS NULL OR jsonb_typeof(p_values) = 'null' THEN
    RETURN v_voices;
  END IF;
  IF jsonb_typeof(p_values) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  FOR v_text IN
    SELECT btrim(item)
    FROM jsonb_array_elements_text(p_values) AS element(item)
  LOOP
    IF v_text = '' THEN
      CONTINUE;
    END IF;
    IF char_length(v_text) > 500 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF NOT (v_text = ANY (v_voices)) THEN
      v_voices := v_voices || v_text;
    END IF;
  END LOOP;
  RETURN v_voices;
END;
$voices$;

REVOKE ALL ON FUNCTION public.ai_employee_brief_voices(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

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
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  FROM (
    SELECT angle.id, angle.label
    FROM (
      SELECT angle.id,
             left(btrim(master.statement), 80) || ' · ' || left(btrim(angle.code), 16)
               || ' · ' || left(btrim(angle.statement), 80) AS label
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
        AND angle.admission = 'GENERATE_VALID'
      ORDER BY master.statement, angle.code
      LIMIT 200
    ) angle
    UNION
    SELECT angle.id,
           left(btrim(master.statement), 80) || ' · ' || left(btrim(angle.code), 16)
             || ' · ' || left(btrim(angle.statement), 80) AS label
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
      AND angle.id = ANY (COALESCE(p_selected, '{}'::uuid[]))
  ) item;
$options$;

REVOKE ALL ON FUNCTION public.ai_employee_angle_options(uuid, uuid[])
  FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_brief_payload(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $payload$
DECLARE
  v_row public.ai_employee_briefs%ROWTYPE;
  v_org uuid;
BEGIN
  SELECT * INTO v_row FROM public.ai_employee_briefs WHERE employee_id = p_employee_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'service_ids', '[]'::jsonb,
      'services', '[]'::jsonb,
      'audience', '',
      'persona_ids', '[]'::jsonb,
      'personas', '[]'::jsonb,
      'voice', '',
      'required_notes', '',
      'forbidden_notes', '',
      'pillar_ids', '[]'::jsonb,
      'split_rule', '',
      'product_knowledge_ids', '[]'::jsonb,
      'products', '[]'::jsonb,
      'angle_ids', '[]'::jsonb,
      'angles', '[]'::jsonb,
      'repeat_voices', '[]'::jsonb
    );
  END IF;
  v_org := v_row.organization_id;
  RETURN jsonb_build_object(
    'service_ids', to_jsonb(v_row.service_ids),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', svc.id, 'name', left(btrim(svc.name), 80)) ORDER BY svc.name)
      FROM public.services svc
      WHERE svc.organization_id = v_org
        AND svc.id = ANY (v_row.service_ids)
        AND COALESCE(svc.is_active, true)
    ), '[]'::jsonb),
    'audience', v_row.audience,
    'persona_ids', to_jsonb(v_row.persona_ids),
    'personas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', knowledge.id,
        'audience', left(btrim(COALESCE(
          CASE jsonb_typeof(knowledge.target_audience)
            WHEN 'string' THEN knowledge.target_audience #>> '{}'
            WHEN 'array' THEN knowledge.target_audience #>> '{0}'
            ELSE COALESCE(
              knowledge.target_audience->>'name',
              knowledge.target_audience->>'description',
              knowledge.target_audience->>'persona',
              ''
            )
          END, '')), 500)
      ) ORDER BY knowledge.created_at)
      FROM public.product_knowledge knowledge
      WHERE knowledge.organization_id = v_org
        AND knowledge.id = ANY (v_row.persona_ids)
    ), '[]'::jsonb),
    'voice', v_row.voice,
    'required_notes', v_row.required_notes,
    'forbidden_notes', v_row.forbidden_notes,
    'pillar_ids', to_jsonb(v_row.pillar_ids),
    'split_rule', v_row.split_rule,
    'product_knowledge_ids', to_jsonb(v_row.product_knowledge_ids),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', knowledge.id,
        'feature_name', left(btrim(knowledge.feature_name), 80),
        'service_name', left(btrim(COALESCE(svc.name, '')), 80),
        'sub_service_name', left(btrim(COALESCE(sub.name, '')), 80),
        'audience', left(btrim(COALESCE(public.ai_employee_product_clip(knowledge.target_audience, 160), '')), 160)
      ) ORDER BY knowledge.feature_name)
      FROM public.product_knowledge knowledge
      LEFT JOIN public.services svc
        ON svc.id = knowledge.service_id
       AND svc.organization_id = knowledge.organization_id
      LEFT JOIN public.sub_services sub
        ON sub.id = knowledge.sub_service_id
       AND sub.organization_id = knowledge.organization_id
      WHERE knowledge.organization_id = v_org
        AND knowledge.id = ANY (v_row.product_knowledge_ids)
    ), '[]'::jsonb),
    'angle_ids', to_jsonb(v_row.angle_ids),
    'angles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', picked.id, 'label', picked.label) ORDER BY picked.label)
      FROM jsonb_to_recordset(public.ai_employee_angle_options(v_org, v_row.angle_ids))
        AS picked(id uuid, label text)
      WHERE picked.id = ANY (v_row.angle_ids)
    ), '[]'::jsonb),
    'repeat_voices', to_jsonb(v_row.repeat_voices)
  );
END;
$payload$;

CREATE OR REPLACE FUNCTION public.ai_employee_brief_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_brief jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $write$
DECLARE
  v_previous jsonb;
  v_services uuid[];
  v_personas uuid[];
  v_pillars uuid[];
  v_products uuid[];
  v_angles uuid[];
  v_voices text[];
  v_has_angles boolean;
  v_has_voices boolean;
  v_audience text;
  v_voice text;
  v_required text;
  v_forbidden text;
  v_split text;
BEGIN
  PERFORM public.ai_employee_require_owner(p_user_id, p_organization_id);
  IF p_brief IS NULL OR jsonb_typeof(p_brief) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  v_services := public.ai_employee_brief_ids(p_brief->'service_ids');
  v_personas := public.ai_employee_brief_ids(p_brief->'persona_ids');
  v_pillars := public.ai_employee_brief_ids(p_brief->'pillar_ids');
  v_products := public.ai_employee_brief_ids(p_brief->'product_knowledge_ids');
  v_has_angles := p_brief ? 'angle_ids';
  v_has_voices := p_brief ? 'repeat_voices';
  v_angles := CASE
    WHEN v_has_angles THEN public.ai_employee_brief_ids(p_brief->'angle_ids')
    ELSE '{}'::uuid[]
  END;
  v_voices := CASE
    WHEN v_has_voices THEN public.ai_employee_brief_voices(p_brief->'repeat_voices')
    ELSE '{}'::text[]
  END;
  v_audience := left(btrim(COALESCE(p_brief->>'audience', '')), 1001);
  v_voice := left(btrim(COALESCE(p_brief->>'voice', '')), 1001);
  v_required := left(btrim(COALESCE(p_brief->>'required_notes', '')), 2001);
  v_forbidden := left(btrim(COALESCE(p_brief->>'forbidden_notes', '')), 2001);
  v_split := left(btrim(COALESCE(p_brief->>'split_rule', '')), 1001);
  IF char_length(v_audience) > 1000
    OR char_length(v_voice) > 1000
    OR char_length(v_required) > 2000
    OR char_length(v_forbidden) > 2000
    OR char_length(v_split) > 1000
    OR cardinality(v_services) > 12
    OR cardinality(v_personas) > 12
    OR cardinality(v_pillars) > 12
    OR cardinality(v_products) > 12
    OR (v_has_angles AND cardinality(v_angles) > 3)
    OR (v_has_voices AND cardinality(v_voices) > 3)
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_services) AS picked(picked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.services svc
      WHERE svc.id = picked.picked_id
        AND svc.organization_id = p_organization_id
        AND COALESCE(svc.is_active, true)
    )
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_personas) AS picked(picked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_knowledge knowledge
      WHERE knowledge.id = picked.picked_id
        AND knowledge.organization_id = p_organization_id
    )
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_pillars) AS picked(picked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.content_pillars pillar
      WHERE pillar.id = picked.picked_id
        AND pillar.is_active
        AND (pillar.organization_id = p_organization_id OR pillar.is_default)
    )
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_products) AS picked(picked_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.product_knowledge knowledge
      LEFT JOIN public.sub_services sub
        ON sub.id = knowledge.sub_service_id
       AND sub.organization_id = knowledge.organization_id
      WHERE knowledge.id = picked.picked_id
        AND knowledge.organization_id = p_organization_id
        AND (
          knowledge.service_id = ANY (v_services)
          OR sub.service_id = ANY (v_services)
        )
    )
  ) OR (
    v_has_angles AND EXISTS (
      SELECT 1 FROM unnest(v_angles) AS picked(picked_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.thinking_lab_angles angle
        WHERE angle.id = picked.picked_id
          AND angle.organization_id = p_organization_id
          AND angle.admission = 'GENERATE_VALID'
      )
    )
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_previous := public.ai_employee_brief_payload(p_employee_id);
  INSERT INTO public.ai_employee_briefs (
    employee_id, organization_id, service_ids, audience, persona_ids,
    voice, required_notes, forbidden_notes, pillar_ids, product_knowledge_ids,
    angle_ids, repeat_voices, split_rule, updated_at
  ) VALUES (
    p_employee_id, p_organization_id, v_services, v_audience, v_personas,
    v_voice, v_required, v_forbidden, v_pillars, v_products,
    v_angles, v_voices, v_split, now()
  )
  ON CONFLICT (employee_id) DO UPDATE
  SET service_ids = EXCLUDED.service_ids,
      audience = EXCLUDED.audience,
      persona_ids = EXCLUDED.persona_ids,
      voice = EXCLUDED.voice,
      required_notes = EXCLUDED.required_notes,
      forbidden_notes = EXCLUDED.forbidden_notes,
      pillar_ids = EXCLUDED.pillar_ids,
      product_knowledge_ids = EXCLUDED.product_knowledge_ids,
      angle_ids = CASE WHEN v_has_angles THEN EXCLUDED.angle_ids ELSE ai_employee_briefs.angle_ids END,
      repeat_voices = CASE WHEN v_has_voices THEN EXCLUDED.repeat_voices ELSE ai_employee_briefs.repeat_voices END,
      split_rule = EXCLUDED.split_rule,
      updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'previous', v_previous,
    'brief', public.ai_employee_brief_payload(p_employee_id)
  );
END;
$write$;

CREATE OR REPLACE FUNCTION public.ai_employee_carousel_paths(p_employee_id uuid)
RETURNS TABLE (
  queue_order integer,
  idea_id uuid,
  content_pillar_id uuid,
  pillar_name text,
  angle_id uuid,
  development text,
  prompt_voice text,
  delivery_voice text,
  is_repeat boolean,
  previous_title text,
  previous_caption text,
  idea_statement text,
  angle_statement text,
  master_statement text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $paths$
DECLARE
  v_org uuid;
BEGIN
  SELECT employee.organization_id
  INTO v_org
  FROM public.employees employee
  WHERE employee.id = p_employee_id
    AND COALESCE(employee.is_ai, false);

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH brief AS (
    SELECT employee_brief.angle_ids,
           employee_brief.pillar_ids,
           employee_brief.voice,
           employee_brief.repeat_voices
    FROM public.ai_employee_briefs employee_brief
    WHERE employee_brief.employee_id = p_employee_id
      AND employee_brief.organization_id = v_org
  ),
  locked_path AS (
    SELECT DISTINCT ON (idea.id, pillar.id)
      idea.id AS idea_id,
      idea.sort_order,
      idea.created_at AS idea_created_at,
      idea.statement AS idea_statement,
      angle.id AS angle_id,
      angle.statement AS angle_statement,
      master.statement AS master_statement,
      pillar.id AS content_pillar_id,
      pillar.name AS pillar_name,
      left(btrim(review->>'development'), 800) AS development
    FROM brief
    JOIN public.thinking_lab_ideas idea
      ON idea.organization_id = v_org
    JOIN public.thinking_lab_angles angle
      ON angle.id = idea.angle_id
     AND angle.organization_id = idea.organization_id
     AND angle.id = ANY (brief.angle_ids)
     AND angle.admission = 'GENERATE_VALID'
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
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(idea.development_paths, '[]'::jsonb)) AS path
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(path->'reviews', '[]'::jsonb)) AS review
    JOIN public.content_pillars pillar
      ON pillar.id = CASE
        WHEN path->>'contentPillarId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (path->>'contentPillarId')::uuid
        ELSE NULL
      END
     AND pillar.is_active
     AND (pillar.organization_id = v_org OR pillar.is_default)
    WHERE cardinality(brief.angle_ids) > 0
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
      AND (
        cardinality(brief.pillar_ids) = 0
        OR pillar.id = ANY (brief.pillar_ids)
      )
    ORDER BY idea.id, pillar.id, COALESCE(path->>'savedAt', '') DESC,
             char_length(btrim(review->>'development')) DESC
  ),
  usage AS (
    SELECT locked_path.idea_id,
           locked_path.content_pillar_id,
           count(plan.id)::integer AS plan_count,
           (array_agg(plan.id) FILTER (WHERE plan.delivery_voice IS NULL))[1] AS primary_id
    FROM locked_path
    LEFT JOIN public.social_media_plans plan
      ON plan.organization_id = v_org
     AND plan.thinking_idea_id = locked_path.idea_id
     AND plan.content_pillar_id = locked_path.content_pillar_id
    GROUP BY locked_path.idea_id, locked_path.content_pillar_id
  ),
  cohort AS (
    SELECT metric.platform,
           metric.plan_id,
           metric.views,
           metric.likes + metric.comments + metric.shares AS engagement
    FROM public.content_plan_post_metrics metric
    JOIN public.social_media_plans plan
      ON plan.id = metric.plan_id
     AND plan.organization_id = v_org
    WHERE metric.organization_id = v_org
      AND metric.fetched_at >= now() - interval '14 days'
      AND EXISTS (
        SELECT 1
        FROM public.social_media_scheduled_posts post
        WHERE post.social_media_plan_id = plan.id
          AND post.organization_id = v_org
          AND post.status = 'published'
          AND post.published_at <= now() - interval '7 days'
          AND lower(post.platform) = metric.platform
      )
  ),
  stats AS (
    SELECT cohort.platform,
           count(*)::integer AS cohort_count,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY cohort.views) AS median_views,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY cohort.engagement) AS median_engagement
    FROM cohort
    GROUP BY cohort.platform
  ),
  passed AS (
    SELECT cohort.plan_id
    FROM cohort
    JOIN stats ON stats.platform = cohort.platform
    GROUP BY cohort.plan_id
    HAVING count(*) >= 1
       AND bool_and(
         stats.cohort_count >= 4
         AND cohort.views > stats.median_views
         AND cohort.engagement > stats.median_engagement
       )
  ),
  queued AS (
    SELECT locked_path.*,
           false AS is_repeat,
           NULL::uuid AS primary_id,
           NULLIF(btrim(COALESCE(brief.voice, '')), '') AS prompt_voice,
           NULL::text AS delivery_voice
    FROM locked_path
    JOIN usage
      ON usage.idea_id = locked_path.idea_id
     AND usage.content_pillar_id = locked_path.content_pillar_id
    CROSS JOIN brief
    WHERE usage.plan_count = 0
    UNION ALL
    SELECT locked_path.*,
           true AS is_repeat,
           usage.primary_id,
           NULLIF(btrim(COALESCE(brief.repeat_voices[1], '')), '') AS prompt_voice,
           NULLIF(btrim(COALESCE(brief.repeat_voices[1], '')), '') AS delivery_voice
    FROM locked_path
    JOIN usage
      ON usage.idea_id = locked_path.idea_id
     AND usage.content_pillar_id = locked_path.content_pillar_id
    CROSS JOIN brief
    JOIN passed ON passed.plan_id = usage.primary_id
    WHERE usage.plan_count = 1
      AND usage.primary_id IS NOT NULL
      AND NULLIF(btrim(COALESCE(brief.repeat_voices[1], '')), '') IS NOT NULL
  )
  SELECT row_number() OVER (
           ORDER BY queued.is_repeat, queued.sort_order, queued.idea_created_at,
                    queued.pillar_name, queued.idea_id, queued.content_pillar_id
         )::integer AS queue_order,
         queued.idea_id,
         queued.content_pillar_id,
         left(btrim(queued.pillar_name), 80) AS pillar_name,
         queued.angle_id,
         queued.development,
         queued.prompt_voice,
         queued.delivery_voice,
         queued.is_repeat,
         left(btrim(COALESCE(primary_plan.title, '')), 200) AS previous_title,
         left(btrim(COALESCE(caption.content, '')), 400) AS previous_caption,
         left(btrim(queued.idea_statement), 500) AS idea_statement,
         left(btrim(queued.angle_statement), 240) AS angle_statement,
         left(btrim(queued.master_statement), 240) AS master_statement
  FROM queued
  LEFT JOIN public.social_media_plans primary_plan
    ON primary_plan.id = queued.primary_id
  LEFT JOIN public.brief_captions caption
    ON caption.social_media_plan_id = primary_plan.id
  ORDER BY queued.is_repeat, queued.sort_order, queued.idea_created_at,
           queued.pillar_name, queued.idea_id, queued.content_pillar_id;
END;
$paths$;

REVOKE ALL ON FUNCTION public.ai_employee_carousel_paths(uuid)
  FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_carousel_path_allowed(
  p_employee_id uuid,
  p_idea_id uuid,
  p_pillar_id uuid,
  p_voice text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $allowed$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_employee_carousel_paths(p_employee_id) path
    WHERE path.idea_id = p_idea_id
      AND path.content_pillar_id = p_pillar_id
      AND coalesce(path.delivery_voice, '') = coalesce(NULLIF(btrim(COALESCE(p_voice, '')), ''), '')
  );
$allowed$;

REVOKE ALL ON FUNCTION public.ai_employee_carousel_path_allowed(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

DO $context$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_context(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_scope text := $old$IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks', 'brief', 'performance', 'product') THEN$old$;
  new_scope text := $new$IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks', 'brief', 'performance', 'product', 'carousel_paths') THEN$new$;
  old_else text := $old$  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.title, t.status, t.due_date, t.priority, t.ai_revision_count,$old$;
  new_else text := $new$  ELSIF p_scope = 'carousel_paths' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(path) ORDER BY path.queue_order), '[]'::jsonb)
    INTO v_rows
    FROM public.ai_employee_carousel_paths(p_employee_id) path;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.title, t.status, t.due_date, t.priority, t.ai_revision_count,$new$;
BEGIN
  IF position(old_scope IN def) = 0 OR position(old_else IN def) = 0 THEN
    RAISE EXCEPTION 'carousel_paths context snippet missing';
  END IF;
  def := replace(def, old_scope, new_scope);
  def := replace(def, old_else, new_else);
  EXECUTE def;
END;
$context$;

DO $perform$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_declare text := $old$  v_carousel_concept text;$old$;
  new_declare text := $new$  v_carousel_concept text;
  v_delivery_voice text;$new$;
  old_used text := $old$      IF EXISTS (
        SELECT 1 FROM public.social_media_plans existing
        WHERE existing.organization_id = v_org
          AND existing.thinking_idea_id = v_idea
      ) THEN
        RAISE EXCEPTION 'idea_used' USING ERRCODE = '23505';
      END IF;$old$;
  new_used text := $new$      v_delivery_voice := NULLIF(left(btrim(COALESCE(v_payload->>'delivery_voice', '')), 500), '');
      IF NULLIF(v_payload->>'path_pillar_id', '') IS NOT NULL THEN
        v_pillar := NULLIF(v_payload->>'path_pillar_id', '')::uuid;
        IF v_pillar IS NULL OR NOT public.ai_employee_carousel_path_allowed(
          p_employee_id, v_idea, v_pillar, v_delivery_voice
        ) THEN
          RAISE EXCEPTION 'path_not_allowed' USING ERRCODE = '42501';
        END IF;
      ELSIF EXISTS (
        SELECT 1 FROM public.social_media_plans existing
        WHERE existing.organization_id = v_org
          AND existing.thinking_idea_id = v_idea
      ) THEN
        RAISE EXCEPTION 'idea_used' USING ERRCODE = '23505';
      END IF;$new$;
  old_insert text := $old$    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, content_type_id, pic_id,
      production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, v_carousel_type,
      (SELECT ai_author.id
         FROM public.employees ai_author
        WHERE ai_author.id = p_employee_id
          AND ai_author.organization_id = v_org
          AND ai_author.is_ai IS TRUE),
      NULL, false, false, 'Need Review'
    )$old$;
  new_insert text := $new$    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, content_type_id, pic_id,
      delivery_voice, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, v_carousel_type,
      (SELECT ai_author.id
         FROM public.employees ai_author
        WHERE ai_author.id = p_employee_id
          AND ai_author.organization_id = v_org
          AND ai_author.is_ai IS TRUE),
      CASE WHEN NULLIF(v_payload->>'path_pillar_id', '') IS NOT NULL THEN v_delivery_voice ELSE NULL END,
      NULL, false, false, 'Need Review'
    )$new$;
BEGIN
  IF position(old_declare IN def) = 0
    OR position(old_used IN def) = 0
    OR position(old_insert IN def) = 0
  THEN
    RAISE EXCEPTION 'carousel path perform snippet missing';
  END IF;
  def := replace(def, old_declare, new_declare);
  def := replace(def, old_used, new_used);
  def := replace(def, old_insert, new_insert);
  EXECUTE def;
END;
$perform$;

DO $page$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_page_read(uuid)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_products text := $old$  v_products jsonb;$old$;
  new_products text := $new$  v_products jsonb;
  v_angles jsonb;$new$;
  old_ids text := $old$  v_product_ids uuid[];$old$;
  new_ids text := $new$  v_product_ids uuid[];
  v_angle_ids uuid[];$new$;
  old_assign text := $old$  v_product_ids := public.ai_employee_brief_ids(v_brief->'product_knowledge_ids');$old$;
  new_assign text := $new$  v_product_ids := public.ai_employee_brief_ids(v_brief->'product_knowledge_ids');
  v_angle_ids := public.ai_employee_brief_ids(v_brief->'angle_ids');
  v_angles := public.ai_employee_angle_options(v_org, v_angle_ids);$new$;
  old_options text := $old$      'products', v_products
    ),$old$;
  new_options text := $new$      'products', v_products,
      'angles', v_angles
    ),$new$;
BEGIN
  IF position(old_products IN def) = 0
    OR position(old_ids IN def) = 0
    OR position(old_assign IN def) = 0
    OR position(old_options IN def) = 0
  THEN
    RAISE EXCEPTION 'angle options page snippet missing';
  END IF;
  def := replace(def, old_products, new_products);
  def := replace(def, old_ids, new_ids);
  def := replace(def, old_assign, new_assign);
  def := replace(def, old_options, new_options);
  EXECUTE def;
END;
$page$;

COMMENT ON FUNCTION public.ai_employee_carousel_paths(uuid) IS
  'Antrean jalur carousel yang sudah di-lock pada angle fokus. Jalur baru didahulukan, lalu satu kandidat ulang.';

NOTIFY pgrst, 'reload schema';
