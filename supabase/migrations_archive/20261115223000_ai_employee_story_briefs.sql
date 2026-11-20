-- Fase 1 Design Story: brief terpisah dari ai_employee_briefs (carousel).

CREATE TABLE IF NOT EXISTS public.ai_employee_story_briefs (
  employee_id uuid PRIMARY KEY
    REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  service_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  angle_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  pillar_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  brand_color_id uuid
    REFERENCES public.digital_asset_brand_colors (id) ON DELETE SET NULL,
  headline_font text NOT NULL DEFAULT '',
  body_font text NOT NULL DEFAULT '',
  story_auto_approve boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_story_briefs_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_story_briefs_service_limit CHECK (cardinality(service_ids) <= 1),
  CONSTRAINT ai_employee_story_briefs_angle_limit CHECK (cardinality(angle_ids) <= 6),
  CONSTRAINT ai_employee_story_briefs_pillar_limit CHECK (cardinality(pillar_ids) <= 12),
  CONSTRAINT ai_employee_story_briefs_font_length CHECK (
    char_length(headline_font) <= 60
    AND char_length(body_font) <= 60
  )
);

CREATE INDEX IF NOT EXISTS ai_employee_story_briefs_org_idx
  ON public.ai_employee_story_briefs (organization_id);

ALTER TABLE public.ai_employee_story_briefs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_employee_story_briefs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_employee_story_briefs TO service_role;

COMMENT ON TABLE public.ai_employee_story_briefs IS
  'Brief Design Story (SOP4). Terpisah dari ai_employee_briefs carousel.';

CREATE OR REPLACE FUNCTION public.ai_employee_story_brief_payload(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_row public.ai_employee_story_briefs%ROWTYPE;
BEGIN
  SELECT employee.organization_id
  INTO v_org
  FROM public.employees employee
  WHERE employee.id = p_employee_id
    AND COALESCE(employee.is_ai, false);
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.ai_employee_story_briefs brief
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'service_ids', '[]'::jsonb,
      'angle_ids', '[]'::jsonb,
      'pillar_ids', '[]'::jsonb,
      'brand_color_id', NULL,
      'headline_font', '',
      'body_font', '',
      'story_auto_approve', true,
      'services', '[]'::jsonb,
      'angles', '[]'::jsonb,
      'pillars', '[]'::jsonb,
      'brand_colors', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', color.id,
          'brand_name', COALESCE(color.brand_name, ''),
          'primary_color_hex', color.primary_color_hex,
          'secondary_color_hex', color.secondary_color_hex,
          'accent_color_hex', color.accent_color_hex
        ) ORDER BY color.created_at NULLS LAST, color.id)
        FROM public.digital_asset_brand_colors color
        WHERE color.organization_id = v_org
      ), '[]'::jsonb)
    );
  END IF;

  RETURN jsonb_build_object(
    'service_ids', to_jsonb(COALESCE(v_row.service_ids, '{}'::uuid[])),
    'angle_ids', to_jsonb(COALESCE(v_row.angle_ids, '{}'::uuid[])),
    'pillar_ids', to_jsonb(COALESCE(v_row.pillar_ids, '{}'::uuid[])),
    'brand_color_id', v_row.brand_color_id,
    'headline_font', COALESCE(v_row.headline_font, ''),
    'body_font', COALESCE(v_row.body_font, ''),
    'story_auto_approve', COALESCE(v_row.story_auto_approve, true),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', svc.id,
        'label', left(btrim(svc.name), 80)
      ) ORDER BY svc.name)
      FROM public.services svc
      WHERE svc.organization_id = v_org
        AND svc.id = ANY (COALESCE(v_row.service_ids, '{}'::uuid[]))
    ), '[]'::jsonb),
    'angles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', angle.id,
        'label', left(btrim(COALESCE(
          NULLIF(btrim(angle.statement), ''),
          NULLIF(btrim(angle.code), ''),
          angle.id::text
        )), 80)
      ) ORDER BY angle.code)
      FROM public.thinking_lab_angles angle
      WHERE angle.organization_id = v_org
        AND angle.id = ANY (COALESCE(v_row.angle_ids, '{}'::uuid[]))
    ), '[]'::jsonb),
    'pillars', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pillar.id,
        'label', left(btrim(pillar.name), 80)
      ) ORDER BY pillar.name)
      FROM public.content_pillars pillar
      WHERE pillar.id = ANY (COALESCE(v_row.pillar_ids, '{}'::uuid[]))
    ), '[]'::jsonb),
    'brand_colors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', color.id,
        'brand_name', COALESCE(color.brand_name, ''),
        'primary_color_hex', color.primary_color_hex,
        'secondary_color_hex', color.secondary_color_hex,
        'accent_color_hex', color.accent_color_hex
      ) ORDER BY color.created_at NULLS LAST, color.id)
      FROM public.digital_asset_brand_colors color
      WHERE color.organization_id = v_org
        AND (
          cardinality(COALESCE(v_row.service_ids, '{}'::uuid[])) = 0
          OR color.service_id = ANY (COALESCE(v_row.service_ids, '{}'::uuid[]))
          OR color.id = v_row.brand_color_id
        )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_story_saved_catalog(p_employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_service uuid;
BEGIN
  SELECT brief.service_ids[1]
  INTO v_service
  FROM public.ai_employee_story_briefs brief
  WHERE brief.employee_id = p_employee_id
    AND cardinality(brief.service_ids) = 1;
  IF v_service IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN v_service;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_story_brief_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_brief jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_services uuid[];
  v_angles uuid[];
  v_pillars uuid[];
  v_color uuid;
  v_headline text;
  v_body text;
  v_auto boolean;
BEGIN
  PERFORM public.ai_employee_require_owner(p_user_id, p_organization_id);

  IF p_brief IS NULL OR jsonb_typeof(p_brief) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  v_services := public.ai_employee_brief_ids(p_brief->'service_ids');
  v_angles := public.ai_employee_brief_ids(p_brief->'angle_ids');
  v_pillars := public.ai_employee_brief_ids(p_brief->'pillar_ids');
  v_color := NULLIF(btrim(COALESCE(p_brief->>'brand_color_id', '')), '')::uuid;
  v_headline := left(btrim(COALESCE(p_brief->>'headline_font', '')), 60);
  v_body := left(btrim(COALESCE(p_brief->>'body_font', '')), 60);
  v_auto := COALESCE((p_brief->>'story_auto_approve')::boolean, true);

  IF cardinality(v_services) > 1
     OR cardinality(v_angles) > 6
     OR cardinality(v_pillars) > 12 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_services) AS picked(picked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.services svc
      WHERE svc.id = picked.picked_id
        AND svc.organization_id = p_organization_id
        AND COALESCE(svc.is_active, true)
    )
  ) OR EXISTS (
    SELECT 1
    FROM unnest(v_angles) AS picked(picked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.thinking_lab_angles angle
      WHERE angle.id = picked.picked_id
        AND angle.organization_id = p_organization_id
    )
  ) OR EXISTS (
    SELECT 1
    FROM unnest(v_pillars) AS picked(picked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.content_pillars pillar
      WHERE pillar.id = picked.picked_id
        AND pillar.is_active
        AND (pillar.organization_id = p_organization_id OR pillar.is_default)
    )
  ) OR (
    v_color IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.digital_asset_brand_colors color
      WHERE color.id = v_color
        AND color.organization_id = p_organization_id
    )
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_employee_story_briefs (
    employee_id,
    organization_id,
    service_ids,
    angle_ids,
    pillar_ids,
    brand_color_id,
    headline_font,
    body_font,
    story_auto_approve,
    updated_at
  ) VALUES (
    p_employee_id,
    p_organization_id,
    v_services,
    v_angles,
    v_pillars,
    v_color,
    v_headline,
    v_body,
    v_auto,
    now()
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    service_ids = EXCLUDED.service_ids,
    angle_ids = EXCLUDED.angle_ids,
    pillar_ids = EXCLUDED.pillar_ids,
    brand_color_id = EXCLUDED.brand_color_id,
    headline_font = EXCLUDED.headline_font,
    body_font = EXCLUDED.body_font,
    story_auto_approve = EXCLUDED.story_auto_approve,
    updated_at = now();

  RETURN public.ai_employee_story_brief_payload(p_employee_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_page_story_brief_save(
  p_employee_id uuid,
  p_brief jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_story_brief_write(auth.uid(), v_org, p_employee_id, p_brief);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_story_catalog_color_set(
  p_employee_id uuid,
  p_color_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_story_saved_catalog(p_employee_id);
  IF p_color_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.digital_asset_brand_colors color
    WHERE color.id = p_color_id
      AND color.organization_id = v_org
      AND color.service_id = v_service
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_employee_story_briefs (
    employee_id, organization_id, brand_color_id, story_auto_approve, updated_at
  ) VALUES (
    p_employee_id, v_org, p_color_id, true, now()
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    brand_color_id = EXCLUDED.brand_color_id,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_story_catalog_color_save(
  p_employee_id uuid,
  p_color_id uuid,
  p_brand_name text,
  p_primary text,
  p_secondary text,
  p_accent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
  v_id uuid;
  v_name text;
  v_primary text := lower(btrim(COALESCE(p_primary, '')));
  v_secondary text := lower(btrim(COALESCE(p_secondary, '')));
  v_accent text := lower(btrim(COALESCE(p_accent, '')));
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_story_saved_catalog(p_employee_id);
  IF v_primary !~ '^#[0-9a-f]{6}$'
    OR v_secondary !~ '^#[0-9a-f]{6}$'
    OR v_accent !~ '^#[0-9a-f]{6}$'
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_name := NULLIF(left(btrim(COALESCE(p_brand_name, '')), 80), '');
  IF p_color_id IS NULL THEN
    INSERT INTO public.digital_asset_brand_colors (
      organization_id, service_id, brand_name,
      primary_color_hex, secondary_color_hex, accent_color_hex, text_color_hex
    ) VALUES (
      v_org, v_service, v_name, v_primary, v_secondary, v_accent, NULL
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.digital_asset_brand_colors color
    SET brand_name = v_name,
        primary_color_hex = v_primary,
        secondary_color_hex = v_secondary,
        accent_color_hex = v_accent,
        updated_at = now()
    WHERE color.id = p_color_id
      AND color.organization_id = v_org
      AND color.service_id = v_service
    RETURNING color.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.ai_employee_story_briefs (
    employee_id, organization_id, brand_color_id, story_auto_approve, updated_at
  ) VALUES (
    p_employee_id, v_org, v_id, true, now()
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    brand_color_id = EXCLUDED.brand_color_id,
    updated_at = now();

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_story_catalog_color_delete(
  p_employee_id uuid,
  p_color_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_story_saved_catalog(p_employee_id);
  IF p_color_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_employee_story_briefs brief
  SET brand_color_id = NULL,
      updated_at = now()
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org
    AND brief.brand_color_id = p_color_id;

  DELETE FROM public.digital_asset_brand_colors color
  WHERE color.id = p_color_id
    AND color.organization_id = v_org
    AND color.service_id = v_service;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_page_read(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_can_edit boolean;
  v_name text;
  v_title text;
  v_reviewer text;
  v_status text;
  v_active boolean;
  v_brief jsonb;
  v_story_brief jsonb;
  v_service_ids uuid[];
  v_persona_ids uuid[];
  v_pillar_ids uuid[];
  v_product_ids uuid[];
  v_angle_ids uuid[];
  v_key_results jsonb;
  v_runs jsonb;
  v_jobs jsonb;
  v_schedules jsonb;
  v_routines jsonb;
  v_copy_1 text;
  v_copy_2 text;
  v_sender text;
  v_services jsonb;
  v_personas jsonb;
  v_pillars jsonb;
  v_products jsonb;
  v_angles jsonb;
  v_cap integer;
  v_used integer;
  v_remaining integer;
  v_date date;
  v_org_limit integer;
  v_org_used integer;
  v_org_date date;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) = 'owner'
  )
  INTO v_can_edit;

  SELECT employee.full_name,
         profile.job_title,
         reviewer.full_name,
         profile.performance_status,
         profile.is_active
  INTO v_name, v_title, v_reviewer, v_status, v_active
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND employee.organization_id = v_org;

  v_brief := public.ai_employee_brief_payload(p_employee_id);
  v_story_brief := public.ai_employee_story_brief_payload(p_employee_id);
  v_service_ids := public.ai_employee_brief_ids(v_brief->'service_ids');
  v_persona_ids := public.ai_employee_brief_ids(v_brief->'persona_ids');
  v_pillar_ids := public.ai_employee_brief_ids(v_brief->'pillar_ids');
  v_product_ids := public.ai_employee_brief_ids(v_brief->'product_knowledge_ids');
  v_angle_ids := public.ai_employee_brief_ids(v_brief->'angle_ids');
  v_angles := public.ai_employee_angle_options(v_org, v_angle_ids);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', kr.ai_kr_code,
    'title', kr.title,
    'current_value', kr.current_value,
    'target_value', kr.target_value,
    'unit', kr.unit,
    'progress_percentage', kr.progress_percentage
  ) ORDER BY kr.ai_kr_code, kr.title), '[]'::jsonb)
  INTO v_key_results
  FROM public.key_results kr
  JOIN public.individual_objectives objective
    ON objective.id = kr.individual_objective_id
  WHERE objective.organization_id = v_org
    AND objective.employee_id = p_employee_id
    AND kr.ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', run.id,
    'started_at', run.started_at,
    'finished_at', run.finished_at,
    'sop_code', run.sop_code,
    'status', run.status,
    'plan_count', run.plan_count,
    'note', left(COALESCE(run.note, ''), 240),
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', plan.id,
        'title', COALESCE(plan.title, '')
      ) ORDER BY plan.title)
      FROM public.social_media_plans plan
      WHERE plan.organization_id = v_org
        AND plan.id = ANY (run.object_ids)
    ), '[]'::jsonb)
  ) ORDER BY run.started_at DESC), '[]'::jsonb)
  INTO v_runs
  FROM (
    SELECT id, started_at, finished_at, sop_code, status, plan_count, note, object_ids
    FROM public.ai_employee_runs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY started_at DESC, id DESC
    LIMIT 20
  ) run;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', job.id,
    'source', job.source,
    'priority', job.priority,
    'status', job.status,
    'attempts', job.attempts,
    'reason', job.reason,
    'daily_task_id', job.daily_task_id,
    'plan_id', job.plan_id,
    'run_id', job.run_id,
    'next_attempt_at', job.next_attempt_at,
    'created_at', job.created_at,
    'claimed_at', job.claimed_at,
    'finished_at', job.finished_at
  ) ORDER BY job.created_at DESC, job.id DESC), '[]'::jsonb)
  INTO v_jobs
  FROM (
    SELECT id, source, priority, status, attempts, reason, daily_task_id, plan_id,
           run_id, next_attempt_at, created_at, claimed_at, finished_at
    FROM public.ai_employee_jobs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  ) job;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sop_code', schedule.sop_code,
    'cadence', schedule.cadence,
    'weekday', schedule.weekday,
    'weekdays', schedule.weekdays,
    'start_local', to_char(schedule.start_local, 'HH24:MI'),
    'due_local', to_char(schedule.due_local, 'HH24:MI'),
    'start_times', COALESCE((
      SELECT jsonb_agg(to_char(slot, 'HH24:MI') ORDER BY slot)
      FROM unnest(COALESCE(schedule.start_times, ARRAY[schedule.start_local])) AS slot
    ), '[]'::jsonb),
    'plan_count', schedule.plan_count,
    'is_active', schedule.is_active,
    'next_run_at', schedule.next_run_at
  ) ORDER BY schedule.sop_code, schedule.cadence), '[]'::jsonb)
  INTO v_schedules
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = v_org;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'action_code', routine.action_code,
    'cadence', routine.cadence,
    'weekday', routine.weekday,
    'weekdays', routine.weekdays,
    'time_local', to_char(routine.time_local, 'HH24:MI'),
    'is_active', routine.is_active,
    'next_run_at', routine.next_run_at,
    'last_sent_at', routine.last_sent_at,
    'last_status', routine.last_status,
    'last_error', left(routine.last_error, 240),
    'reviewer_name', reviewer.full_name,
    'reviewer_email', NULLIF(btrim(reviewer.email), '')
  ) ORDER BY routine.action_code), '[]'::jsonb)
  INTO v_routines
  FROM public.ai_employee_routines routine
  JOIN public.ai_employee_profiles profile
    ON profile.employee_id = routine.employee_id
   AND profile.organization_id = routine.organization_id
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = routine.organization_id
  WHERE routine.employee_id = p_employee_id
    AND routine.organization_id = v_org;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_services
  FROM (
    SELECT svc.id, left(btrim(svc.name), 80) AS label
    FROM public.services svc
    WHERE svc.organization_id = v_org
      AND (
        COALESCE(svc.is_active, true)
        OR svc.id = ANY (v_service_ids)
      )
      AND (
        svc.id = ANY (v_service_ids)
        OR svc.id IN (
          SELECT picked.id
          FROM public.services picked
          WHERE picked.organization_id = v_org
            AND COALESCE(picked.is_active, true)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_personas
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Persona')), 80) AS label
    FROM public.product_knowledge knowledge
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_persona_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_pillars
  FROM (
    SELECT pillar.id, left(btrim(pillar.name), 80) AS label
    FROM public.content_pillars pillar
    WHERE (
        pillar.id = ANY (v_pillar_ids)
        OR (
          pillar.is_active
          AND (pillar.organization_id = v_org OR pillar.is_default)
        )
      )
      AND (
        pillar.id = ANY (v_pillar_ids)
        OR pillar.id IN (
          SELECT picked.id
          FROM public.content_pillars picked
          WHERE picked.is_active
            AND (picked.organization_id = v_org OR picked.is_default)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label,
    'service_id', item.service_id,
    'parent_service_id', item.parent_service_id
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Produk')), 80) AS label,
           knowledge.service_id,
           sub.service_id AS parent_service_id
    FROM public.product_knowledge knowledge
    LEFT JOIN public.sub_services sub
      ON sub.id = knowledge.sub_service_id
     AND sub.organization_id = knowledge.organization_id
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_product_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  v_date := (timezone('Asia/Jakarta', now()))::date;
  v_org_date := (timezone('UTC', now()))::date;

  SELECT CASE WHEN profile.performance_status = 'coaching' THEN 8 ELSE 1000 END
  INTO v_cap
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = v_org;

  SELECT calls.call_count
  INTO v_used
  FROM public.ai_employee_model_calls calls
  WHERE calls.employee_id = p_employee_id
    AND calls.usage_date = v_date;
  v_used := COALESCE(v_used, 0);
  IF v_cap IS NULL THEN
    v_remaining := NULL;
  ELSE
    v_remaining := GREATEST(v_cap - v_used, 0);
  END IF;

  SELECT COALESCE(config.daily_limit, 50)
  INTO v_org_limit
  FROM public.organization_script_ai_config config
  WHERE config.organization_id = v_org;
  IF v_org_limit IS NULL OR v_org_limit < 1 THEN
    v_org_limit := 50;
  END IF;

  SELECT COALESCE(usage."count", 0)
  INTO v_org_used
  FROM public.script_ai_daily_usage usage
  WHERE usage.organization_id = v_org
    AND usage.usage_date = v_org_date;
  v_org_used := COALESCE(v_org_used, 0);

  SELECT profile.report_copy_email_1,
         profile.report_copy_email_2,
         COALESCE(
           NULLIF(btrim(sender.full_name), ''),
           NULLIF(btrim(v_reviewer), '')
         )
  INTO v_copy_1, v_copy_2, v_sender
  FROM public.ai_employee_profiles profile
  LEFT JOIN public.profiles sender
    ON sender.user_id = profile.report_sender_user_id
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = v_org;

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'can_edit', v_can_edit,
    'summary', jsonb_build_object(
      'full_name', v_name,
      'job_title', v_title,
      'reviewer_name', v_reviewer,
      'performance_status', v_status,
      'is_active', v_active,
      'report_copy_email_1', v_copy_1,
      'report_copy_email_2', v_copy_2,
      'report_sender_name', v_sender
    ),
    'key_results', v_key_results,
    'runs', v_runs,
    'jobs', v_jobs,
    'schedules', v_schedules,
    'routines', v_routines,
    'brief', v_brief,
    'story_brief', v_story_brief,
    'options', jsonb_build_object(
      'services', v_services,
      'personas', v_personas,
      'pillars', v_pillars,
      'products', v_products,
      'angles', v_angles
    ),
    'quota', jsonb_build_object(
      'usage_date', v_date,
      'used', v_used,
      'cap', v_cap,
      'remaining', v_remaining,
      'org_usage_date', v_org_date,
      'org_used', v_org_used,
      'org_limit', v_org_limit,
      'org_remaining', GREATEST(v_org_limit - v_org_used, 0)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ai_employee_story_brief_payload(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_employee_story_brief_write(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_employee_page_story_brief_save(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_employee_story_saved_catalog(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_employee_story_catalog_color_set(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_employee_story_catalog_color_save(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_employee_story_catalog_color_delete(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ai_employee_story_brief_payload(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_brief_write(uuid, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_story_brief_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_saved_catalog(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_catalog_color_set(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_catalog_color_save(uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_catalog_color_delete(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.ai_employee_story_brief_payload(uuid) IS
  'Payload brief Design Story untuk page_read / UI.';
COMMENT ON FUNCTION public.ai_employee_story_brief_write(uuid, uuid, uuid, jsonb) IS
  'Owner upsert brief Design Story. Tidak menyentuh ai_employee_briefs.';
COMMENT ON FUNCTION public.ai_employee_page_story_brief_save(uuid, jsonb) IS
  'Owner menyimpan brief Design Story lewat page gate.';
COMMENT ON FUNCTION public.ai_employee_story_catalog_color_set(uuid, uuid) IS
  'Pilih warna brief Design Story saja (ai_employee_story_briefs).';
COMMENT ON FUNCTION public.ai_employee_story_catalog_color_save(uuid, uuid, text, text, text, text) IS
  'Simpan warna untuk katalog Story; hanya update story_briefs.';
COMMENT ON FUNCTION public.ai_employee_story_catalog_color_delete(uuid, uuid) IS
  'Hapus warna katalog Story; clear brand_color_id di story_briefs bila terpilih.';

-- Backfill shell rows for Content Planner AI employees.
INSERT INTO public.ai_employee_story_briefs (
  employee_id, organization_id, story_auto_approve
)
SELECT employee.id, employee.organization_id, true
FROM public.employees employee
JOIN public.ai_employee_profiles profile
  ON profile.employee_id = employee.id
 AND profile.organization_id = employee.organization_id
 AND profile.job_title = 'Content Planner'
WHERE COALESCE(employee.is_ai, false)
ON CONFLICT (employee_id) DO NOTHING;

-- Mirror katalog awal dari brief carousel bila Story masih kosong.
UPDATE public.ai_employee_story_briefs story
SET service_ids = ARRAY[carousel.service_ids[1]],
    updated_at = now()
FROM public.ai_employee_briefs carousel
WHERE carousel.employee_id = story.employee_id
  AND carousel.organization_id = story.organization_id
  AND cardinality(COALESCE(story.service_ids, '{}'::uuid[])) = 0
  AND cardinality(COALESCE(carousel.service_ids, '{}'::uuid[])) >= 1;
