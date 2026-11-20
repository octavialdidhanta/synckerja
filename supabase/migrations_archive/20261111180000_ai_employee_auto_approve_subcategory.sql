-- Sub Category and content-plan auto approve for an AI employee brief.
-- Generate now and the daily schedule both use ai_employee_perform.

ALTER TABLE public.ai_employee_briefs
  ADD COLUMN IF NOT EXISTS sub_service_id uuid,
  ADD COLUMN IF NOT EXISTS content_plan_auto_approve boolean NOT NULL DEFAULT false;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_employee_briefs_sub_service_id_fkey'
  ) THEN
    ALTER TABLE public.ai_employee_briefs
      ADD CONSTRAINT ai_employee_briefs_sub_service_id_fkey
      FOREIGN KEY (sub_service_id) REFERENCES public.sub_services (id) ON DELETE SET NULL;
  END IF;
END;
$fk$;

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_sub_service(
  p_organization_id uuid,
  p_service_id uuid,
  p_chosen uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sub$
DECLARE
  v_id uuid;
BEGIN
  IF p_organization_id IS NULL OR p_service_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT sub.id
    INTO v_id
  FROM public.sub_services sub
  WHERE sub.id = p_chosen
    AND sub.organization_id = p_organization_id
    AND sub.service_id = p_service_id
    AND COALESCE(sub.is_active, true);
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT sub.id
    INTO v_id
  FROM public.sub_services sub
  WHERE sub.organization_id = p_organization_id
    AND sub.service_id = p_service_id
    AND COALESCE(sub.is_active, true)
    AND lower(btrim(sub.name)) = 'general content'
  ORDER BY sub.created_at
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.sub_services (organization_id, service_id, name, is_active)
  VALUES (p_organization_id, p_service_id, 'General Content', true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$sub$;

REVOKE ALL ON FUNCTION public.ai_employee_catalog_sub_service(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DO $write$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)'::regprocedure);
  old_declare text := 'v_split text; BEGIN';
  new_declare text := 'v_split text; v_sub uuid; v_auto boolean; v_has_sub boolean; v_has_auto boolean; BEGIN';
  old_previous text := 'v_previous := public.ai_employee_brief_payload(p_employee_id);';
  new_previous text := $sql$v_has_sub := p_brief ? 'sub_service_id';
  v_has_auto := p_brief ? 'content_plan_auto_approve';
  v_sub := NULL;
  IF v_has_sub AND NULLIF(btrim(COALESCE(p_brief->>'sub_service_id', '')), '') IS NOT NULL THEN
    IF (p_brief->>'sub_service_id') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_sub := (p_brief->>'sub_service_id')::uuid;
  END IF;
  v_auto := CASE
    WHEN NOT v_has_auto THEN false
    WHEN jsonb_typeof(p_brief->'content_plan_auto_approve') = 'boolean' THEN (p_brief->>'content_plan_auto_approve')::boolean
    ELSE NULL
  END;
  IF v_has_auto AND v_auto IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_sub IS NOT NULL AND (
    cardinality(v_services) <> 1
    OR NOT EXISTS (
      SELECT 1
      FROM public.sub_services sub
      WHERE sub.id = v_sub
        AND sub.organization_id = p_organization_id
        AND sub.service_id = v_services[1]
        AND COALESCE(sub.is_active, true)
    )
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_previous := public.ai_employee_brief_payload(p_employee_id);$sql$;
  old_insert text := 'pillar_ids, product_knowledge_ids, angle_ids, repeat_voices, split_rule, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, now())';
  new_insert text := 'pillar_ids, product_knowledge_ids, angle_ids, repeat_voices, split_rule, sub_service_id, content_plan_auto_approve, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, v_sub, COALESCE(v_auto, false), now())';
  old_conflict text := 'split_rule = EXCLUDED.split_rule,';
  new_conflict text := $sql$split_rule = EXCLUDED.split_rule,
      sub_service_id = CASE
        WHEN v_has_sub THEN EXCLUDED.sub_service_id
        WHEN cardinality(EXCLUDED.service_ids) = 1 AND EXISTS (
          SELECT 1 FROM public.sub_services sub
          WHERE sub.id = ai_employee_briefs.sub_service_id
            AND sub.organization_id = EXCLUDED.organization_id
            AND sub.service_id = (EXCLUDED.service_ids)[1]
            AND COALESCE(sub.is_active, true)
        ) THEN ai_employee_briefs.sub_service_id
        ELSE NULL
      END,
      content_plan_auto_approve = CASE
        WHEN v_has_auto THEN EXCLUDED.content_plan_auto_approve
        ELSE ai_employee_briefs.content_plan_auto_approve
      END,$sql$;
BEGIN
  IF position('content_plan_auto_approve = CASE' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_declare IN def) = 0
    OR position(old_previous IN def) = 0
    OR position(old_insert IN def) = 0
    OR position(old_conflict IN def) = 0
  THEN
    RAISE EXCEPTION 'ai_employee_brief_write_snippet_missing';
  END IF;
  def := replace(def, old_declare, new_declare);
  def := replace(def, old_previous, new_previous);
  def := replace(def, old_insert, new_insert);
  def := replace(def, old_conflict, new_conflict);
  EXECUTE def;
END;
$write$;

DO $payload$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_payload(uuid)'::regprocedure);
  old_empty text := $old$    'company_logos', '[]'::jsonb,
    'palette', NULL$old$;
  new_empty text := $new$    'company_logos', '[]'::jsonb,
    'content_plan_auto_approve', false,
    'sub_service_id', NULL,
    'sub_services', '[]'::jsonb,
    'palette', NULL$new$;
  old_saved text := $old$    'palette', (
      SELECT jsonb_build_object(
        'primary', lower(color.primary_color_hex),$old$;
  new_saved text := $new$    'content_plan_auto_approve', COALESCE(v_row.content_plan_auto_approve, false),
    'sub_service_id', CASE
      WHEN cardinality(v_row.service_ids) = 1 AND EXISTS (
        SELECT 1 FROM public.sub_services sub
        WHERE sub.id = v_row.sub_service_id
          AND sub.organization_id = v_org
          AND sub.service_id = v_row.service_ids[1]
          AND COALESCE(sub.is_active, true)
      ) THEN v_row.sub_service_id
      ELSE NULL
    END,
    'sub_services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sub.id,
        'name', left(btrim(sub.name), 80),
        'service_id', sub.service_id
      ) ORDER BY sub.name)
      FROM public.sub_services sub
      WHERE cardinality(v_row.service_ids) = 1
        AND sub.organization_id = v_org
        AND sub.service_id = v_row.service_ids[1]
        AND COALESCE(sub.is_active, true)
    ), '[]'::jsonb),
    'palette', (
      SELECT jsonb_build_object(
        'primary', lower(color.primary_color_hex),$new$;
BEGIN
  IF position('''sub_services''' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_empty IN def) = 0 OR position(old_saved IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_payload_snippet_missing';
  END IF;
  def := replace(def, old_empty, new_empty);
  def := replace(def, old_saved, new_saved);
  EXECUTE def;
END;
$payload$;

DO $perform$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure);
  old_insert text := $old$      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,$old$;
  new_insert text := $new$      organization_id, title, brief, post_date, content_pillar_id, service_id, sub_service_id, thinking_idea_id,$new$;
  old_values text := $old$      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,$old$;
  new_values text := $new$      v_org, v_title, v_brief, v_post, v_pillar, v_service,
      public.ai_employee_catalog_sub_service(
        v_org,
        v_service,
        (SELECT brief.sub_service_id FROM public.ai_employee_briefs brief WHERE brief.employee_id = p_employee_id)
      ),
      v_idea,$new$;
  old_after text := $old$      VALUES (v_id, v_carousel_concept);
    END IF;

    UPDATE public.ai_employee_runs$old$;
  new_after text := $new$      VALUES (v_id, v_carousel_concept);
    END IF;

    IF v_service IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.ai_employee_briefs brief
      WHERE brief.employee_id = p_employee_id
        AND brief.organization_id = v_org
        AND brief.content_plan_auto_approve IS TRUE
    ) THEN
      UPDATE public.social_media_plans
      SET approved = true,
          status = 'Approved',
          completion_date = now()
      WHERE id = v_id
        AND approved IS NOT TRUE;
    END IF;

    UPDATE public.ai_employee_runs$new$;
BEGIN
  IF position('ai_employee_catalog_sub_service' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_insert IN def) = 0
    OR position(old_values IN def) = 0
    OR position(old_after IN def) = 0
  THEN
    RAISE EXCEPTION 'ai_employee_perform_subcategory_snippet_missing';
  END IF;
  def := replace(def, old_insert, new_insert);
  def := replace(def, old_values, new_values);
  def := replace(def, old_after, new_after);
  EXECUTE def;
END;
$perform$;
