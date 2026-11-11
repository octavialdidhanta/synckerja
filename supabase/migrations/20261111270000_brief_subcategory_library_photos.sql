-- Link a social sub category to one catalog product, and let an AI brief
-- choose more than one. Canva reads the linked product photo. Deleting a
-- content plan does not delete the product. Deleting the product clears the link.

ALTER TABLE public.sub_services
  ADD COLUMN IF NOT EXISTS catalog_product_id uuid;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sub_services_catalog_product_id_fkey'
  ) THEN
    ALTER TABLE public.sub_services
      ADD CONSTRAINT sub_services_catalog_product_id_fkey
      FOREIGN KEY (catalog_product_id) REFERENCES public.default_prices (id) ON DELETE SET NULL;
  END IF;
END;
$fk$;

CREATE INDEX IF NOT EXISTS idx_sub_services_catalog_product_id
  ON public.sub_services (catalog_product_id)
  WHERE catalog_product_id IS NOT NULL;

UPDATE public.sub_services AS sub
SET catalog_product_id = picked.product_id
FROM (
  SELECT s.id AS sub_id, (array_agg(p.id))[1] AS product_id
  FROM public.sub_services s
  JOIN public.default_prices p
    ON p.organization_id = s.organization_id
   AND p.kind = 'product'
   AND lower(btrim(p.name)) = lower(btrim(s.name))
  GROUP BY s.id
  HAVING count(*) = 1
) AS picked
WHERE sub.id = picked.sub_id
  AND sub.catalog_product_id IS NULL;

ALTER TABLE public.ai_employee_briefs
  ADD COLUMN IF NOT EXISTS sub_service_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.ai_employee_briefs
SET sub_service_ids = ARRAY[sub_service_id]
WHERE sub_service_id IS NOT NULL
  AND cardinality(sub_service_ids) = 0;

CREATE OR REPLACE FUNCTION public.sub_service_library_photos(
  p_organization_id uuid,
  p_ids uuid[]
)
RETURNS TABLE (sub_service_id uuid, product_name text, photo_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $photos$
  SELECT sub.id,
         left(btrim(sub.name), 80),
         product.photo_path
  FROM unnest(COALESCE(p_ids, '{}'::uuid[])) WITH ORDINALITY AS item(id, ord)
  JOIN public.sub_services sub
    ON sub.id = item.id
   AND sub.organization_id = p_organization_id
  JOIN LATERAL (
    SELECT chosen.photo_path
    FROM public.default_prices chosen
    WHERE chosen.organization_id = sub.organization_id
      AND chosen.kind = 'product'
      AND NULLIF(btrim(chosen.photo_path), '') IS NOT NULL
      AND (
        chosen.id = sub.catalog_product_id
        OR (
          sub.catalog_product_id IS NULL
          AND lower(btrim(chosen.name)) = lower(btrim(sub.name))
          AND (
            SELECT count(*)
            FROM public.default_prices other
            WHERE other.organization_id = sub.organization_id
              AND other.kind = 'product'
              AND lower(btrim(other.name)) = lower(btrim(sub.name))
          ) = 1
        )
      )
    ORDER BY (chosen.id IS NOT DISTINCT FROM sub.catalog_product_id) DESC, chosen.updated_at DESC NULLS LAST
    LIMIT 1
  ) AS product ON true
  ORDER BY item.ord;
$photos$;

REVOKE ALL ON FUNCTION public.sub_service_library_photos(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sub_service_library_photos(uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.ai_employee_pick_brief_sub_service(
  p_employee_id uuid,
  p_organization_id uuid,
  p_service_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $pick$
DECLARE
  v_ids uuid[];
  v_chosen uuid;
BEGIN
  SELECT COALESCE(brief.sub_service_ids, '{}'::uuid[])
    INTO v_ids
  FROM public.ai_employee_briefs brief
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = p_organization_id;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN (
      SELECT brief.sub_service_id
      FROM public.ai_employee_briefs brief
      WHERE brief.employee_id = p_employee_id
        AND brief.organization_id = p_organization_id
    );
  END IF;

  SELECT item.id
    INTO v_chosen
  FROM unnest(v_ids) WITH ORDINALITY AS item(id, ord)
  JOIN public.sub_services sub ON sub.id = item.id
  WHERE sub.organization_id = p_organization_id
    AND sub.service_id = p_service_id
    AND COALESCE(sub.is_active, true)
    AND lower(btrim(sub.name)) <> 'general content'
  ORDER BY (
    SELECT max(plan.created_at)
    FROM public.social_media_plans plan
    WHERE plan.organization_id = p_organization_id
      AND plan.pic_id = p_employee_id
      AND plan.sub_service_id = item.id
  ) NULLS FIRST, item.ord
  LIMIT 1;

  RETURN v_chosen;
END;
$pick$;

REVOKE ALL ON FUNCTION public.ai_employee_pick_brief_sub_service(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_pick_brief_sub_service(uuid, uuid, uuid) TO service_role;

DO $payload$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_payload(uuid)'::regprocedure);
  old_empty text := $old$    'sub_service_id', NULL,
    'sub_services', '[]'::jsonb,$old$;
  new_empty text := $new$    'sub_service_id', NULL,
    'sub_service_ids', '[]'::jsonb,
    'sub_services', '[]'::jsonb,$new$;
  old_saved text := $old$      ) THEN v_row.sub_service_id
      ELSE NULL
    END,
    'sub_services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sub.id,
        'name', left(btrim(sub.name), 80),
        'service_id', sub.service_id
      ) ORDER BY sub.name)$old$;
  new_saved text := $new$      ) THEN v_row.sub_service_id
      ELSE NULL
    END,
    'sub_service_ids', COALESCE((
      SELECT jsonb_agg(item.id ORDER BY item.ord)
      FROM unnest(COALESCE(v_row.sub_service_ids, '{}'::uuid[])) WITH ORDINALITY AS item(id, ord)
      JOIN public.sub_services sub ON sub.id = item.id
      WHERE cardinality(v_row.service_ids) = 1
        AND sub.organization_id = v_org
        AND sub.service_id = v_row.service_ids[1]
        AND COALESCE(sub.is_active, true)
        AND lower(btrim(sub.name)) <> 'general content'
    ), '[]'::jsonb),
    'sub_services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sub.id,
        'name', left(btrim(sub.name), 80),
        'service_id', sub.service_id,
        'has_library_photo', EXISTS (
          SELECT 1 FROM public.sub_service_library_photos(v_org, ARRAY[sub.id])
        )
      ) ORDER BY sub.name)$new$;
BEGIN
  IF position('''sub_service_ids''' IN def) > 0 THEN
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

DO $write$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)'::regprocedure);
  old_declare text := 'v_sub uuid; v_auto boolean; v_has_sub boolean; v_has_auto boolean;';
  new_declare text := 'v_sub uuid; v_subs uuid[]; v_auto boolean; v_has_sub boolean; v_has_auto boolean;';
  old_parse text := $old$v_has_sub := p_brief ? 'sub_service_id';
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
  END IF;$old$;
  new_parse text := $new$v_has_sub := p_brief ? 'sub_service_ids' OR p_brief ? 'sub_service_id';
  v_has_auto := p_brief ? 'content_plan_auto_approve';
  v_subs := '{}'::uuid[];
  v_sub := NULL;
  IF p_brief ? 'sub_service_ids' THEN
    IF jsonb_typeof(p_brief->'sub_service_ids') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_brief->'sub_service_ids') > 8 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_brief->'sub_service_ids') AS elem(value)
      WHERE NULLIF(btrim(elem.value), '') IS NOT NULL
        AND btrim(elem.value) !~ '^[0-9a-fA-F-]{36}$'
    ) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(picked.id ORDER BY picked.ord), '{}'::uuid[])
      INTO v_subs
    FROM (
      SELECT elem.value::uuid AS id, min(elem.ord) AS ord
      FROM jsonb_array_elements_text(p_brief->'sub_service_ids') WITH ORDINALITY AS elem(value, ord)
      WHERE btrim(elem.value) ~ '^[0-9a-fA-F-]{36}$'
      GROUP BY elem.value::uuid
    ) AS picked;
  ELSIF NULLIF(btrim(COALESCE(p_brief->>'sub_service_id', '')), '') IS NOT NULL THEN
    IF (p_brief->>'sub_service_id') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_subs := ARRAY[(p_brief->>'sub_service_id')::uuid];
  END IF;
  v_sub := CASE WHEN cardinality(v_subs) > 0 THEN v_subs[1] ELSE NULL END;
  v_auto := CASE
    WHEN NOT v_has_auto THEN false
    WHEN jsonb_typeof(p_brief->'content_plan_auto_approve') = 'boolean' THEN (p_brief->>'content_plan_auto_approve')::boolean
    ELSE NULL
  END;
  IF v_has_auto AND v_auto IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_subs) > 0 AND (
    cardinality(v_services) <> 1
    OR EXISTS (
      SELECT 1
      FROM unnest(v_subs) AS picked(picked_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.sub_services sub
        WHERE sub.id = picked.picked_id
          AND sub.organization_id = p_organization_id
          AND sub.service_id = v_services[1]
          AND COALESCE(sub.is_active, true)
          AND lower(btrim(sub.name)) <> 'general content'
      )
    )
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;$new$;
  old_insert text := 'split_rule, sub_service_id, content_plan_auto_approve, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, v_sub, COALESCE(v_auto, false), now())';
  new_insert text := 'split_rule, sub_service_id, sub_service_ids, content_plan_auto_approve, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, v_sub, v_subs, COALESCE(v_auto, false), now())';
  old_conflict text := $old$split_rule = EXCLUDED.split_rule,
      sub_service_id = CASE$old$;
  new_conflict text := $new$split_rule = EXCLUDED.split_rule,
      sub_service_ids = CASE
        WHEN v_has_sub THEN EXCLUDED.sub_service_ids
        WHEN cardinality(EXCLUDED.service_ids) = 1 THEN COALESCE((
          SELECT array_agg(kept.id ORDER BY kept.ord)
          FROM (
            SELECT item.id, item.ord
            FROM unnest(ai_employee_briefs.sub_service_ids) WITH ORDINALITY AS item(id, ord)
            JOIN public.sub_services sub ON sub.id = item.id
            WHERE sub.organization_id = EXCLUDED.organization_id
              AND sub.service_id = (EXCLUDED.service_ids)[1]
              AND COALESCE(sub.is_active, true)
              AND lower(btrim(sub.name)) <> 'general content'
          ) AS kept
        ), '{}'::uuid[])
        ELSE '{}'::uuid[]
      END,
      sub_service_id = CASE$new$;
BEGIN
  IF position('v_subs uuid[]' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_declare IN def) = 0
    OR position(old_parse IN def) = 0
    OR position(old_insert IN def) = 0
    OR position(old_conflict IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_write_snippet_missing';
  END IF;
  def := replace(def, old_declare, new_declare);
  def := replace(def, old_parse, new_parse);
  def := replace(def, old_insert, new_insert);
  def := replace(def, old_conflict, new_conflict);
  EXECUTE def;
END;
$write$;

DO $perform$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure);
  old_pick text := '(SELECT brief.sub_service_id FROM public.ai_employee_briefs brief WHERE brief.employee_id = p_employee_id)';
  new_pick text := 'public.ai_employee_pick_brief_sub_service(p_employee_id, v_org, v_service)';
BEGIN
  IF position('ai_employee_pick_brief_sub_service' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_pick IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_perform_snippet_missing';
  END IF;
  def := replace(def, old_pick, new_pick);
  EXECUTE def;
END;
$perform$;

NOTIFY pgrst, 'reload schema';
