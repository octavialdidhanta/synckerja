-- MCP catalog library writes: preview one change, then save that same change once.
-- catalog.style.update   one style box (replace or append)
-- catalog.reference.upsert one reference document
-- catalog.shotlist.upsert  one shot list job
-- Nothing here deletes a row. Reference image paths are server-managed: a write keeps the
-- stored paths of images that are still in the document and never accepts a path from the caller.
-- A save is refused with changed_since_preview when the row changed after the preview.

ALTER TABLE public.mcp_footage_previews
  DROP CONSTRAINT mcp_footage_previews_tool_check;

ALTER TABLE public.mcp_footage_previews
  ADD CONSTRAINT mcp_footage_previews_tool_check CHECK (
    tool IN (
      'footage.scenes.upsert_batch',
      'footage.usage.log',
      'footage.move',
      'footage.ban.add',
      'footage.clips.upsert',
      'footage.delete',
      'footage.restore',
      'catalog.media.delete',
      'catalog.media.restore',
      'catalog.style.update',
      'catalog.reference.upsert',
      'catalog.shotlist.upsert'
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers. Only the public functions below call them.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_catalog_slug(p_value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $slug$
DECLARE
  v_text text;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_text := btrim(p_value #>> '{}');
  IF char_length(v_text) > 80 OR v_text !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN v_text;
END;
$slug$;

-- Remove every stored image path from a caller document. Paths are set only by the upload
-- scripts and by catalog.media.delete / restore.
CREATE OR REPLACE FUNCTION public.mcp_catalog_reference_strip_paths(p_document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $strip$
DECLARE
  v_doc jsonb := p_document - 'sheet_storage_path';
  v_list jsonb;
  v_i integer;
BEGIN
  IF jsonb_typeof(v_doc->'beats') = 'array' THEN
    v_list := v_doc->'beats';
    FOR v_i IN 0..jsonb_array_length(v_list) - 1 LOOP
      IF jsonb_typeof(v_list->v_i) = 'object' THEN
        v_list := jsonb_set(v_list, ARRAY[v_i::text], (v_list->v_i) - 'storage_path', false);
      END IF;
    END LOOP;
    v_doc := jsonb_set(v_doc, '{beats}', v_list, false);
  END IF;
  IF jsonb_typeof(v_doc->'mg') = 'array' THEN
    v_list := v_doc->'mg';
    FOR v_i IN 0..jsonb_array_length(v_list) - 1 LOOP
      IF jsonb_typeof(v_list->v_i) = 'object' THEN
        v_list := jsonb_set(
          v_list,
          ARRAY[v_i::text],
          (v_list->v_i) - 'storage_path' - 'sample_storage_path',
          false
        );
      END IF;
    END LOOP;
    v_doc := jsonb_set(v_doc, '{mg}', v_list, false);
  END IF;
  RETURN v_doc;
END;
$strip$;

-- Copy stored image paths from the saved document onto the new one, matched by laptop path
-- (beat.thumb, mg.thumb, mg.sample, sheet), the same rule as the import script and restore.
-- A hidden image keeps its null path. Returns the document and the paths that are no longer used.
CREATE OR REPLACE FUNCTION public.mcp_catalog_reference_keep_paths(p_fresh jsonb, p_existing jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $keep$
DECLARE
  v_doc jsonb := p_fresh;
  v_list jsonb;
  v_old jsonb;
  v_item jsonb;
  v_prev jsonb;
  v_i integer;
  v_kept text[] := ARRAY[]::text[];
  v_all text[] := ARRAY[]::text[];
  v_path text;
BEGIN
  IF p_existing IS NULL OR jsonb_typeof(p_existing) <> 'object' THEN
    RETURN jsonb_build_object('document', v_doc, 'kept', 0, 'unlinked', '[]'::jsonb);
  END IF;

  -- Every stored path in the saved document.
  IF COALESCE(p_existing->>'sheet_storage_path', '') <> '' THEN
    v_all := v_all || (p_existing->>'sheet_storage_path');
  END IF;
  SELECT v_all || COALESCE(array_agg(p), ARRAY[]::text[])
  INTO v_all
  FROM (
    SELECT b->>'storage_path' AS p
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_existing->'beats') = 'array' THEN p_existing->'beats' ELSE '[]'::jsonb END) b
    WHERE jsonb_typeof(b) = 'object' AND COALESCE(b->>'storage_path', '') <> ''
    UNION ALL
    SELECT m->>'storage_path'
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_existing->'mg') = 'array' THEN p_existing->'mg' ELSE '[]'::jsonb END) m
    WHERE jsonb_typeof(m) = 'object' AND COALESCE(m->>'storage_path', '') <> ''
    UNION ALL
    SELECT m->>'sample_storage_path'
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_existing->'mg') = 'array' THEN p_existing->'mg' ELSE '[]'::jsonb END) m
    WHERE jsonb_typeof(m) = 'object' AND COALESCE(m->>'sample_storage_path', '') <> ''
  ) s;

  IF COALESCE(v_doc->>'sheet', '') <> ''
     AND v_doc->>'sheet' = p_existing->>'sheet'
     AND COALESCE(p_existing->>'sheet_storage_path', '') <> '' THEN
    v_doc := jsonb_set(v_doc, '{sheet_storage_path}', p_existing->'sheet_storage_path', true);
    v_kept := v_kept || (p_existing->>'sheet_storage_path');
  END IF;

  IF jsonb_typeof(v_doc->'beats') = 'array' AND jsonb_typeof(p_existing->'beats') = 'array' THEN
    v_list := v_doc->'beats';
    v_old := p_existing->'beats';
    FOR v_i IN 0..jsonb_array_length(v_list) - 1 LOOP
      v_item := v_list->v_i;
      IF jsonb_typeof(v_item) <> 'object' OR COALESCE(v_item->>'thumb', '') = '' THEN
        CONTINUE;
      END IF;
      SELECT b INTO v_prev
      FROM jsonb_array_elements(v_old) b
      WHERE jsonb_typeof(b) = 'object' AND b->>'thumb' = v_item->>'thumb'
      LIMIT 1;
      v_path := v_prev->>'storage_path';
      IF COALESCE(v_path, '') <> '' THEN
        v_item := jsonb_set(v_item, '{storage_path}', to_jsonb(v_path), true);
        v_list := jsonb_set(v_list, ARRAY[v_i::text], v_item, false);
        v_kept := v_kept || v_path;
      END IF;
    END LOOP;
    v_doc := jsonb_set(v_doc, '{beats}', v_list, false);
  END IF;

  IF jsonb_typeof(v_doc->'mg') = 'array' AND jsonb_typeof(p_existing->'mg') = 'array' THEN
    v_list := v_doc->'mg';
    v_old := p_existing->'mg';
    FOR v_i IN 0..jsonb_array_length(v_list) - 1 LOOP
      v_item := v_list->v_i;
      IF jsonb_typeof(v_item) <> 'object' OR COALESCE(v_item->>'thumb', '') = '' THEN
        CONTINUE;
      END IF;
      SELECT m INTO v_prev
      FROM jsonb_array_elements(v_old) m
      WHERE jsonb_typeof(m) = 'object' AND m->>'thumb' = v_item->>'thumb'
      LIMIT 1;
      v_path := v_prev->>'storage_path';
      IF COALESCE(v_path, '') <> '' THEN
        v_item := jsonb_set(v_item, '{storage_path}', to_jsonb(v_path), true);
        v_kept := v_kept || v_path;
      END IF;
      v_path := v_prev->>'sample_storage_path';
      IF COALESCE(v_path, '') <> ''
         AND COALESCE(v_item->>'sample', '') <> ''
         AND v_item->>'sample' = v_prev->>'sample' THEN
        v_item := jsonb_set(v_item, '{sample_storage_path}', to_jsonb(v_path), true);
        v_kept := v_kept || v_path;
      END IF;
      v_list := jsonb_set(v_list, ARRAY[v_i::text], v_item, false);
    END LOOP;
    v_doc := jsonb_set(v_doc, '{mg}', v_list, false);
  END IF;

  RETURN jsonb_build_object(
    'document', v_doc,
    'kept', cardinality(v_kept),
    'unlinked', COALESCE(
      (SELECT jsonb_agg(p) FROM unnest(v_all) p WHERE NOT (p = ANY (v_kept))),
      '[]'::jsonb
    )
  );
END;
$keep$;

CREATE OR REPLACE FUNCTION public.mcp_catalog_list_len(p_value jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $len$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'array' THEN jsonb_array_length(p_value) ELSE 0 END;
$len$;

-- ---------------------------------------------------------------------------
-- catalog.style.update
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_catalog_normalize_style(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_style$
DECLARE
  v_key text;
  v_body text;
  v_mode text := 'replace';
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) AS k WHERE k NOT IN ('field_key', 'body', 'mode')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'field_key') <> 'string' OR jsonb_typeof(p_input->'body') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_key := lower(btrim(p_input->>'field_key'));
  IF v_key !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_body := btrim(p_input->>'body');
  IF char_length(v_body) = 0 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_exists(p_input, 'mode') THEN
    IF jsonb_typeof(p_input->'mode') <> 'string' OR p_input->>'mode' NOT IN ('replace', 'append') THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_mode := p_input->>'mode';
  END IF;
  RETURN jsonb_build_object('field_key', v_key, 'body', v_body, 'mode', v_mode);
END;
$normalize_style$;

CREATE OR REPLACE FUNCTION public.mcp_catalog_style_after(p_before text, p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $style_after$
DECLARE
  v_after text;
BEGIN
  IF p_payload->>'mode' = 'append' AND p_before IS NOT NULL THEN
    v_after := p_before || E'\n' || (p_payload->>'body');
  ELSE
    v_after := p_payload->>'body';
  END IF;
  IF char_length(v_after) > 4000 THEN
    RAISE EXCEPTION 'too_long' USING ERRCODE = '22023';
  END IF;
  RETURN v_after;
END;
$style_after$;

CREATE OR REPLACE FUNCTION public.mcp_preview_catalog_style_update(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_style$
DECLARE
  v_payload jsonb;
  v_before text;
  v_after text;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_catalog_normalize_style(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT f.body INTO v_before
  FROM public.catalog_style_fields f
  WHERE f.organization_id = p_organization_id
    AND f.field_key = v_payload->>'field_key';

  v_after := public.mcp_catalog_style_after(v_before, v_payload);
  v_payload := v_payload || jsonb_build_object('before_md5', md5(COALESCE(v_before, '')));

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (p_organization_id, p_user_id, 'catalog.style.update', v_payload, now() + interval '15 minutes')
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'field_key', v_payload->>'field_key',
    'mode', v_payload->>'mode',
    'is_new', v_before IS NULL,
    'before', v_before,
    'after', v_after,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_style$;

CREATE OR REPLACE FUNCTION public.mcp_apply_catalog_style_update(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_style$
DECLARE
  v_payload jsonb;
  v_row public.catalog_style_fields%ROWTYPE;
  v_before text;
  v_after text;
  v_position integer;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'catalog.style.update'
  );

  -- Serialize writes for this organization's style boxes.
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog_style:' || p_organization_id::text, 0));

  SELECT * INTO v_row
  FROM public.catalog_style_fields f
  WHERE f.organization_id = p_organization_id
    AND f.field_key = v_payload->>'field_key'
  FOR UPDATE;

  v_before := CASE WHEN FOUND THEN v_row.body ELSE NULL END;
  IF md5(COALESCE(v_before, '')) <> v_payload->>'before_md5' THEN
    RAISE EXCEPTION 'changed_since_preview' USING ERRCODE = 'P0001';
  END IF;
  v_after := public.mcp_catalog_style_after(v_before, v_payload);

  IF v_before IS NULL THEN
    SELECT COALESCE(max(f.position) + 1, 0) INTO v_position
    FROM public.catalog_style_fields f
    WHERE f.organization_id = p_organization_id;
    INSERT INTO public.catalog_style_fields (organization_id, field_key, body, position)
    VALUES (p_organization_id, v_payload->>'field_key', v_after, v_position);
  ELSE
    UPDATE public.catalog_style_fields f
    SET body = v_after
    WHERE f.id = v_row.id
      AND f.organization_id = p_organization_id;
  END IF;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'field_key', v_payload->>'field_key',
    'is_new', v_before IS NULL,
    'before', v_before,
    'after', v_after
  );
END;
$apply_style$;

-- ---------------------------------------------------------------------------
-- catalog.reference.upsert
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_catalog_normalize_reference(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_reference$
DECLARE
  v_id text;
  v_doc jsonb;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) AS k WHERE k NOT IN ('external_id', 'document')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := public.mcp_catalog_slug(p_input->'external_id');
  v_doc := p_input->'document';
  IF v_doc IS NULL OR jsonb_typeof(v_doc) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_exists(v_doc, 'id') AND (jsonb_typeof(v_doc->'id') <> 'string' OR v_doc->>'id' <> v_id) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_doc->'judul') <> 'string' OR btrim(v_doc->>'judul') = '' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF (jsonb_exists(v_doc, 'beats') AND jsonb_typeof(v_doc->'beats') <> 'array')
     OR (jsonb_exists(v_doc, 'mg') AND jsonb_typeof(v_doc->'mg') <> 'array') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_doc->'beats') = 'array' THEN v_doc->'beats' ELSE '[]'::jsonb END) b
    WHERE jsonb_typeof(b) <> 'object'
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_doc->'mg') = 'array' THEN v_doc->'mg' ELSE '[]'::jsonb END) m
    WHERE jsonb_typeof(m) <> 'object'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_doc := public.mcp_catalog_reference_strip_paths(v_doc || jsonb_build_object('id', v_id));
  IF octet_length(v_doc::text) > 190000 THEN
    RAISE EXCEPTION 'too_long' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('external_id', v_id, 'document', v_doc);
END;
$normalize_reference$;

CREATE OR REPLACE FUNCTION public.mcp_preview_catalog_reference_upsert(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_reference$
DECLARE
  v_payload jsonb;
  v_existing jsonb;
  v_merged jsonb;
  v_after jsonb;
  v_id uuid;
  v_expires timestamptz;
  v_changed jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_catalog_normalize_reference(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT r.document INTO v_existing
  FROM public.catalog_references r
  WHERE r.organization_id = p_organization_id
    AND r.external_id = v_payload->>'external_id';

  v_merged := public.mcp_catalog_reference_keep_paths(v_payload->'document', v_existing);
  v_after := v_merged->'document';

  SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb) INTO v_changed
  FROM (
    SELECT k FROM jsonb_object_keys(v_after) k
    WHERE v_existing IS NULL OR (v_after->k) IS DISTINCT FROM (v_existing->k)
    UNION
    SELECT k FROM jsonb_object_keys(COALESCE(v_existing, '{}'::jsonb)) k
    WHERE NOT jsonb_exists(v_after, k)
  ) s;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'catalog.reference.upsert',
    jsonb_build_object(
      'external_id', v_payload->>'external_id',
      'document', v_payload->'document',
      'before_md5', md5(COALESCE(v_existing::text, ''))
    ),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'external_id', v_payload->>'external_id',
    'is_new', v_existing IS NULL,
    'before', CASE WHEN v_existing IS NULL THEN NULL ELSE jsonb_build_object(
      'judul', v_existing->>'judul',
      'beats', public.mcp_catalog_list_len(v_existing->'beats'),
      'mg', public.mcp_catalog_list_len(v_existing->'mg')
    ) END,
    'after', jsonb_build_object(
      'judul', v_after->>'judul',
      'beats', public.mcp_catalog_list_len(v_after->'beats'),
      'mg', public.mcp_catalog_list_len(v_after->'mg')
    ),
    'changed_keys', v_changed,
    'images_kept', (v_merged->>'kept')::integer,
    'images_unlinked', v_merged->'unlinked',
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_reference$;

CREATE OR REPLACE FUNCTION public.mcp_apply_catalog_reference_upsert(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_reference$
DECLARE
  v_payload jsonb;
  v_row public.catalog_references%ROWTYPE;
  v_existing jsonb;
  v_merged jsonb;
  v_after jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'catalog.reference.upsert'
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'catalog_reference:' || p_organization_id::text || ':' || (v_payload->>'external_id'), 0
  ));

  SELECT * INTO v_row
  FROM public.catalog_references r
  WHERE r.organization_id = p_organization_id
    AND r.external_id = v_payload->>'external_id'
  FOR UPDATE;

  v_existing := CASE WHEN FOUND THEN v_row.document ELSE NULL END;
  IF md5(COALESCE(v_existing::text, '')) <> v_payload->>'before_md5' THEN
    RAISE EXCEPTION 'changed_since_preview' USING ERRCODE = 'P0001';
  END IF;

  v_merged := public.mcp_catalog_reference_keep_paths(v_payload->'document', v_existing);
  v_after := v_merged->'document';

  IF v_existing IS NULL THEN
    INSERT INTO public.catalog_references (organization_id, external_id, document)
    VALUES (p_organization_id, v_payload->>'external_id', v_after);
  ELSE
    UPDATE public.catalog_references r
    SET document = v_after
    WHERE r.id = v_row.id
      AND r.organization_id = p_organization_id;
  END IF;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'external_id', v_payload->>'external_id',
    'is_new', v_existing IS NULL,
    'beats', public.mcp_catalog_list_len(v_after->'beats'),
    'mg', public.mcp_catalog_list_len(v_after->'mg'),
    'images_kept', (v_merged->>'kept')::integer,
    'images_unlinked', v_merged->'unlinked'
  );
END;
$apply_reference$;

-- ---------------------------------------------------------------------------
-- catalog.shotlist.upsert
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_catalog_normalize_shot_job(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_job$
DECLARE
  v_id text;
  v_doc jsonb;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) AS k WHERE k NOT IN ('external_id', 'document')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_id := public.mcp_catalog_slug(p_input->'external_id');
  v_doc := p_input->'document';
  IF v_doc IS NULL OR jsonb_typeof(v_doc) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_exists(v_doc, 'job_id')
     AND (jsonb_typeof(v_doc->'job_id') <> 'string' OR v_doc->>'job_id' <> v_id) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_doc->'shots') <> 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  -- Every shot is an object with a non-empty id, and ids are unique inside the job.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_doc->'shots') s
    WHERE jsonb_typeof(s) <> 'object'
       OR jsonb_typeof(s->'id') <> 'string'
       OR btrim(s->>'id') = ''
  ) OR (
    SELECT count(*) <> count(DISTINCT s->>'id') FROM jsonb_array_elements(v_doc->'shots') s
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_doc := v_doc || jsonb_build_object('job_id', v_id);
  IF octet_length(v_doc::text) > 190000 THEN
    RAISE EXCEPTION 'too_long' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('external_id', v_id, 'document', v_doc);
END;
$normalize_job$;

CREATE OR REPLACE FUNCTION public.mcp_catalog_shot_diff(p_before jsonb, p_after jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $shot_diff$
  WITH b AS (
    SELECT s->>'id' AS id, s AS shot
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_before->'shots') = 'array' THEN p_before->'shots' ELSE '[]'::jsonb END) s
  ),
  a AS (
    SELECT s->>'id' AS id, s AS shot
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_after->'shots') = 'array' THEN p_after->'shots' ELSE '[]'::jsonb END) s
  )
  SELECT jsonb_build_object(
    'added', COALESCE((SELECT jsonb_agg(a.id ORDER BY a.id) FROM a WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.id = a.id)), '[]'::jsonb),
    'removed', COALESCE((SELECT jsonb_agg(b.id ORDER BY b.id) FROM b WHERE NOT EXISTS (SELECT 1 FROM a WHERE a.id = b.id)), '[]'::jsonb),
    'changed', COALESCE((SELECT jsonb_agg(a.id ORDER BY a.id) FROM a JOIN b ON b.id = a.id WHERE a.shot IS DISTINCT FROM b.shot), '[]'::jsonb)
  );
$shot_diff$;

CREATE OR REPLACE FUNCTION public.mcp_preview_catalog_shotlist_upsert(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_job$
DECLARE
  v_payload jsonb;
  v_existing jsonb;
  v_after jsonb;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_catalog_normalize_shot_job(p_input);
  v_after := v_payload->'document';

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT j.document INTO v_existing
  FROM public.catalog_shot_jobs j
  WHERE j.organization_id = p_organization_id
    AND j.external_id = v_payload->>'external_id';

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'catalog.shotlist.upsert',
    v_payload || jsonb_build_object('before_md5', md5(COALESCE(v_existing::text, ''))),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'external_id', v_payload->>'external_id',
    'is_new', v_existing IS NULL,
    'before', CASE WHEN v_existing IS NULL THEN NULL ELSE jsonb_build_object(
      'judul', v_existing->>'judul',
      'arsip', CASE WHEN jsonb_typeof(v_existing->'arsip') = 'boolean' THEN (v_existing->'arsip')::boolean ELSE false END,
      'shots', public.mcp_catalog_list_len(v_existing->'shots')
    ) END,
    'after', jsonb_build_object(
      'judul', v_after->>'judul',
      'arsip', CASE WHEN jsonb_typeof(v_after->'arsip') = 'boolean' THEN (v_after->'arsip')::boolean ELSE false END,
      'shots', public.mcp_catalog_list_len(v_after->'shots')
    ),
    'shots_diff', public.mcp_catalog_shot_diff(v_existing, v_after),
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_job$;

CREATE OR REPLACE FUNCTION public.mcp_apply_catalog_shotlist_upsert(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_job$
DECLARE
  v_payload jsonb;
  v_row public.catalog_shot_jobs%ROWTYPE;
  v_existing jsonb;
  v_after jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'catalog.shotlist.upsert'
  );
  v_after := v_payload->'document';

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'catalog_shot_job:' || p_organization_id::text || ':' || (v_payload->>'external_id'), 0
  ));

  SELECT * INTO v_row
  FROM public.catalog_shot_jobs j
  WHERE j.organization_id = p_organization_id
    AND j.external_id = v_payload->>'external_id'
  FOR UPDATE;

  v_existing := CASE WHEN FOUND THEN v_row.document ELSE NULL END;
  IF md5(COALESCE(v_existing::text, '')) <> v_payload->>'before_md5' THEN
    RAISE EXCEPTION 'changed_since_preview' USING ERRCODE = 'P0001';
  END IF;

  IF v_existing IS NULL THEN
    INSERT INTO public.catalog_shot_jobs (organization_id, external_id, document)
    VALUES (p_organization_id, v_payload->>'external_id', v_after);
  ELSE
    UPDATE public.catalog_shot_jobs j
    SET document = v_after
    WHERE j.id = v_row.id
      AND j.organization_id = p_organization_id;
  END IF;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'external_id', v_payload->>'external_id',
    'is_new', v_existing IS NULL,
    'shots', public.mcp_catalog_list_len(v_after->'shots'),
    'shots_diff', public.mcp_catalog_shot_diff(v_existing, v_after)
  );
END;
$apply_job$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.mcp_catalog_slug(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_reference_strip_paths(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_reference_keep_paths(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_list_len(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_normalize_style(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_style_after(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_normalize_reference(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_normalize_shot_job(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_shot_diff(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_catalog_style_update(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_catalog_style_update(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_catalog_style_update(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_catalog_style_update(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_catalog_reference_upsert(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_catalog_reference_upsert(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_catalog_reference_upsert(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_catalog_reference_upsert(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_catalog_shotlist_upsert(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_catalog_shotlist_upsert(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_catalog_shotlist_upsert(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_catalog_shotlist_upsert(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.mcp_preview_catalog_style_update(uuid, uuid, jsonb) IS
  'MCP catalog.style.update.preview. One style box, replace or append. Saves nothing.';
COMMENT ON FUNCTION public.mcp_apply_catalog_style_update(uuid, uuid, uuid) IS
  'MCP catalog.style.update. Applies one preview. Refuses when the box changed after the preview.';
COMMENT ON FUNCTION public.mcp_preview_catalog_reference_upsert(uuid, uuid, jsonb) IS
  'MCP catalog.reference.upsert.preview. One reference document. Stored image paths are kept by laptop path; caller paths are ignored. Saves nothing.';
COMMENT ON FUNCTION public.mcp_apply_catalog_reference_upsert(uuid, uuid, uuid) IS
  'MCP catalog.reference.upsert. Applies one preview. Never deletes a reference or a storage object.';
COMMENT ON FUNCTION public.mcp_preview_catalog_shotlist_upsert(uuid, uuid, jsonb) IS
  'MCP catalog.shotlist.upsert.preview. One shot list job with unique shot ids. Saves nothing.';
COMMENT ON FUNCTION public.mcp_apply_catalog_shotlist_upsert(uuid, uuid, uuid) IS
  'MCP catalog.shotlist.upsert. Applies one preview. Never deletes a job.';
