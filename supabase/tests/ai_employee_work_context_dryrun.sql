-- Uji konteks kerja di SQL Editor production.
-- Satu transaksi. ROLLBACK di akhir mengembalikan semuanya.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Konteks kerja Naya: brief owner, kalender organisasi, rantai Thinking Lab,
-- dan ringkasan performa. Naya membaca lewat ai_employee_context. Owner menulis
-- brief lewat fungsi di bawah. Tidak ada GRANT untuk ai_employee_runner pada tabel ini.

CREATE TABLE public.ai_employee_briefs (
  employee_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  service_ids uuid[] NOT NULL DEFAULT '{}',
  audience text NOT NULL DEFAULT '',
  persona_ids uuid[] NOT NULL DEFAULT '{}',
  voice text NOT NULL DEFAULT '',
  required_notes text NOT NULL DEFAULT '',
  forbidden_notes text NOT NULL DEFAULT '',
  pillar_ids uuid[] NOT NULL DEFAULT '{}',
  split_rule text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_briefs_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_briefs_text_length CHECK (
    char_length(audience) <= 1000
    AND char_length(voice) <= 1000
    AND char_length(required_notes) <= 2000
    AND char_length(forbidden_notes) <= 2000
    AND char_length(split_rule) <= 1000
    AND cardinality(service_ids) <= 12
    AND cardinality(persona_ids) <= 12
    AND cardinality(pillar_ids) <= 12
  )
);

CREATE INDEX ai_employee_briefs_org_idx
  ON public.ai_employee_briefs (organization_id);

ALTER TABLE public.ai_employee_briefs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_employee_briefs FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.ai_employee_briefs IS
  'Brief kerja satu karyawan AI. Owner menulis lewat ai_employee_brief_write. Naya membaca lewat ai_employee_context.';

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS thinking_idea_id uuid;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_media_plans_thinking_idea_fkey'
  ) THEN
    ALTER TABLE public.social_media_plans
      ADD CONSTRAINT social_media_plans_thinking_idea_fkey
      FOREIGN KEY (thinking_idea_id)
      REFERENCES public.thinking_lab_ideas (id)
      ON DELETE SET NULL;
  END IF;
END
$fk$;

CREATE UNIQUE INDEX IF NOT EXISTS social_media_plans_one_idea_idx
  ON public.social_media_plans (organization_id, thinking_idea_id)
  WHERE thinking_idea_id IS NOT NULL;

ALTER TABLE public.thinking_lab_executions
  ADD COLUMN IF NOT EXISTS author_employee_id uuid;

DO $author_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thinking_lab_executions_author_employee_fkey'
  ) THEN
    ALTER TABLE public.thinking_lab_executions
      ADD CONSTRAINT thinking_lab_executions_author_employee_fkey
      FOREIGN KEY (author_employee_id)
      REFERENCES public.employees (id)
      ON DELETE SET NULL;
  END IF;
END
$author_fk$;

COMMENT ON COLUMN public.thinking_lab_executions.author_employee_id IS
  'Karyawan AI yang menulis execution ini. NULL berarti execution manusia dan tidak boleh ditimpa Naya.';

DROP INDEX IF EXISTS public.thinking_lab_executions_legacy_idea_pillar_key;
DROP INDEX IF EXISTS public.thinking_lab_executions_legacy_idea_content_pillar_key;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_pillar_human_key
  ON public.thinking_lab_executions (idea_id, pillar)
  WHERE creative_idea_id IS NULL AND author_employee_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_content_pillar_human_key
  ON public.thinking_lab_executions (idea_id, content_pillar_id)
  WHERE creative_idea_id IS NULL AND content_pillar_id IS NOT NULL AND author_employee_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_pillar_author_key
  ON public.thinking_lab_executions (idea_id, pillar, author_employee_id)
  WHERE creative_idea_id IS NULL AND author_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS thinking_lab_executions_legacy_idea_content_pillar_author_key
  ON public.thinking_lab_executions (idea_id, content_pillar_id, author_employee_id)
  WHERE creative_idea_id IS NULL AND content_pillar_id IS NOT NULL AND author_employee_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ai_employee_require_owner(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $owner$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = p_user_id
      AND role.organization_id = p_organization_id
      AND lower(btrim(role.role)) = 'owner'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$owner$;

CREATE OR REPLACE FUNCTION public.ai_employee_brief_ids(
  p_values jsonb
)
RETURNS uuid[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $ids$
DECLARE
  v_ids uuid[] := '{}';
  v_text text;
BEGIN
  IF p_values IS NULL OR jsonb_typeof(p_values) = 'null' THEN
    RETURN v_ids;
  END IF;
  IF jsonb_typeof(p_values) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  FOR v_text IN SELECT jsonb_array_elements_text(p_values)
  LOOP
    BEGIN
      v_ids := v_ids || v_text::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END;
  END LOOP;
  SELECT COALESCE(array_agg(DISTINCT id), '{}')
  INTO v_ids
  FROM unnest(v_ids) AS id;
  RETURN v_ids;
END;
$ids$;

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
      'split_rule', ''
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
    'split_rule', v_row.split_rule
  );
END;
$payload$;

CREATE OR REPLACE FUNCTION public.ai_employee_brief_read(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $read$
BEGIN
  PERFORM public.ai_employee_require_owner(p_user_id, p_organization_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true, 'brief', public.ai_employee_brief_payload(p_employee_id));
END;
$read$;

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
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_services) AS id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.services svc
      WHERE svc.id = id
        AND svc.organization_id = p_organization_id
        AND COALESCE(svc.is_active, true)
    )
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_personas) AS id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_knowledge knowledge
      WHERE knowledge.id = id
        AND knowledge.organization_id = p_organization_id
    )
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_pillars) AS id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.content_pillars pillar
      WHERE pillar.id = id
        AND pillar.is_active
        AND (pillar.organization_id = p_organization_id OR pillar.is_default)
    )
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_previous := public.ai_employee_brief_payload(p_employee_id);
  INSERT INTO public.ai_employee_briefs (
    employee_id, organization_id, service_ids, audience, persona_ids,
    voice, required_notes, forbidden_notes, pillar_ids, split_rule, updated_at
  ) VALUES (
    p_employee_id, p_organization_id, v_services, v_audience, v_personas,
    v_voice, v_required, v_forbidden, v_pillars, v_split, now()
  )
  ON CONFLICT (employee_id) DO UPDATE
  SET service_ids = EXCLUDED.service_ids,
      audience = EXCLUDED.audience,
      persona_ids = EXCLUDED.persona_ids,
      voice = EXCLUDED.voice,
      required_notes = EXCLUDED.required_notes,
      forbidden_notes = EXCLUDED.forbidden_notes,
      pillar_ids = EXCLUDED.pillar_ids,
      split_rule = EXCLUDED.split_rule,
      updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'previous', v_previous,
    'brief', public.ai_employee_brief_payload(p_employee_id)
  );
END;
$write$;

DROP FUNCTION IF EXISTS public.ai_employee_accept_execution(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.ai_employee_accept_execution(
  p_organization_id uuid,
  p_employee_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $judge$
DECLARE
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_idea uuid;
  v_pillar uuid;
  v_statement text;
  v_facts jsonb;
  v_checks jsonb;
  v_script jsonb;
  v_check text;
  v_pillar_name text;
  v_existing uuid;
  v_id uuid;
  v_required text[] := ARRAY[
    'hookHolds', 'soundsSpoken', 'usesSlang', 'pillarFits', 'formatHolds',
    'mechanismVisible', 'messageStays', 'causeChain', 'viewerClimb', 'emotionalTone'
  ];
BEGIN
  BEGIN
    v_idea := NULLIF(v_payload->>'idea_id', '')::uuid;
    v_pillar := NULLIF(v_payload->>'content_pillar_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok', true, 'accepted', false, 'check_id', 'input', 'model_call', true);
  END;
  IF p_employee_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND employee.is_ai
  ) THEN
    RETURN jsonb_build_object('ok', true, 'accepted', false, 'check_id', 'input', 'model_call', true);
  END IF;

  v_statement := NULLIF(left(btrim(COALESCE(v_payload->>'statement', '')), 4000), '');
  v_facts := v_payload->'facts';
  v_checks := v_payload->'checks';
  v_script := v_payload->'script';

  IF v_idea IS NULL OR v_pillar IS NULL OR v_statement IS NULL
    OR jsonb_typeof(v_facts) IS DISTINCT FROM 'object'
    OR jsonb_typeof(v_checks) IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_script) IS DISTINCT FROM 'object'
    OR position('portraitPath' IN v_script::text) > 0
    OR position('bodyPath' IN v_script::text) > 0
    OR position('sheetPath' IN v_script::text) > 0
    OR position('locationPath' IN v_script::text) > 0
    OR position('propertyPath' IN v_script::text) > 0
  THEN
    RETURN jsonb_build_object('ok', true, 'accepted', false, 'check_id', 'input', 'model_call', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.thinking_lab_ideas idea
    WHERE idea.id = v_idea
      AND idea.organization_id = p_organization_id
      AND idea.status = 'locked'
      AND idea.validation->>'decision' = 'LOLOS'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'accepted', false, 'check_id', 'idea', 'model_call', true);
  END IF;

  SELECT pillar.name INTO v_pillar_name
  FROM public.content_pillars pillar
  WHERE pillar.id = v_pillar
    AND pillar.is_active
    AND (pillar.organization_id = p_organization_id OR pillar.is_default);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'accepted', false, 'check_id', 'pillarFits', 'model_call', true);
  END IF;

  IF COALESCE(v_facts->>'resolution', '') IS DISTINCT FROM 'RESOLVED'
    OR COALESCE(v_facts->>'relationToParent', '') IS DISTINCT FROM 'VALID_EXECUTION'
    OR jsonb_typeof(v_facts->'unresolvedReasons') IS DISTINCT FROM 'array'
    OR jsonb_array_length(v_facts->'unresolvedReasons') <> 0
  THEN
    RETURN jsonb_build_object('ok', true, 'accepted', false, 'check_id', 'admission', 'model_call', true);
  END IF;

  FOREACH v_check IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_checks) AS item
      WHERE item->>'id' = v_check
        AND item->>'state' = 'pass'
    ) THEN
      RETURN jsonb_build_object('ok', true, 'accepted', false, 'check_id', v_check, 'model_call', true);
    END IF;
  END LOOP;

  SELECT ex.id INTO v_existing
  FROM public.thinking_lab_executions ex
  WHERE ex.organization_id = p_organization_id
    AND ex.idea_id = v_idea
    AND ex.content_pillar_id = v_pillar
    AND ex.creative_idea_id IS NULL
    AND ex.author_employee_id = p_employee_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.thinking_lab_executions ex
    SET pillar = v_pillar::text,
        pillar_name = v_pillar_name,
        statement = v_statement,
        script = v_script,
        canonical_semantic = v_facts || jsonb_build_object('pillar', v_pillar_name),
        admission = 'GENERATE_VALID',
        author_employee_id = p_employee_id
    WHERE ex.id = v_existing
      AND ex.author_employee_id = p_employee_id
    RETURNING ex.id INTO v_id;
  ELSE
    INSERT INTO public.thinking_lab_executions (
      organization_id, idea_id, pillar, content_pillar_id, pillar_name,
      statement, script, canonical_semantic, admission, author_employee_id
    ) VALUES (
      p_organization_id, v_idea, v_pillar::text, v_pillar, v_pillar_name,
      v_statement, v_script, v_facts || jsonb_build_object('pillar', v_pillar_name),
      'GENERATE_VALID', p_employee_id
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'accepted', true, 'execution_id', v_id, 'model_call', true);
END;
$judge$;

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
  IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks', 'brief', 'performance') THEN
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

    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      author_employee_id, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
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
    AND ex.author_employee_id IS NULL
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
      AND ex.author_employee_id IS NULL
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

REVOKE ALL ON FUNCTION public.ai_employee_require_owner(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_brief_ids(jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_brief_payload(uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_brief_read(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_brief_write(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_accept_execution(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_brief_read(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_brief_write(uuid, uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) TO ai_employee_runner;

-- Badan uji konteks kerja. Dipakai di dalam ai_employee_work_context_dryrun.sql.
-- Tidak punya BEGIN, COMMIT, atau ROLLBACK sendiri.

CREATE OR REPLACE FUNCTION pg_temp.insert_auth_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_names text[] := ARRAY[
    'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
    'email_confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
    'created_at', 'updated_at', 'confirmation_token', 'recovery_token',
    'email_change_token_new', 'email_change', 'is_sso_user', 'is_anonymous'
  ];
  v_name text;
  v_cols text[] := ARRAY[]::text[];
  v_vals text[] := ARRAY[]::text[];
  v_value text;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = v_name
        AND COALESCE(is_generated, 'NEVER') = 'NEVER'
    ) THEN
      v_value := CASE v_name
        WHEN 'instance_id' THEN quote_literal('00000000-0000-0000-0000-000000000000')
        WHEN 'id' THEN quote_literal(p_id::text)
        WHEN 'aud' THEN quote_literal('authenticated')
        WHEN 'role' THEN quote_literal('authenticated')
        WHEN 'email' THEN quote_literal(p_email)
        WHEN 'encrypted_password' THEN quote_literal('test-not-a-real-password')
        WHEN 'email_confirmed_at' THEN 'now()'
        WHEN 'raw_app_meta_data' THEN quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'
        WHEN 'raw_user_meta_data' THEN quote_literal('{}') || '::jsonb'
        WHEN 'created_at' THEN 'now()'
        WHEN 'updated_at' THEN 'now()'
        WHEN 'confirmation_token' THEN quote_literal('')
        WHEN 'recovery_token' THEN quote_literal('')
        WHEN 'email_change_token_new' THEN quote_literal('')
        WHEN 'email_change' THEN quote_literal('')
        WHEN 'is_sso_user' THEN 'false'
        WHEN 'is_anonymous' THEN 'false'
      END;
      v_cols := v_cols || quote_ident(v_name);
      v_vals := v_vals || v_value;
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO auth.users (%s) VALUES (%s)',
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', ')
  );
END;
$fn$;

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_human uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_persona uuid := gen_random_uuid();
  v_pillar uuid := gen_random_uuid();
  v_master uuid := gen_random_uuid();
  v_thought uuid := gen_random_uuid();
  v_territory uuid := gen_random_uuid();
  v_angle uuid := gen_random_uuid();
  v_idea uuid := gen_random_uuid();
  v_extra uuid;
  v_human_ex uuid := gen_random_uuid();
  v_ai_ex uuid;
  v_i integer;
  v_run uuid;
  v_rows jsonb;
  v_saved jsonb;
  v_check jsonb;
  v_plan jsonb;
  v_checks jsonb;
BEGIN
  IF to_regprocedure('public.ai_employee_brief_read(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'migration 20261103108000 belum diterapkan';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'work-context-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_admin, 'work-context-admin@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Work Context Test', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner'), (v_admin, v_org, 'admin');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_ai, v_org, 'Naya Uji', NULL, true),
    (v_human, v_org, 'PIC Manusia', v_owner, false);

  INSERT INTO public.ai_employee_profiles (employee_id, organization_id, time_zone, is_active, performance_status)
  VALUES (v_ai, v_org, 'Asia/Jakarta', true, 'on_track');

  INSERT INTO public.services (id, organization_id, name, is_active)
  VALUES (v_service, v_org, 'Sate Sultan', true);

  INSERT INTO public.product_knowledge (id, organization_id, feature_name, target_audience)
  VALUES (v_persona, v_org, 'Persona uji', '{"name":"ibu muda"}'::jsonb);

  INSERT INTO public.content_pillars (id, organization_id, name, is_active)
  VALUES (v_pillar, v_org, 'Produk Uji', true);

  INSERT INTO public.social_media_plans (
    organization_id, title, post_date, content_pillar_id, service_id, author_employee_id, pic_id
  ) VALUES
    (v_org, 'Plan Naya', '2026-11-10 00:00:00+07', v_pillar, v_service, v_ai, v_ai),
    (v_org, 'Plan Manusia', '2026-11-09 00:00:00+07', v_pillar, v_service, v_human, v_human),
    (v_org, 'Plan lalu', now(), v_pillar, v_service, v_ai, v_ai);

  INSERT INTO public.thinking_master_thoughts (
    id, organization_id, statement, original_input, status, workspace, canonical_semantic
  ) VALUES (
    v_master, v_org, 'Master uji', 'Master uji', 'locked', 'thinking_lab', '{"subject":"keluarga"}'::jsonb
  );

  INSERT INTO public.thinking_big_thoughts (id, organization_id, master_thought_id, code, title, statement, status)
  VALUES (v_thought, v_org, v_master, 'BT1', 'Big', 'Big uji', 'locked');

  INSERT INTO public.thinking_lab_territories (
    id, organization_id, big_thought_id, code, statement, canonical_semantic, admission
  ) VALUES (
    v_territory, v_org, v_thought, 'TR1', 'Territory uji', '{}'::jsonb, 'GENERATE_VALID'
  );

  INSERT INTO public.thinking_lab_angles (
    id, organization_id, territory_id, code, statement, parent_territory_fingerprint,
    canonical_semantic, admission, status
  ) VALUES (
    v_angle, v_org, v_territory, 'AN1', 'Angle uji', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked'
  );

  INSERT INTO public.thinking_lab_ideas (
    id, organization_id, angle_id, code, statement, parent_angle_fingerprint,
    canonical_semantic, admission, status, validation, updated_at
  ) VALUES (
    v_idea, v_org, v_angle, 'ID1', 'Idea uji', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked',
    '{"decision":"LOLOS"}'::jsonb, now() - interval '30 days'
  );

  v_saved := public.ai_employee_brief_write(
    v_owner, v_org, v_ai,
    jsonb_build_object(
      'service_ids', jsonb_build_array(v_service),
      'audience', 'keluarga',
      'persona_ids', jsonb_build_array(v_persona),
      'voice', 'hangat',
      'required_notes', 'sebut sate',
      'forbidden_notes', 'jangan harga',
      'pillar_ids', jsonb_build_array(v_pillar),
      'split_rule', ''
    )
  );
  IF v_saved->'brief'->'personas'->0->>'audience' IS DISTINCT FROM 'ibu muda' THEN
    RAISE EXCEPTION 'persona brief harus berisi audiens, bukan data lain';
  END IF;
  IF v_saved->'previous'->>'voice' IS DISTINCT FROM '' OR v_saved->'brief'->>'voice' IS DISTINCT FROM 'hangat' THEN
    RAISE EXCEPTION 'brief harus menyimpan isi lama dan baru';
  END IF;

  BEGIN
    PERFORM public.ai_employee_brief_write(v_admin, v_org, v_ai, '{"service_ids":[],"persona_ids":[],"pillar_ids":[]}'::jsonb);
    RAISE EXCEPTION 'admin tidak boleh mengubah brief';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  UPDATE public.user_roles
  SET role = ' Owner '
  WHERE user_id = v_owner AND organization_id = v_org;
  PERFORM public.ai_employee_brief_read(v_owner, v_org, v_ai);
  UPDATE public.user_roles
  SET role = 'owner'
  WHERE user_id = v_owner AND organization_id = v_org;

  v_run := public.ai_employee_run_start(v_ai, 'SOP1');

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'calendar', '{"from":"2026-11-09","to":"2026-11-15"}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 2
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) row WHERE row->>'author_name' = 'PIC Manusia')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) row WHERE row ? 'brief')
  THEN
    RAISE EXCEPTION 'kalender harus memuat plan semua orang, tanpa brief';
  END IF;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'plans', '{"from":"2026-11-09","to":"2026-11-15"}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'scope plans harus tetap hanya plan Naya';
  END IF;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'thinking', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 1
    OR v_rows->0->>'idea_statement' IS DISTINCT FROM 'Idea uji'
    OR v_rows->0->>'master_statement' IS DISTINCT FROM 'Master uji'
    OR v_rows->0->>'big_thought_statement' IS DISTINCT FROM 'Big uji'
    OR v_rows->0->>'territory_statement' IS DISTINCT FROM 'Territory uji'
    OR v_rows->0->>'angle_statement' IS DISTINCT FROM 'Angle uji'
    OR (v_rows->0->>'used')::boolean IS DISTINCT FROM false
    OR v_rows->0 ? 'development_paths'
  THEN
    RAISE EXCEPTION 'thinking harus rantai yang sudah lolos dan belum jadi plan';
  END IF;

  FOR v_i IN 1..8 LOOP
    v_extra := gen_random_uuid();
    INSERT INTO public.thinking_lab_ideas (
      id, organization_id, angle_id, code, statement, parent_angle_fingerprint,
      canonical_semantic, admission, status, validation, updated_at
    ) VALUES (
      v_extra, v_org, v_angle, 'USED' || v_i, 'Idea terpakai ' || v_i, 'fp',
      '{}'::jsonb, 'GENERATE_VALID', 'locked', '{"decision":"LOLOS"}'::jsonb,
      now() - make_interval(hours => v_i)
    );
    INSERT INTO public.social_media_plans (
      organization_id, title, post_date, content_pillar_id, service_id,
      author_employee_id, pic_id, thinking_idea_id
    ) VALUES (
      v_org, 'Plan terpakai ' || v_i, '2026-10-01 00:00:00+07', v_pillar, v_service,
      v_human, v_human, v_extra
    );
  END LOOP;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'thinking', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) IS DISTINCT FROM 8
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) row
      WHERE row->>'idea_id' = v_idea::text
        AND (row->>'used')::boolean = false
    )
  THEN
    RAISE EXCEPTION 'idea lama yang belum dipakai harus tetap muncul';
  END IF;

  SELECT rows INTO v_rows
  FROM jsonb_to_record(public.ai_employee_context(v_ai, v_run, 'performance', '{}'::jsonb))
    AS x(rows jsonb);
  IF jsonb_array_length(v_rows) < 1
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) row
      WHERE row ? 'account_id' OR row ? 'open_id' OR row ? 'email'
    )
  THEN
    RAISE EXCEPTION 'performa harus angka agregat tanpa data pribadi';
  END IF;

  v_check := public.ai_employee_accept_execution(v_org, v_ai, '{"accepted":true}'::jsonb);
  IF (v_check->>'accepted')::boolean IS DISTINCT FROM false OR v_check->>'check_id' IS DISTINCT FROM 'input' THEN
    RAISE EXCEPTION 'accepted true tanpa cek tidak boleh lolos';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('id', id, 'state', 'pass'))
  INTO v_checks
  FROM unnest(ARRAY[
    'hookHolds', 'soundsSpoken', 'usesSlang', 'pillarFits', 'formatHolds',
    'mechanismVisible', 'messageStays', 'causeChain', 'viewerClimb', 'emotionalTone'
  ]) AS id;

  INSERT INTO public.thinking_lab_executions (
    id, organization_id, idea_id, pillar, content_pillar_id, pillar_name,
    statement, canonical_semantic, admission, script
  ) VALUES (
    v_human_ex, v_org, v_idea, v_pillar::text, v_pillar, 'Produk Uji',
    'teks manusia',
    jsonb_build_object(
      'resolution', 'RESOLVED',
      'relationToParent', 'VALID_EXECUTION',
      'unresolvedReasons', '[]'::jsonb
    ),
    'GENERATE_VALID',
    jsonb_build_object('title', 'Manusia')
  );

  v_check := public.ai_employee_accept_execution(v_org, v_ai, jsonb_build_object(
    'idea_id', v_idea,
    'content_pillar_id', v_pillar,
    'statement', 'Makan malam keluarga',
    'checks', v_checks,
    'facts', jsonb_build_object(
      'resolution', 'RESOLVED',
      'relationToParent', 'VALID_EXECUTION',
      'unresolvedReasons', '[]'::jsonb
    ),
    'script', jsonb_build_object('title', 'Makan malam')
  ));
  v_ai_ex := NULLIF(v_check->>'execution_id', '')::uuid;
  IF (v_check->>'accepted')::boolean IS DISTINCT FROM true OR v_ai_ex IS NULL OR v_ai_ex = v_human_ex THEN
    RAISE EXCEPTION 'cek lengkap harus menyimpan execution AI sendiri';
  END IF;

  v_check := public.ai_employee_accept_execution(v_org, v_ai, jsonb_build_object(
    'idea_id', v_idea,
    'content_pillar_id', v_pillar,
    'statement', 'Makan malam diubah',
    'checks', v_checks,
    'facts', jsonb_build_object(
      'resolution', 'RESOLVED',
      'relationToParent', 'VALID_EXECUTION',
      'unresolvedReasons', '[]'::jsonb
    ),
    'script', jsonb_build_object('title', 'Makan malam')
  ));
  IF v_check->>'execution_id' IS DISTINCT FROM v_ai_ex::text
    OR NOT EXISTS (
      SELECT 1 FROM public.thinking_lab_executions ex
      WHERE ex.id = v_human_ex
        AND ex.statement = 'teks manusia'
        AND ex.author_employee_id IS NULL
        AND ex.script->>'title' = 'Manusia'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.thinking_lab_executions ex
      WHERE ex.id = v_ai_ex
        AND ex.author_employee_id = v_ai
        AND ex.statement = 'Makan malam diubah'
    )
    OR (
      SELECT count(*) FROM public.thinking_lab_executions ex
      WHERE ex.idea_id = v_idea AND ex.content_pillar_id = v_pillar
    ) IS DISTINCT FROM 2
  THEN
    RAISE EXCEPTION 'execution buatan manusia tidak boleh berubah';
  END IF;

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  VALUES
    (v_ai, v_org, 'thinking.plan.save'),
    (v_ai, v_org, 'thinking.execution.check'),
    (v_ai, v_org, 'ads.campaign.create');

  v_plan := public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
    'title', 'Plan dari idea',
    'brief', 'Makan malam',
    'post_date', '2026-11-11',
    'content_pillar_id', v_pillar,
    'service_id', v_service,
    'idea_id', v_idea,
    'execution_id', v_check->>'execution_id'
  ));
  IF v_plan->>'id' IS NULL THEN
    RAISE EXCEPTION 'plan harus terhubung ke idea';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.social_media_plans plan
    WHERE plan.id = (v_plan->>'id')::uuid
      AND plan.thinking_idea_id = v_idea
      AND plan.production_status = 'Need Review'
      AND plan.approved = false
  ) THEN
    RAISE EXCEPTION 'plan idea harus Need Review dan belum disetujui';
  END IF;

  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'thinking.plan.save', jsonb_build_object(
      'title', 'Plan kedua',
      'post_date', '2026-11-12',
      'content_pillar_id', v_pillar,
      'idea_id', v_idea,
      'execution_id', v_check->>'execution_id'
    ));
    RAISE EXCEPTION 'idea yang sudah jadi plan harus ditolak';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_perform(v_ai, v_run, 'ads.campaign.create', '{}'::jsonb);
    RAISE EXCEPTION 'aksi iklan harus tetap ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  IF has_table_privilege('anon', 'public.ai_employee_briefs', 'SELECT')
    OR has_table_privilege('authenticated', 'public.ai_employee_briefs', 'SELECT')
    OR has_table_privilege('service_role', 'public.ai_employee_briefs', 'SELECT')
    OR has_function_privilege('anon', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_accept_execution(uuid,uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.ai_employee_brief_write(uuid,uuid,uuid,jsonb)', 'EXECUTE')
    OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'hak akses brief atau pintu tidak sesuai';
  END IF;
END
$test$;

ROLLBACK;
