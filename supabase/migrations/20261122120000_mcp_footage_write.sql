-- MCP footage writes: preview a change, then save that same change once.
-- The preview row holds the payload. The confirm token only carries its id.
-- These functions do not move, copy, or delete the laptop file.

CREATE TABLE public.mcp_footage_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tool text NOT NULL,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_footage_previews_tool_check CHECK (
    tool IN (
      'footage.scenes.upsert_batch',
      'footage.usage.log',
      'footage.move',
      'footage.ban.add'
    )
  ),
  CONSTRAINT mcp_footage_previews_payload_check CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.mcp_footage_previews IS
  'Unsaved footage write shown to the user. Expires in 15 minutes. Not the catalog.';

CREATE INDEX mcp_footage_previews_org_expires_idx
  ON public.mcp_footage_previews (organization_id, expires_at);

ALTER TABLE public.mcp_footage_previews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_footage_previews FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mcp_footage_previews TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers. The public functions run as the owner and are the only callers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_footage_clean_key(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $clean_key$
DECLARE
  v_text text := NULLIF(btrim(COALESCE(p_value, '')), '');
BEGIN
  IF v_text IS NULL OR char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN v_text;
END;
$clean_key$;

CREATE OR REPLACE FUNCTION public.mcp_footage_scene_tag(
  p_organization_id uuid,
  p_scene_id uuid,
  p_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $scene_tag$
  SELECT COALESCE((
    SELECT v.value_bool
    FROM public.footage_tag_values v
    JOIN public.footage_tag_defs d
      ON d.id = v.tag_def_id
     AND d.organization_id = v.organization_id
    WHERE v.organization_id = p_organization_id
      AND v.scene_id = p_scene_id
      AND d.key = p_key
    LIMIT 1
  ), false);
$scene_tag$;

CREATE OR REPLACE FUNCTION public.mcp_footage_set_scene_tag(
  p_organization_id uuid,
  p_scene_id uuid,
  p_key text,
  p_value boolean
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $set_tag$
DECLARE
  v_def uuid;
BEGIN
  SELECT d.id
  INTO v_def
  FROM public.footage_tag_defs d
  WHERE d.organization_id = p_organization_id
    AND d.key = p_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  UPDATE public.footage_tag_values v
  SET value_bool = p_value,
      updated_at = now()
  WHERE v.organization_id = p_organization_id
    AND v.tag_def_id = v_def
    AND v.scene_id = p_scene_id;

  IF NOT FOUND THEN
    INSERT INTO public.footage_tag_values (organization_id, tag_def_id, scene_id, value_bool)
    VALUES (p_organization_id, v_def, p_scene_id, p_value);
  END IF;
END;
$set_tag$;

CREATE OR REPLACE FUNCTION public.mcp_footage_normalize_scene_batch(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize$
DECLARE
  v_key text;
  v_item jsonb;
  v_clean jsonb;
  v_scenes jsonb := '[]'::jsonb;
  v_seen integer[] := ARRAY[]::integer[];
  v_index numeric;
  v_index_int integer;
  v_text text;
  v_i integer;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_input) AS k
    WHERE k NOT IN ('file_key', 'scenes')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_input->'file_key') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_key := public.mcp_footage_clean_key(p_input->>'file_key');

  IF jsonb_typeof(p_input->'scenes') <> 'array'
     OR jsonb_array_length(p_input->'scenes') < 1
     OR jsonb_array_length(p_input->'scenes') > 50 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(p_input->'scenes') - 1 LOOP
    v_item := p_input->'scenes'->v_i;
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_object_keys(v_item) AS k
      WHERE k NOT IN ('scene_index', 'scene_kind', 'summary', 'note', 'hijab', 'watermark', 'meja_biru', 'lengkuas')
    ) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_item->'scene_index') <> 'number' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_index := (v_item->>'scene_index')::numeric;
    IF v_index <> trunc(v_index) OR v_index < 1 OR v_index > 100000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_index_int := v_index::integer;
    IF v_index_int = ANY (v_seen) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_seen := v_seen || v_index_int;
    v_clean := jsonb_build_object('scene_index', v_index_int);

    IF jsonb_exists(v_item, 'scene_kind') THEN
      IF jsonb_typeof(v_item->'scene_kind') <> 'string' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_text := btrim(v_item->>'scene_kind');
      IF char_length(v_text) < 1 OR char_length(v_text) > 80 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('scene_kind', v_text);
    END IF;

    IF jsonb_exists(v_item, 'summary') THEN
      IF jsonb_typeof(v_item->'summary') <> 'string' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_text := btrim(v_item->>'summary');
      IF char_length(v_text) > 4000 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('summary', v_text);
    END IF;

    IF jsonb_exists(v_item, 'note') THEN
      IF jsonb_typeof(v_item->'note') <> 'string' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_text := btrim(v_item->>'note');
      IF char_length(v_text) > 4000 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('note', v_text);
    END IF;

    IF jsonb_exists(v_item, 'hijab') THEN
      IF jsonb_typeof(v_item->'hijab') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('hijab', (v_item->>'hijab')::boolean);
    END IF;
    IF jsonb_exists(v_item, 'watermark') THEN
      IF jsonb_typeof(v_item->'watermark') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('watermark', (v_item->>'watermark')::boolean);
    END IF;
    IF jsonb_exists(v_item, 'meja_biru') THEN
      IF jsonb_typeof(v_item->'meja_biru') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('meja_biru', (v_item->>'meja_biru')::boolean);
    END IF;
    IF jsonb_exists(v_item, 'lengkuas') THEN
      IF jsonb_typeof(v_item->'lengkuas') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('lengkuas', (v_item->>'lengkuas')::boolean);
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(v_clean)) < 2 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_scenes := v_scenes || jsonb_build_array(v_clean);
  END LOOP;

  RETURN jsonb_build_object('file_key', v_key, 'scenes', v_scenes);
END;
$normalize$;

CREATE OR REPLACE FUNCTION public.mcp_footage_take_preview(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid,
  p_tool text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $take$
DECLARE
  v_row public.mcp_footage_previews%ROWTYPE;
BEGIN
  IF p_preview_id IS NULL OR p_tool IS NULL THEN
    RAISE EXCEPTION 'confirmation_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_row
  FROM public.mcp_footage_previews
  WHERE id = p_preview_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.mcp_tool_confirmations c WHERE c.id = p_preview_id
    ) THEN
      RAISE EXCEPTION 'confirmation_used' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'confirmation_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_row.user_id <> p_user_id
     OR v_row.organization_id <> p_organization_id
     OR v_row.tool <> p_tool THEN
    RAISE EXCEPTION 'confirmation_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_row.expires_at <= now() THEN
    RAISE EXCEPTION 'confirmation_expired' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
    VALUES (v_row.id, v_row.organization_id, v_row.user_id, v_row.tool);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'confirmation_used' USING ERRCODE = 'P0001';
  END;

  RETURN v_row.payload;
END;
$take$;

-- ---------------------------------------------------------------------------
-- Scene batch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_scene_batch(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_scenes$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_scene public.footage_scenes%ROWTYPE;
  v_item jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_before jsonb;
  v_after jsonb;
  v_i integer;
  v_id uuid;
  v_expires timestamptz;
  v_storage_key text;
  v_input_key text;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_normalize_scene_batch(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(v_payload->'scenes') - 1 LOOP
    v_item := v_payload->'scenes'->v_i;
    SELECT *
    INTO v_scene
    FROM public.footage_scenes s
    WHERE s.organization_id = p_organization_id
      AND s.asset_id = v_asset.id
      AND s.scene_index = (v_item->>'scene_index')::integer;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    v_before := '{}'::jsonb;
    v_after := '{}'::jsonb;

    IF jsonb_exists(v_item, 'scene_kind') THEN
      v_before := v_before || jsonb_build_object('scene_kind', v_scene.scene_kind);
      v_after := v_after || jsonb_build_object('scene_kind', v_item->>'scene_kind');
    END IF;
    IF jsonb_exists(v_item, 'summary') THEN
      v_before := v_before || jsonb_build_object('summary', v_scene.summary);
      v_after := v_after || jsonb_build_object('summary', NULLIF(v_item->>'summary', ''));
    END IF;
    IF jsonb_exists(v_item, 'note') THEN
      v_before := v_before || jsonb_build_object('note', v_scene.note);
      v_after := v_after || jsonb_build_object('note', NULLIF(v_item->>'note', ''));
    END IF;

    FOREACH v_input_key IN ARRAY ARRAY['hijab', 'watermark', 'meja_biru', 'lengkuas'] LOOP
      IF jsonb_exists(v_item, v_input_key) THEN
        v_storage_key := CASE v_input_key
          WHEN 'watermark' THEN 'watermark_ui'
          ELSE v_input_key
        END;
        IF NOT EXISTS (
          SELECT 1
          FROM public.footage_tag_defs d
          WHERE d.organization_id = p_organization_id
            AND d.key = v_storage_key
        ) THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
        v_before := v_before || jsonb_build_object(
          v_input_key,
          public.mcp_footage_scene_tag(p_organization_id, v_scene.id, v_storage_key)
        );
        v_after := v_after || jsonb_build_object(v_input_key, (v_item->>v_input_key)::boolean);
      END IF;
    END LOOP;

    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'scene_index', (v_item->>'scene_index')::integer,
      'before', v_before,
      'after', v_after
    ));
  END LOOP;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.scenes.upsert_batch',
    v_payload,
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_payload->>'file_key',
    'changes', v_changes,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_scenes$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_scene_batch(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_scenes$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_scene public.footage_scenes%ROWTYPE;
  v_item jsonb;
  v_i integer;
  v_input_key text;
  v_storage_key text;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id,
    p_organization_id,
    p_preview_id,
    'footage.scenes.upsert_batch'
  );

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(v_payload->'scenes') - 1 LOOP
    v_item := v_payload->'scenes'->v_i;
    SELECT *
    INTO v_scene
    FROM public.footage_scenes s
    WHERE s.organization_id = p_organization_id
      AND s.asset_id = v_asset.id
      AND s.scene_index = (v_item->>'scene_index')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.footage_scenes s
    SET
      scene_kind = CASE WHEN jsonb_exists(v_item, 'scene_kind') THEN v_item->>'scene_kind' ELSE s.scene_kind END,
      summary = CASE WHEN jsonb_exists(v_item, 'summary') THEN NULLIF(v_item->>'summary', '') ELSE s.summary END,
      note = CASE WHEN jsonb_exists(v_item, 'note') THEN NULLIF(v_item->>'note', '') ELSE s.note END
    WHERE s.id = v_scene.id
      AND s.organization_id = p_organization_id;

    FOREACH v_input_key IN ARRAY ARRAY['hijab', 'watermark', 'meja_biru', 'lengkuas'] LOOP
      IF jsonb_exists(v_item, v_input_key) THEN
        v_storage_key := CASE v_input_key
          WHEN 'watermark' THEN 'watermark_ui'
          ELSE v_input_key
        END;
        PERFORM public.mcp_footage_set_scene_tag(
          p_organization_id,
          v_scene.id,
          v_storage_key,
          (v_item->>v_input_key)::boolean
        );
      END IF;
    END LOOP;
  END LOOP;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_asset.file_key,
    'scene_count', jsonb_array_length(v_payload->'scenes')
  );
END;
$apply_scenes$;

-- ---------------------------------------------------------------------------
-- Usage
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_footage_normalize_usage(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_usage$
DECLARE
  v_key text;
  v_ref text;
  v_in numeric;
  v_out numeric;
  v_title text;
  v_payload jsonb;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_input) AS k
    WHERE k NOT IN ('file_key', 'external_ref', 'in_seconds', 'out_seconds', 'title')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'file_key') <> 'string'
     OR jsonb_typeof(p_input->'external_ref') <> 'string'
     OR jsonb_typeof(p_input->'in_seconds') <> 'number'
     OR jsonb_typeof(p_input->'out_seconds') <> 'number' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_key := public.mcp_footage_clean_key(p_input->>'file_key');
  v_ref := NULLIF(btrim(p_input->>'external_ref'), '');
  IF v_ref IS NULL OR char_length(v_ref) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_in := (p_input->>'in_seconds')::numeric;
  v_out := (p_input->>'out_seconds')::numeric;
  IF v_in < 0 OR v_out < 0 OR v_out < v_in OR v_in > 1000000 OR v_out > 1000000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_payload := jsonb_build_object(
    'file_key', v_key,
    'external_ref', v_ref,
    'in_seconds', v_in,
    'out_seconds', v_out
  );

  IF jsonb_exists(p_input, 'title') THEN
    IF jsonb_typeof(p_input->'title') <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_title := btrim(p_input->>'title');
    IF char_length(v_title) > 500 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('title', NULLIF(v_title, ''));
  END IF;

  RETURN v_payload;
END;
$normalize_usage$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_usage(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_usage$
DECLARE
  v_payload jsonb;
  v_asset_id uuid;
  v_existing_title text;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_normalize_usage(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT a.id
  INTO v_asset_id
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT u.title
  INTO v_existing_title
  FROM public.footage_usages u
  WHERE u.organization_id = p_organization_id
    AND u.asset_id = v_asset_id
    AND u.external_ref = v_payload->>'external_ref'
    AND u.in_seconds = (v_payload->>'in_seconds')::numeric
    AND u.out_seconds = (v_payload->>'out_seconds')::numeric;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'file_key', v_payload->>'file_key',
      'external_ref', v_payload->>'external_ref',
      'in_seconds', (v_payload->>'in_seconds')::numeric,
      'out_seconds', (v_payload->>'out_seconds')::numeric,
      'title', v_existing_title,
      'already_logged', true,
      'can_save', false
    );
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.usage.log',
    v_payload,
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_payload->>'file_key',
    'external_ref', v_payload->>'external_ref',
    'in_seconds', (v_payload->>'in_seconds')::numeric,
    'out_seconds', (v_payload->>'out_seconds')::numeric,
    'title', CASE
      WHEN jsonb_exists(v_payload, 'title') THEN NULLIF(v_payload->>'title', '')
      ELSE NULL
    END,
    'already_logged', false,
    'can_save', true,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_usage$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_usage(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_usage$
DECLARE
  v_payload jsonb;
  v_asset_id uuid;
  v_logged boolean := false;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id,
    p_organization_id,
    p_preview_id,
    'footage.usage.log'
  );

  SELECT a.id
  INTO v_asset_id
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    INSERT INTO public.footage_usages (
      organization_id,
      asset_id,
      external_ref,
      in_seconds,
      out_seconds,
      title
    )
    VALUES (
      p_organization_id,
      v_asset_id,
      v_payload->>'external_ref',
      (v_payload->>'in_seconds')::numeric,
      (v_payload->>'out_seconds')::numeric,
      CASE WHEN jsonb_exists(v_payload, 'title') THEN NULLIF(v_payload->>'title', '') ELSE NULL END
    );
  EXCEPTION
    WHEN unique_violation THEN
      v_logged := true;
  END;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  IF v_logged THEN
    RETURN jsonb_build_object(
      'saved', false,
      'already_logged', true,
      'file_key', v_payload->>'file_key',
      'external_ref', v_payload->>'external_ref'
    );
  END IF;

  RETURN jsonb_build_object(
    'saved', true,
    'already_logged', false,
    'file_key', v_payload->>'file_key',
    'external_ref', v_payload->>'external_ref',
    'in_seconds', (v_payload->>'in_seconds')::numeric,
    'out_seconds', (v_payload->>'out_seconds')::numeric
  );
END;
$apply_usage$;

-- ---------------------------------------------------------------------------
-- Move address only. The laptop file stays where the operator puts it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_footage_normalize_move(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_move$
DECLARE
  v_key text;
  v_new text;
  v_text text;
  v_payload jsonb;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_input) AS k
    WHERE k NOT IN ('file_key', 'new_file_key', 'location', 'product')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'file_key') <> 'string'
     OR jsonb_typeof(p_input->'new_file_key') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_key := public.mcp_footage_clean_key(p_input->>'file_key');
  v_new := public.mcp_footage_clean_key(p_input->>'new_file_key');
  v_payload := jsonb_build_object('file_key', v_key, 'new_file_key', v_new);

  IF jsonb_exists(p_input, 'location') THEN
    IF jsonb_typeof(p_input->'location') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_text := btrim(COALESCE(p_input->>'location', ''));
    IF char_length(v_text) > 500 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('location', NULLIF(v_text, ''));
  END IF;

  IF jsonb_exists(p_input, 'product') THEN
    IF jsonb_typeof(p_input->'product') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_text := btrim(COALESCE(p_input->>'product', ''));
    IF char_length(v_text) > 500 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('product', NULLIF(v_text, ''));
  END IF;

  RETURN v_payload;
END;
$normalize_move$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_move(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_move$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_after_location text;
  v_after_product text;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_normalize_move(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.footage_assets other
    WHERE other.organization_id = p_organization_id
      AND other.file_key = v_payload->>'new_file_key'
      AND other.id <> v_asset.id
  ) THEN
    RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END IF;

  v_after_location := CASE
    WHEN jsonb_exists(v_payload, 'location') THEN NULLIF(v_payload->>'location', '')
    ELSE v_asset.location_label
  END;
  v_after_product := CASE
    WHEN jsonb_exists(v_payload, 'product') THEN NULLIF(v_payload->>'product', '')
    ELSE v_asset.product_label
  END;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.move',
    v_payload,
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_asset.file_key,
    'new_file_key', v_payload->>'new_file_key',
    'before', jsonb_build_object(
      'file_key', v_asset.file_key,
      'location_label', v_asset.location_label,
      'product_label', v_asset.product_label,
      'storage_status', v_asset.storage_status
    ),
    'after', jsonb_build_object(
      'file_key', v_payload->>'new_file_key',
      'location_label', v_after_location,
      'product_label', v_after_product,
      'storage_status', 'bank'
    ),
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_move$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_move(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_move$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_previous text;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id,
    p_organization_id,
    p_preview_id,
    'footage.move'
  );

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  v_previous := v_asset.file_key;

  IF EXISTS (
    SELECT 1
    FROM public.footage_assets other
    WHERE other.organization_id = p_organization_id
      AND other.file_key = v_payload->>'new_file_key'
      AND other.id <> v_asset.id
  ) THEN
    RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END IF;

  BEGIN
    UPDATE public.footage_assets a
    SET
      file_key = v_payload->>'new_file_key',
      location_label = CASE
        WHEN jsonb_exists(v_payload, 'location') THEN NULLIF(v_payload->>'location', '')
        ELSE a.location_label
      END,
      product_label = CASE
        WHEN jsonb_exists(v_payload, 'product') THEN NULLIF(v_payload->>'product', '')
        ELSE a.product_label
      END,
      storage_status = 'bank'
    WHERE a.id = v_asset.id
      AND a.organization_id = p_organization_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_payload->>'new_file_key',
    'previous_file_key', v_previous,
    'storage_status', 'bank'
  );
END;
$apply_move$;

-- ---------------------------------------------------------------------------
-- Ban
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_footage_normalize_ban(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_ban$
DECLARE
  v_key text;
  v_reason text;
  v_index numeric;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_input) AS k
    WHERE k NOT IN ('file_key', 'scene_index', 'reason')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'file_key') <> 'string'
     OR jsonb_typeof(p_input->'scene_index') <> 'number'
     OR jsonb_typeof(p_input->'reason') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_key := public.mcp_footage_clean_key(p_input->>'file_key');
  v_index := (p_input->>'scene_index')::numeric;
  IF v_index <> trunc(v_index) OR v_index < 1 OR v_index > 100000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_reason := btrim(p_input->>'reason');
  IF char_length(v_reason) < 1 OR char_length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'file_key', v_key,
    'scene_index', v_index::integer,
    'reason', v_reason
  );
END;
$normalize_ban$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_ban(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_ban$
DECLARE
  v_payload jsonb;
  v_scene_id uuid;
  v_before text;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_normalize_ban(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT s.id
  INTO v_scene_id
  FROM public.footage_scenes s
  JOIN public.footage_assets a
    ON a.id = s.asset_id
   AND a.organization_id = s.organization_id
  WHERE s.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
    AND s.scene_index = (v_payload->>'scene_index')::integer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT b.reason
  INTO v_before
  FROM public.footage_bans b
  WHERE b.organization_id = p_organization_id
    AND b.scene_id = v_scene_id;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.ban.add',
    v_payload,
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_payload->>'file_key',
    'scene_index', (v_payload->>'scene_index')::integer,
    'before_reason', v_before,
    'after_reason', v_payload->>'reason',
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_ban$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_ban(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_ban$
DECLARE
  v_payload jsonb;
  v_scene_id uuid;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id,
    p_organization_id,
    p_preview_id,
    'footage.ban.add'
  );

  SELECT s.id
  INTO v_scene_id
  FROM public.footage_scenes s
  JOIN public.footage_assets a
    ON a.id = s.asset_id
   AND a.organization_id = s.organization_id
  WHERE s.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
    AND s.scene_index = (v_payload->>'scene_index')::integer
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.footage_bans (organization_id, scene_id, reason)
  VALUES (p_organization_id, v_scene_id, v_payload->>'reason')
  ON CONFLICT (scene_id) DO UPDATE
  SET reason = EXCLUDED.reason,
      updated_at = now();

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_payload->>'file_key',
    'scene_index', (v_payload->>'scene_index')::integer,
    'reason', v_payload->>'reason'
  );
END;
$apply_ban$;

-- ---------------------------------------------------------------------------
-- Grants. Helpers stay callable by the owner only.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.mcp_footage_clean_key(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_tag(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_set_scene_tag(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_normalize_scene_batch(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_normalize_usage(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_normalize_move(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_normalize_ban(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_take_preview(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_footage_scene_batch(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_scene_batch(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_scene_batch(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_scene_batch(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_footage_usage(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_usage(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_usage(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_usage(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_footage_move(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_move(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_move(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_move(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_footage_ban(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_ban(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_ban(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_ban(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.mcp_preview_footage_scene_batch(uuid, uuid, jsonb) IS
  'MCP footage.scenes.upsert_batch.preview. Session org only. Saves nothing in the catalog.';
COMMENT ON FUNCTION public.mcp_apply_footage_scene_batch(uuid, uuid, uuid) IS
  'MCP footage.scenes.upsert_batch. Applies one preview. Does not create scenes.';
COMMENT ON FUNCTION public.mcp_preview_footage_usage(uuid, uuid, jsonb) IS
  'MCP footage.usage.log.preview. already_logged returns no preview id.';
COMMENT ON FUNCTION public.mcp_apply_footage_usage(uuid, uuid, uuid) IS
  'MCP footage.usage.log. One usage row for the preview.';
COMMENT ON FUNCTION public.mcp_preview_footage_move(uuid, uuid, jsonb) IS
  'MCP footage.move.preview. Changes the stored address only.';
COMMENT ON FUNCTION public.mcp_apply_footage_move(uuid, uuid, uuid) IS
  'MCP footage.move. Sets storage_status to bank. Does not move the laptop file.';
COMMENT ON FUNCTION public.mcp_preview_footage_ban(uuid, uuid, jsonb) IS
  'MCP footage.ban.add.preview. Shows the previous reason.';
COMMENT ON FUNCTION public.mcp_apply_footage_ban(uuid, uuid, uuid) IS
  'MCP footage.ban.add. Inserts or replaces the reason. Does not clear a ban.';
