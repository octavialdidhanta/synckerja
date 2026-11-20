-- Product Knowledge untuk Naya, baca saja.
-- Scope product hanya lewat ai_employee_context. Claude membaca lewat mcp_list_product_knowledge.

ALTER TABLE public.ai_employee_briefs
  ADD COLUMN IF NOT EXISTS product_knowledge_ids uuid[] NOT NULL DEFAULT '{}';

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
  );

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS product_knowledge_id uuid;

DO $pk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_media_plans_product_knowledge_fkey'
  ) THEN
    ALTER TABLE public.social_media_plans
      ADD CONSTRAINT social_media_plans_product_knowledge_fkey
      FOREIGN KEY (product_knowledge_id)
      REFERENCES public.product_knowledge (id)
      ON DELETE SET NULL;
  END IF;
END
$pk$;

CREATE INDEX IF NOT EXISTS social_media_plans_product_knowledge_idx
  ON public.social_media_plans (organization_id, product_knowledge_id)
  WHERE product_knowledge_id IS NOT NULL;

COMMENT ON COLUMN public.social_media_plans.product_knowledge_id IS
  'Baris Product Knowledge yang dipakai plan ini. NULL bila plan tidak menunjuk satu baris.';

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS product_knowledge_fields text[];

COMMENT ON COLUMN public.social_media_plans.product_knowledge_fields IS
  'Nama kolom Product Knowledge yang menjadi dasar plan ini. NULL bila tidak ada kolom yang dipakai.';

INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
SELECT perm.employee_id, perm.organization_id, 'product.knowledge.list'
FROM public.ai_employee_permissions perm
JOIN public.employees employee
  ON employee.id = perm.employee_id
 AND employee.organization_id = perm.organization_id
 AND COALESCE(employee.is_ai, false)
WHERE perm.action_code = 'content.plans.list'
ON CONFLICT (employee_id, action_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ai_employee_product_clip(p_value jsonb, p_max integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $clip$
  SELECT left(btrim(COALESCE(
    CASE
      WHEN p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN ''
      WHEN jsonb_typeof(p_value) = 'string' THEN p_value #>> '{}'
      WHEN jsonb_typeof(p_value) = 'array' THEN (
        SELECT string_agg(left(btrim(COALESCE(
          CASE jsonb_typeof(item)
            WHEN 'string' THEN item #>> '{}'
            ELSE COALESCE(item->>'name', item->>'text', item->>'description', '')
          END, '')), 120), '; ')
        FROM (
          SELECT item
          FROM jsonb_array_elements(p_value) AS item
          LIMIT 4
        ) items
      )
      WHEN jsonb_typeof(p_value) = 'object' THEN COALESCE(
        p_value->>'name',
        p_value->>'description',
        p_value->>'persona',
        p_value->>'text',
        ''
      )
      ELSE ''
    END, '')), GREATEST(COALESCE(p_max, 240), 0));
$clip$;

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
      'products', '[]'::jsonb
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
    ), '[]'::jsonb)
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
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_previous := public.ai_employee_brief_payload(p_employee_id);
  INSERT INTO public.ai_employee_briefs (
    employee_id, organization_id, service_ids, audience, persona_ids,
    voice, required_notes, forbidden_notes, pillar_ids, product_knowledge_ids, split_rule, updated_at
  ) VALUES (
    p_employee_id, p_organization_id, v_services, v_audience, v_personas,
    v_voice, v_required, v_forbidden, v_pillars, v_products, v_split, now()
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
      split_rule = EXCLUDED.split_rule,
      updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'previous', v_previous,
    'brief', public.ai_employee_brief_payload(p_employee_id)
  );
END;
$write$;

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
AS $ctx$
DECLARE
  v_org uuid;
  v_from date;
  v_to date;
  v_rows jsonb;
  v_count integer;
  v_ads jsonb := '[]'::jsonb;
BEGIN
  IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks', 'brief', 'performance', 'product') THEN
    RAISE EXCEPTION 'scope_forbidden' USING ERRCODE = '42501';
  END IF;

  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);
  v_from := COALESCE((NULLIF(p_params->>'from', ''))::date, (timezone('Asia/Jakarta', now()))::date);
  v_to := COALESCE((NULLIF(p_params->>'to', ''))::date, v_from + 7);
  IF p_scope = 'performance' AND NULLIF(p_params->>'from', '') IS NULL THEN
    v_to := (timezone('Asia/Jakarta', now()))::date;
    v_from := v_to - 27;
  END IF;

  IF p_scope = 'plans' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT p.id, p.title, p.brief, p.post_date, p.production_status,
             p.content_pillar_id, p.service_id, p.approved, p.production_approved
      FROM public.social_media_plans p
      WHERE p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
        AND (
          NULLIF(p_params->>'from', '') IS NULL
          OR (timezone('Asia/Jakarta', p.post_date))::date BETWEEN v_from AND v_to
        )
      ORDER BY p.post_date DESC NULLS LAST
      LIMIT 100
    ) x;
  ELSIF p_scope = 'calendar' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT p.id,
             left(btrim(COALESCE(p.title, '')), 200) AS title,
             (timezone('Asia/Jakarta', p.post_date))::date AS post_date,
             p.content_pillar_id,
             left(btrim(COALESCE(pillar.name, '')), 80) AS pillar_name,
             p.service_id,
             left(btrim(COALESCE(svc.name, '')), 80) AS service_name,
             left(btrim(COALESCE(author.full_name, '')), 80) AS author_name,
             left(btrim(COALESCE(pic.full_name, '')), 80) AS pic_name
      FROM public.social_media_plans p
      LEFT JOIN public.content_pillars pillar ON pillar.id = p.content_pillar_id
      LEFT JOIN public.services svc
        ON svc.id = p.service_id
       AND svc.organization_id = p.organization_id
      LEFT JOIN public.employees author
        ON author.id = p.author_employee_id
       AND author.organization_id = p.organization_id
      LEFT JOIN public.employees pic
        ON pic.id = p.pic_id
       AND pic.organization_id = p.organization_id
      WHERE p.organization_id = v_org
        AND (timezone('Asia/Jakarta', p.post_date))::date BETWEEN v_from AND v_to
      ORDER BY p.post_date, p.id
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
      SELECT idea.id AS idea_id,
             left(btrim(idea.statement), 500) AS idea_statement,
             left(btrim(master.statement), 500) AS master_statement,
             NULLIF(left(btrim(COALESCE(master.canonical_semantic->>'subject', '')), 200), '') AS master_subject,
             left(btrim(thought.statement), 500) AS big_thought_statement,
             left(btrim(territory.statement), 500) AS territory_statement,
             left(btrim(angle.statement), 500) AS angle_statement,
             EXISTS (
               SELECT 1 FROM public.social_media_plans plan
               WHERE plan.organization_id = idea.organization_id
                 AND plan.thinking_idea_id = idea.id
             ) AS used,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object('id', pillar.id, 'name', left(btrim(pillar.name), 80)) ORDER BY pillar.name)
               FROM (
                 SELECT pillar.id, pillar.name
                 FROM public.content_pillars pillar
                 WHERE pillar.is_active
                   AND (pillar.organization_id = v_org OR pillar.is_default)
                 ORDER BY pillar.name
                 LIMIT 20
               ) pillar
             ), '[]'::jsonb) AS pillars,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', ex.id,
                 'pillar_name', left(btrim(COALESCE(ex.pillar_name, '')), 80),
                 'title', left(btrim(COALESCE(ex.script->>'title', '')), 120),
                 'passed', ex.admission = 'GENERATE_VALID'
               ) ORDER BY ex.updated_at DESC)
               FROM (
                 SELECT ex_inner.*
                 FROM public.thinking_lab_executions ex_inner
                 WHERE ex_inner.organization_id = v_org
                   AND ex_inner.idea_id = idea.id
                   AND ex_inner.creative_idea_id IS NULL
                 ORDER BY ex_inner.updated_at DESC
                 LIMIT 5
               ) ex
             ), '[]'::jsonb) AS executions
      FROM public.thinking_lab_ideas idea
      JOIN public.thinking_lab_angles angle
        ON angle.id = idea.angle_id
       AND angle.organization_id = idea.organization_id
      JOIN public.thinking_lab_territories territory
        ON territory.id = angle.territory_id
       AND territory.organization_id = idea.organization_id
      JOIN public.thinking_big_thoughts thought
        ON thought.id = territory.big_thought_id
       AND thought.organization_id = idea.organization_id
      JOIN public.thinking_master_thoughts master
        ON master.id = thought.master_thought_id
       AND master.organization_id = idea.organization_id
       AND master.workspace = 'thinking_lab'
      WHERE idea.organization_id = v_org
        AND idea.status = 'locked'
        AND idea.validation->>'decision' = 'LOLOS'
      ORDER BY used ASC, idea.updated_at DESC, idea.id DESC
      LIMIT 8
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
  ELSIF p_scope = 'brief' THEN
    SELECT jsonb_build_array(public.ai_employee_brief_payload(p_employee_id)) INTO v_rows;
  ELSIF p_scope = 'performance' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT 'content' AS kind,
             pillar.id AS pillar_id,
             left(btrim(pillar.name), 80) AS pillar_name,
             count(*)::integer AS plan_count,
             v_from AS window_start,
             v_to AS window_end
      FROM public.social_media_plans plan
      JOIN public.content_pillars pillar ON pillar.id = plan.content_pillar_id
      WHERE plan.organization_id = v_org
        AND (timezone('Asia/Jakarta', plan.post_date))::date BETWEEN v_from AND v_to
      GROUP BY pillar.id, pillar.name
      ORDER BY count(*) DESC, pillar.name
      LIMIT 3
    ) x;
    IF to_regclass('public.organization_google_ads_accounts') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.organization_google_ads_accounts WHERE organization_id = $1'
        INTO v_count USING v_org;
      v_ads := v_ads || jsonb_build_array(jsonb_build_object('kind', 'ads', 'platform', 'google', 'connected_accounts', v_count, 'spend', NULL));
    END IF;
    IF to_regclass('public.organization_meta_ads_accounts') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.organization_meta_ads_accounts WHERE organization_id = $1'
        INTO v_count USING v_org;
      v_ads := v_ads || jsonb_build_array(jsonb_build_object('kind', 'ads', 'platform', 'meta', 'connected_accounts', v_count, 'spend', NULL));
    END IF;
    IF to_regclass('public.organization_tiktok_ads_accounts') IS NOT NULL THEN
      EXECUTE 'SELECT count(*)::integer FROM public.organization_tiktok_ads_accounts WHERE organization_id = $1'
        INTO v_count USING v_org;
      v_ads := v_ads || jsonb_build_array(jsonb_build_object('kind', 'ads', 'platform', 'tiktok', 'connected_accounts', v_count, 'spend', NULL));
    END IF;
    v_rows := COALESCE(v_rows, '[]'::jsonb) || v_ads;
  ELSIF p_scope = 'product' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ai_employee_permissions perm
      WHERE perm.employee_id = p_employee_id
        AND perm.organization_id = v_org
        AND perm.action_code = 'product.knowledge.list'
    ) THEN
      RAISE EXCEPTION 'scope_forbidden' USING ERRCODE = '42501';
    END IF;
    SELECT COALESCE(jsonb_agg((to_jsonb(x) - 'sort_selected' - 'sort_unused' - 'sort_updated') ORDER BY x.sort_selected DESC, x.sort_unused DESC, x.sort_updated DESC, x.id), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT knowledge.id,
             left(btrim(COALESCE(svc.name, '')), 80) AS service_name,
             left(btrim(COALESCE(sub.name, '')), 80) AS sub_service_name,
             left(btrim(knowledge.feature_name), 120) AS feature_name,
             left(btrim(knowledge.feature_description), 400) AS feature_description,
             left(btrim(COALESCE(knowledge.solusi, '')), 400) AS solusi,
             left(btrim(COALESCE(public.ai_employee_product_clip(knowledge.competitive_advantage, 400), '')), 400) AS competitive_advantage,
             left(btrim(COALESCE(public.ai_employee_product_clip(knowledge.target_audience, 240), '')), 240) AS target_audience,
             left(array_to_string(ARRAY(
               SELECT left(btrim(item), 80)
               FROM unnest(COALESCE(knowledge.problems_solved, '{}'::text[])) AS item
               WHERE btrim(item) <> ''
               LIMIT 4
             ), '; '), 320) AS problems_solved,
             left(btrim(knowledge.impact), 240) AS impact,
             left(btrim(COALESCE(knowledge.wants, '')), 240) AS wants,
             left(btrim(COALESCE(knowledge.needs, '')), 240) AS needs,
             left(btrim(COALESCE(knowledge.hidden_needs, '')), 240) AS hidden_needs,
             left(btrim(COALESCE(knowledge.false_belief, '')), 240) AS false_belief,
             left(btrim(COALESCE(knowledge.false_belief_impact, '')), 240) AS false_belief_impact,
             left(btrim(COALESCE(knowledge.what_makes_them_stop, '')), 240) AS what_makes_them_stop,
             (knowledge.id = ANY (COALESCE(brief.product_knowledge_ids, '{}'))) AS selected,
             NOT EXISTS (
               SELECT 1 FROM public.social_media_plans plan
               WHERE plan.organization_id = knowledge.organization_id
                 AND plan.product_knowledge_id = knowledge.id
             ) AS unused,
             (knowledge.id = ANY (COALESCE(brief.product_knowledge_ids, '{}'))) AS sort_selected,
             NOT EXISTS (
               SELECT 1 FROM public.social_media_plans plan
               WHERE plan.organization_id = knowledge.organization_id
                 AND plan.product_knowledge_id = knowledge.id
             ) AS sort_unused,
             knowledge.updated_at AS sort_updated
      FROM public.product_knowledge knowledge
      LEFT JOIN public.ai_employee_briefs brief
        ON brief.employee_id = p_employee_id
       AND brief.organization_id = v_org
      LEFT JOIN public.services svc
        ON svc.id = knowledge.service_id
       AND svc.organization_id = knowledge.organization_id
      LEFT JOIN public.sub_services sub
        ON sub.id = knowledge.sub_service_id
       AND sub.organization_id = knowledge.organization_id
      WHERE knowledge.organization_id = v_org
        AND (
          knowledge.service_id = ANY (COALESCE(brief.service_ids, '{}'))
          OR sub.service_id = ANY (COALESCE(brief.service_ids, '{}'))
        )
        AND (
          COALESCE(cardinality(brief.product_knowledge_ids), 0) = 0
          OR knowledge.id = ANY (brief.product_knowledge_ids)
        )
      ORDER BY
        (knowledge.id = ANY (COALESCE(brief.product_knowledge_ids, '{}'))) DESC,
        (
          NOT EXISTS (
            SELECT 1 FROM public.social_media_plans plan
            WHERE plan.organization_id = knowledge.organization_id
              AND plan.product_knowledge_id = knowledge.id
          )
        ) DESC,
        knowledge.updated_at DESC,
        knowledge.id
      LIMIT 6
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
$ctx$;

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
  v_service uuid;
  v_idea uuid;
  v_execution uuid;
  v_product uuid;
  v_fields text[];
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
    RETURN public.ai_employee_accept_execution(v_org, p_employee_id, v_payload);
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

    v_service := NULL;
    v_idea := NULL;
    v_execution := NULL;
    IF NULLIF(v_payload->>'service_id', '') IS NOT NULL THEN
      v_service := (v_payload->>'service_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.services svc
        WHERE svc.id = v_service
          AND svc.organization_id = v_org
          AND COALESCE(svc.is_active, true)
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_action = 'thinking.plan.save' THEN
      v_idea := NULLIF(v_payload->>'idea_id', '')::uuid;
      IF v_idea IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.thinking_lab_ideas idea
        WHERE idea.id = v_idea
          AND idea.organization_id = v_org
          AND idea.status = 'locked'
          AND idea.validation->>'decision' = 'LOLOS'
      ) THEN
        RAISE EXCEPTION 'idea_not_found' USING ERRCODE = 'P0002';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.social_media_plans existing
        WHERE existing.organization_id = v_org
          AND existing.thinking_idea_id = v_idea
      ) THEN
        RAISE EXCEPTION 'idea_used' USING ERRCODE = '23505';
      END IF;
      IF NULLIF(v_payload->>'execution_id', '') IS NOT NULL THEN
        v_execution := (v_payload->>'execution_id')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.thinking_lab_executions ex
          WHERE ex.id = v_execution
            AND ex.organization_id = v_org
            AND ex.idea_id = v_idea
            AND ex.admission = 'GENERATE_VALID'
            AND ex.creative_idea_id IS NULL
        ) THEN
          RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

    v_product := NULL;
    IF NULLIF(v_payload->>'product_knowledge_id', '') IS NOT NULL THEN
      v_product := (v_payload->>'product_knowledge_id')::uuid;
      IF NOT EXISTS (
        SELECT 1
        FROM public.product_knowledge knowledge
        LEFT JOIN public.sub_services sub
          ON sub.id = knowledge.sub_service_id
         AND sub.organization_id = knowledge.organization_id
        JOIN public.ai_employee_briefs brief
          ON brief.employee_id = p_employee_id
         AND brief.organization_id = v_org
        WHERE knowledge.id = v_product
          AND knowledge.organization_id = v_org
          AND (
            COALESCE(cardinality(brief.product_knowledge_ids), 0) = 0
            OR knowledge.id = ANY (brief.product_knowledge_ids)
          )
          AND (
            knowledge.service_id = ANY (brief.service_ids)
            OR sub.service_id = ANY (brief.service_ids)
          )
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    v_fields := NULL;
    IF v_product IS NOT NULL
      AND jsonb_typeof(v_payload->'product_knowledge_fields') = 'array'
    THEN
      SELECT array_agg(picked.field ORDER BY picked.field)
      INTO v_fields
      FROM (
        SELECT DISTINCT src.field
        FROM (
          SELECT left(btrim(element.item #>> '{}'), 80) AS field
          FROM jsonb_array_elements(v_payload->'product_knowledge_fields') WITH ORDINALITY AS element(item, ordinality)
          WHERE element.ordinality <= 13
            AND jsonb_typeof(element.item) = 'string'
        ) src
        JOIN public.product_knowledge knowledge
          ON knowledge.id = v_product
         AND knowledge.organization_id = v_org
        WHERE src.field IN (
          'feature_name', 'feature_description', 'problems_solved', 'impact', 'solusi',
          'competitive_advantage', 'target_audience', 'wants', 'needs', 'hidden_needs',
          'false_belief', 'false_belief_impact', 'what_makes_them_stop'
        )
          AND CASE src.field
            WHEN 'feature_name' THEN btrim(knowledge.feature_name) <> ''
            WHEN 'feature_description' THEN btrim(knowledge.feature_description) <> ''
            WHEN 'problems_solved' THEN EXISTS (
              SELECT 1 FROM unnest(COALESCE(knowledge.problems_solved, '{}'::text[])) AS piece
              WHERE btrim(piece) <> ''
            )
            WHEN 'impact' THEN btrim(knowledge.impact) <> ''
            WHEN 'solusi' THEN btrim(COALESCE(knowledge.solusi, '')) <> ''
            WHEN 'competitive_advantage' THEN btrim(COALESCE(public.ai_employee_product_clip(knowledge.competitive_advantage, 400), '')) <> ''
            WHEN 'target_audience' THEN btrim(COALESCE(public.ai_employee_product_clip(knowledge.target_audience, 240), '')) <> ''
            WHEN 'wants' THEN btrim(COALESCE(knowledge.wants, '')) <> ''
            WHEN 'needs' THEN btrim(COALESCE(knowledge.needs, '')) <> ''
            WHEN 'hidden_needs' THEN btrim(COALESCE(knowledge.hidden_needs, '')) <> ''
            WHEN 'false_belief' THEN btrim(COALESCE(knowledge.false_belief, '')) <> ''
            WHEN 'false_belief_impact' THEN btrim(COALESCE(knowledge.false_belief_impact, '')) <> ''
            WHEN 'what_makes_them_stop' THEN btrim(COALESCE(knowledge.what_makes_them_stop, '')) <> ''
            ELSE false
          END
      ) picked;
    END IF;

    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, 'Need Review', false, false, 'draft'
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

CREATE OR REPLACE FUNCTION public.mcp_list_product_knowledge(
  p_user_id uuid,
  p_organization_id uuid,
  p_service_id uuid,
  p_sub_service_id uuid,
  p_search text,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $list$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
  v_search text := left(btrim(COALESCE(p_search, '')), 80);
  v_like text;
  v_rows jsonb;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = p_user_id
      AND role.organization_id = p_organization_id
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  v_like := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT knowledge.id,
           knowledge.service_id,
           knowledge.sub_service_id,
           left(btrim(COALESCE(svc.name, '')), 80) AS service_name,
           left(btrim(COALESCE(sub.name, '')), 80) AS sub_service_name,
           left(btrim(knowledge.feature_name), 120) AS feature_name,
           left(btrim(knowledge.feature_description), 400) AS feature_description,
           left(btrim(COALESCE(knowledge.solusi, '')), 400) AS solusi,
           left(btrim(COALESCE(public.ai_employee_product_clip(knowledge.competitive_advantage, 400), '')), 400) AS competitive_advantage,
           left(btrim(COALESCE(public.ai_employee_product_clip(knowledge.target_audience, 240), '')), 240) AS target_audience,
           left(array_to_string(ARRAY(
             SELECT left(btrim(item), 80)
             FROM unnest(COALESCE(knowledge.problems_solved, '{}'::text[])) AS item
             WHERE btrim(item) <> ''
             LIMIT 4
           ), '; '), 320) AS problems_solved,
           left(btrim(knowledge.impact), 240) AS impact,
           left(btrim(COALESCE(knowledge.wants, '')), 240) AS wants,
           left(btrim(COALESCE(knowledge.needs, '')), 240) AS needs,
           left(btrim(COALESCE(knowledge.hidden_needs, '')), 240) AS hidden_needs,
           left(btrim(COALESCE(knowledge.false_belief, '')), 240) AS false_belief,
           left(btrim(COALESCE(knowledge.false_belief_impact, '')), 240) AS false_belief_impact,
           left(btrim(COALESCE(knowledge.what_makes_them_stop, '')), 240) AS what_makes_them_stop
    FROM public.product_knowledge knowledge
    LEFT JOIN public.services svc
      ON svc.id = knowledge.service_id
     AND svc.organization_id = knowledge.organization_id
    LEFT JOIN public.sub_services sub
      ON sub.id = knowledge.sub_service_id
     AND sub.organization_id = knowledge.organization_id
    WHERE knowledge.organization_id = p_organization_id
      AND (p_service_id IS NULL OR knowledge.service_id = p_service_id OR sub.service_id = p_service_id)
      AND (p_sub_service_id IS NULL OR knowledge.sub_service_id = p_sub_service_id)
      AND (
        v_search = ''
        OR knowledge.feature_name ILIKE v_like ESCAPE '\'
        OR knowledge.feature_description ILIKE v_like ESCAPE '\'
        OR COALESCE(knowledge.solusi, '') ILIKE v_like ESCAPE '\'
        OR knowledge.impact ILIKE v_like ESCAPE '\'
        OR COALESCE(knowledge.wants, '') ILIKE v_like ESCAPE '\'
        OR COALESCE(knowledge.needs, '') ILIKE v_like ESCAPE '\'
        OR COALESCE(knowledge.hidden_needs, '') ILIKE v_like ESCAPE '\'
        OR COALESCE(knowledge.false_belief, '') ILIKE v_like ESCAPE '\'
        OR COALESCE(knowledge.false_belief_impact, '') ILIKE v_like ESCAPE '\'
        OR COALESCE(knowledge.what_makes_them_stop, '') ILIKE v_like ESCAPE '\'
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(knowledge.problems_solved, '{}'::text[])) AS item
          WHERE item ILIKE v_like ESCAPE '\'
        )
      )
    ORDER BY knowledge.updated_at DESC, knowledge.id
    LIMIT v_limit
  ) x;
  RETURN v_rows;
END;
$list$;

REVOKE ALL ON FUNCTION public.ai_employee_product_clip(jsonb, integer) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_brief_payload(uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_brief_write(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_brief_write(uuid, uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) TO ai_employee_runner;
REVOKE ALL ON FUNCTION public.mcp_list_product_knowledge(uuid, uuid, uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.mcp_list_product_knowledge(uuid, uuid, uuid, uuid, text, integer) TO service_role;
