-- Catalog brand colors and logos are edited from the carousel brief.
-- Organization-wide Digital Assets rows stay service_id null.

ALTER TABLE public.digital_asset_brand_colors
  ADD COLUMN IF NOT EXISTS service_id uuid;

ALTER TABLE public.digital_asset_company_logos
  ADD COLUMN IF NOT EXISTS service_id uuid;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'digital_asset_brand_colors_service_id_fkey'
  ) THEN
    ALTER TABLE public.digital_asset_brand_colors
      ADD CONSTRAINT digital_asset_brand_colors_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES public.services (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'digital_asset_company_logos_service_id_fkey'
  ) THEN
    ALTER TABLE public.digital_asset_company_logos
      ADD CONSTRAINT digital_asset_company_logos_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES public.services (id) ON DELETE CASCADE;
  END IF;
END;
$fk$;

CREATE INDEX IF NOT EXISTS digital_asset_brand_colors_service_idx
  ON public.digital_asset_brand_colors (organization_id, service_id)
  WHERE service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS digital_asset_company_logos_service_idx
  ON public.digital_asset_company_logos (organization_id, service_id)
  WHERE service_id IS NOT NULL;

ALTER TABLE public.ai_employee_briefs
  ADD COLUMN IF NOT EXISTS brand_color_id uuid,
  ADD COLUMN IF NOT EXISTS company_logo_id uuid;

DO $brief_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_employee_briefs_brand_color_id_fkey'
  ) THEN
    ALTER TABLE public.ai_employee_briefs
      ADD CONSTRAINT ai_employee_briefs_brand_color_id_fkey
      FOREIGN KEY (brand_color_id) REFERENCES public.digital_asset_brand_colors (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_employee_briefs_company_logo_id_fkey'
  ) THEN
    ALTER TABLE public.ai_employee_briefs
      ADD CONSTRAINT ai_employee_briefs_company_logo_id_fkey
      FOREIGN KEY (company_logo_id) REFERENCES public.digital_asset_company_logos (id) ON DELETE SET NULL;
  END IF;
END;
$brief_fk$;

ALTER TABLE public.canva_carousel_runs
  ADD COLUMN IF NOT EXISTS logo_placed boolean;

UPDATE public.canva_carousel_runs
SET logo_placed = (status = 'succeeded')
WHERE logo_placed IS NULL;

ALTER TABLE public.canva_carousel_runs
  ALTER COLUMN logo_placed SET DEFAULT false;

ALTER TABLE public.canva_carousel_runs
  ALTER COLUMN logo_placed SET NOT NULL;

CREATE OR REPLACE FUNCTION public.ai_employee_carousel_fields(
  p_organization_id uuid,
  p_payload jsonb
)
RETURNS TABLE (
  brief text,
  caption text,
  content_type_id uuid,
  concept text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_index integer;
  v_slide jsonb;
  v_timing text;
  v_visual text;
  v_vo text;
  v_element text;
  v_tagging text;
  v_lines text[] := ARRAY[
    '| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  v_caption text;
  v_reason text;
  v_type uuid;
  v_brief text;
  v_primary text;
  v_secondary text;
  v_accent text;
  v_color text := '';
BEGIN
  IF jsonb_typeof(p_payload->'slides') <> 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(p_payload->'slides');
  IF v_count < 2 OR v_count > 10 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_caption := NULLIF(btrim(COALESCE(p_payload->>'caption', '')), '');
  IF v_caption IS NULL OR char_length(v_caption) > 400 OR position('#' IN v_caption) = 0 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_reason := NULLIF(regexp_replace(btrim(COALESCE(p_payload->>'concept', '')), '\s+', ' ', 'g'), '');
  IF v_reason IS NULL OR char_length(v_reason) < 40 OR char_length(v_reason) > 800 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR v_index IN 0 .. v_count - 1 LOOP
    v_slide := p_payload->'slides'->v_index;
    v_timing := regexp_replace(btrim(COALESCE(v_slide->>'timing', '')), '\s+', ' ', 'g');
    v_visual := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'visual', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    v_vo := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'vo', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    v_element := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'element', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    v_tagging := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'tagging', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    IF v_timing IS DISTINCT FROM ('Slide ' || (v_index + 1)::text) OR v_visual = '' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_lines := v_lines || format(
      '| %s |  | %s | %s | %s | %s |',
      v_timing, v_visual, v_vo, v_element, v_tagging
    );
  END LOOP;

  v_primary := lower(btrim(COALESCE(p_payload #>> '{palette,primary}', '')));
  v_secondary := lower(btrim(COALESCE(p_payload #>> '{palette,secondary}', '')));
  v_accent := lower(btrim(COALESCE(p_payload #>> '{palette,accent}', '')));
  IF v_primary ~ '^#[0-9a-f]{6}$'
    AND v_secondary ~ '^#[0-9a-f]{6}$'
    AND v_accent ~ '^#[0-9a-f]{6}$'
  THEN
    v_color := format(
      E'\n\nWarna: primer %s, sekunder %s, aksen %s',
      v_primary, v_secondary, v_accent
    );
  END IF;

  v_brief := array_to_string(v_lines, E'\n') || v_color || E'\n\n'
    || format(
      '<!--synckerja-brief-sequences:%s-->',
      jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(),
        'name', 'Carousel',
        'rowCount', v_count
      ))::text
    );

  SELECT ct.id
  INTO v_type
  FROM public.content_types ct
  WHERE COALESCE(ct.is_active, true)
    AND (ct.organization_id = p_organization_id OR ct.organization_id IS NULL)
    AND lower(btrim(ct.name)) = 'carousel'
  ORDER BY (ct.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, ct.id
  LIMIT 1;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'carousel_type_missing' USING ERRCODE = 'P0002';
  END IF;

  brief := v_brief;
  caption := v_caption;
  content_type_id := v_type;
  concept := jsonb_build_object(
    'v', 1,
    'postAspect', '4:5',
    'reason', v_reason,
    'locations', '[]'::jsonb,
    'characters', '[]'::jsonb,
    'properties', '[]'::jsonb
  )::text;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_carousel_fields(uuid, jsonb) IS
  'Menyusun brief carousel tanpa kolom voice over. Bila payload punya palet katalog, satu baris Warna ditambahkan di luar tabel.';

DO $write$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)'::regprocedure),
    E'\r',
    ''
  );
  marker text := 'split_rule = EXCLUDED.split_rule, updated_at = now();';
  patched text := $sql$split_rule = EXCLUDED.split_rule,
      brand_color_id = CASE
        WHEN cardinality(EXCLUDED.service_ids) = 1 AND EXISTS (
          SELECT 1 FROM public.digital_asset_brand_colors color
          WHERE color.id = ai_employee_briefs.brand_color_id
            AND color.organization_id = EXCLUDED.organization_id
            AND color.service_id = (EXCLUDED.service_ids)[1]
        ) THEN ai_employee_briefs.brand_color_id
        ELSE NULL
      END,
      company_logo_id = CASE
        WHEN cardinality(EXCLUDED.service_ids) = 1 AND EXISTS (
          SELECT 1 FROM public.digital_asset_company_logos logo
          WHERE logo.id = ai_employee_briefs.company_logo_id
            AND logo.organization_id = EXCLUDED.organization_id
            AND logo.service_id = (EXCLUDED.service_ids)[1]
        ) THEN ai_employee_briefs.company_logo_id
        ELSE NULL
      END,
      updated_at = now();$sql$;
BEGIN
  IF position('brand_color_id = CASE' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(marker IN def) = 0 THEN
    RAISE EXCEPTION 'brief write catalog asset snippet missing';
  END IF;
  IF (length(def) - length(replace(def, marker, ''))) / length(marker) <> 1 THEN
    RAISE EXCEPTION 'brief write catalog asset snippet missing';
  END IF;
  EXECUTE replace(def, marker, patched);
END;
$write$;

DO $payload$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_brief_payload(uuid)'::regprocedure),
    E'\r',
    ''
  );
  empty_marker text := $old$    ), '[]'::jsonb)
    );
  END IF;$old$;
  found_marker text := $old$    ), '[]'::jsonb)
  );
END;$old$;
  empty_keys text := $new$    ), '[]'::jsonb),
    'brand_color_id', NULL,
    'company_logo_id', NULL,
    'brand_colors', '[]'::jsonb,
    'company_logos', '[]'::jsonb,
    'palette', NULL
    );
  END IF;$new$;
  found_keys text := $new$    ), '[]'::jsonb),
    'brand_color_id', CASE
      WHEN cardinality(v_row.service_ids) = 1 AND EXISTS (
        SELECT 1 FROM public.digital_asset_brand_colors color
        WHERE color.id = v_row.brand_color_id
          AND color.organization_id = v_org
          AND color.service_id = v_row.service_ids[1]
      ) THEN v_row.brand_color_id
      ELSE NULL
    END,
    'company_logo_id', CASE
      WHEN cardinality(v_row.service_ids) = 1 AND EXISTS (
        SELECT 1 FROM public.digital_asset_company_logos logo
        WHERE logo.id = v_row.company_logo_id
          AND logo.organization_id = v_org
          AND logo.service_id = v_row.service_ids[1]
      ) THEN v_row.company_logo_id
      ELSE NULL
    END,
    'brand_colors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', color.id,
        'brand_name', left(btrim(COALESCE(color.brand_name, '')), 80),
        'primary_color_hex', color.primary_color_hex,
        'secondary_color_hex', color.secondary_color_hex,
        'accent_color_hex', color.accent_color_hex
      ) ORDER BY color.updated_at DESC)
      FROM public.digital_asset_brand_colors color
      WHERE cardinality(v_row.service_ids) = 1
        AND color.organization_id = v_org
        AND color.service_id = v_row.service_ids[1]
    ), '[]'::jsonb),
    'company_logos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', logo.id,
        'brand_name', left(btrim(COALESCE(logo.brand_name, '')), 80),
        'logo_path', logo.logo_path
      ) ORDER BY logo.updated_at DESC)
      FROM public.digital_asset_company_logos logo
      WHERE cardinality(v_row.service_ids) = 1
        AND logo.organization_id = v_org
        AND logo.service_id = v_row.service_ids[1]
    ), '[]'::jsonb),
    'palette', (
      SELECT jsonb_build_object(
        'primary', lower(color.primary_color_hex),
        'secondary', lower(color.secondary_color_hex),
        'accent', lower(color.accent_color_hex)
      )
      FROM public.digital_asset_brand_colors color
      WHERE color.id = v_row.brand_color_id
        AND cardinality(v_row.service_ids) = 1
        AND color.organization_id = v_org
        AND color.service_id = v_row.service_ids[1]
        AND color.primary_color_hex ~ '^#[0-9A-Fa-f]{6}$'
        AND color.secondary_color_hex ~ '^#[0-9A-Fa-f]{6}$'
        AND color.accent_color_hex ~ '^#[0-9A-Fa-f]{6}$'
    )
  );
END;$new$;
BEGIN
  IF position('''palette''' IN def) > 0 THEN
    RETURN;
  END IF;
  IF (length(def) - length(replace(def, empty_marker, ''))) / length(empty_marker) <> 1 THEN
    RAISE EXCEPTION 'brief payload empty asset snippet missing';
  END IF;
  IF (length(def) - length(replace(def, found_marker, ''))) / length(found_marker) <> 1 THEN
    RAISE EXCEPTION 'brief payload found asset snippet missing';
  END IF;
  def := replace(def, empty_marker, empty_keys);
  def := replace(def, found_marker, found_keys);
  EXECUTE def;
END;
$payload$;

CREATE OR REPLACE FUNCTION public.ai_employee_saved_catalog(p_employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_services uuid[];
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  SELECT brief.service_ids
  INTO v_services
  FROM public.ai_employee_briefs brief
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;
  IF v_services IS NULL OR cardinality(v_services) <> 1 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.services svc
    WHERE svc.id = v_services[1]
      AND svc.organization_id = v_org
      AND COALESCE(svc.is_active, true)
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN v_services[1];
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_saved_catalog(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_color_save(
  p_employee_id uuid,
  p_color_id uuid,
  p_brand_name text,
  p_primary text,
  p_secondary text,
  p_accent text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
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
  v_service := public.ai_employee_saved_catalog(p_employee_id);
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
  UPDATE public.ai_employee_briefs brief
  SET brand_color_id = v_id,
      updated_at = now()
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_color_select(
  p_employee_id uuid,
  p_color_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_saved_catalog(p_employee_id);
  IF p_color_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.digital_asset_brand_colors color
    WHERE color.id = p_color_id
      AND color.organization_id = v_org
      AND color.service_id = v_service
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ai_employee_briefs brief
  SET brand_color_id = p_color_id,
      updated_at = now()
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_color_delete(
  p_employee_id uuid,
  p_color_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_saved_catalog(p_employee_id);
  IF p_color_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.digital_asset_brand_colors color
  WHERE color.id = p_color_id
    AND color.organization_id = v_org
    AND color.service_id = v_service;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_logo_save(
  p_employee_id uuid,
  p_logo_id uuid,
  p_brand_name text,
  p_storage_path text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
  v_id uuid;
  v_name text;
  v_path text := NULLIF(btrim(COALESCE(p_storage_path, '')), '');
  v_old text;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_saved_catalog(p_employee_id);
  v_name := NULLIF(left(btrim(COALESCE(p_brand_name, '')), 80), '');
  IF v_path IS NOT NULL AND v_path !~ (
    '^' || v_org::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_path IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM storage.objects object
    WHERE object.bucket_id = 'digital-asset-company-logos'
      AND object.name = v_path
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_logo_id IS NULL THEN
    IF v_path IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.digital_asset_company_logos (
      organization_id, service_id, brand_name, logo_path
    ) VALUES (
      v_org, v_service, v_name, v_path
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT logo.logo_path
    INTO v_old
    FROM public.digital_asset_company_logos logo
    WHERE logo.id = p_logo_id
      AND logo.organization_id = v_org
      AND logo.service_id = v_service;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    UPDATE public.digital_asset_company_logos logo
    SET brand_name = v_name,
        logo_path = COALESCE(v_path, logo.logo_path),
        updated_at = now()
    WHERE logo.id = p_logo_id
    RETURNING logo.id INTO v_id;
    IF v_path IS NOT NULL AND v_old IS NOT NULL AND v_old IS DISTINCT FROM v_path THEN
      DELETE FROM storage.objects object
      WHERE object.bucket_id = 'digital-asset-company-logos'
        AND object.name = v_old;
    END IF;
  END IF;

  UPDATE public.ai_employee_briefs brief
  SET company_logo_id = v_id,
      updated_at = now()
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_logo_select(
  p_employee_id uuid,
  p_logo_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_saved_catalog(p_employee_id);
  IF p_logo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.digital_asset_company_logos logo
    WHERE logo.id = p_logo_id
      AND logo.organization_id = v_org
      AND logo.service_id = v_service
      AND NULLIF(btrim(COALESCE(logo.logo_path, '')), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ai_employee_briefs brief
  SET company_logo_id = p_logo_id,
      updated_at = now()
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_catalog_logo_delete(
  p_employee_id uuid,
  p_logo_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_service uuid;
  v_path text;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  v_service := public.ai_employee_saved_catalog(p_employee_id);
  IF p_logo_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.digital_asset_company_logos logo
  WHERE logo.id = p_logo_id
    AND logo.organization_id = v_org
    AND logo.service_id = v_service
  RETURNING logo.logo_path INTO v_path;
  IF v_path IS NOT NULL THEN
    DELETE FROM storage.objects object
    WHERE object.bucket_id = 'digital-asset-company-logos'
      AND object.name = v_path;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_catalog_color_save(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_catalog_color_select(uuid, uuid) FROM PUBLIC, anon, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_catalog_color_delete(uuid, uuid) FROM PUBLIC, anon, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text) FROM PUBLIC, anon, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_catalog_logo_select(uuid, uuid) FROM PUBLIC, anon, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_catalog_logo_delete(uuid, uuid) FROM PUBLIC, anon, service_role, ai_employee_runner;

GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_color_save(uuid, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_color_select(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_color_delete(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_logo_select(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_catalog_logo_delete(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.ai_employee_catalog_color_save(uuid, uuid, text, text, text, text) IS
  'Owner menyimpan warna katalog yang sudah tersimpan dan menjadikannya pilihan aktif. Warna teks tidak ditulis.';
COMMENT ON FUNCTION public.ai_employee_catalog_logo_save(uuid, uuid, text, text) IS
  'Owner menyimpan logo katalog yang sudah tersimpan dan menjadikannya pilihan aktif.';

DO $enqueue$
DECLARE
  def text := replace(
    pg_get_functiondef('public.canva_carousel_enqueue()'::regprocedure),
    E'\r',
    ''
  );
  marker text := $old$      updated_at = now()
  WHERE public.canva_carousel_runs.status IS DISTINCT FROM 'succeeded'$old$;
  patched text := $new$      logo_placed = false,
      updated_at = now()
  WHERE public.canva_carousel_runs.status IS DISTINCT FROM 'succeeded'$new$;
BEGIN
  IF position('logo_placed = false' IN def) > 0 THEN
    RETURN;
  END IF;
  IF (length(def) - length(replace(def, marker, ''))) / length(marker) <> 1 THEN
    RAISE EXCEPTION 'canva enqueue logo snippet missing';
  END IF;
  EXECUTE replace(def, marker, patched);
END;
$enqueue$;

NOTIFY pgrst, 'reload schema';
