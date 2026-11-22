-- MCP footage.clips.upsert: preview clip labels, then save that same change once.
-- The stored address and storage_status stay with footage.move.
-- This does not create a clip and does not move the laptop file.

ALTER TABLE public.mcp_footage_previews
  DROP CONSTRAINT mcp_footage_previews_tool_check;

ALTER TABLE public.mcp_footage_previews
  ADD CONSTRAINT mcp_footage_previews_tool_check CHECK (
    tool IN (
      'footage.scenes.upsert_batch',
      'footage.usage.log',
      'footage.move',
      'footage.ban.add',
      'footage.clips.upsert'
    )
  );

CREATE OR REPLACE FUNCTION public.mcp_footage_normalize_clip(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_clip$
DECLARE
  v_key text;
  v_text text;
  v_origin text;
  v_payload jsonb;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_input) AS k
    WHERE k NOT IN ('file_key', 'location', 'product', 'summary', 'note', 'origin')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'file_key') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_key := public.mcp_footage_clean_key(p_input->>'file_key');
  v_payload := jsonb_build_object('file_key', v_key);

  IF jsonb_exists(p_input, 'location') THEN
    IF jsonb_typeof(p_input->'location') <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_text := btrim(p_input->>'location');
    IF char_length(v_text) > 500 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('location', v_text);
  END IF;

  IF jsonb_exists(p_input, 'product') THEN
    IF jsonb_typeof(p_input->'product') <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_text := btrim(p_input->>'product');
    IF char_length(v_text) > 500 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('product', v_text);
  END IF;

  IF jsonb_exists(p_input, 'summary') THEN
    IF jsonb_typeof(p_input->'summary') <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_text := btrim(p_input->>'summary');
    IF char_length(v_text) > 4000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('summary', v_text);
  END IF;

  IF jsonb_exists(p_input, 'note') THEN
    IF jsonb_typeof(p_input->'note') <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_text := btrim(p_input->>'note');
    IF char_length(v_text) > 4000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('note', v_text);
  END IF;

  IF jsonb_exists(p_input, 'origin') THEN
    IF jsonb_typeof(p_input->'origin') <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_origin := lower(btrim(p_input->>'origin'));
    IF v_origin NOT IN ('hp', 'ai', 'foto') THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_payload := v_payload || jsonb_build_object('origin', v_origin);
  END IF;

  IF (SELECT count(*) FROM jsonb_object_keys(v_payload)) < 2 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  RETURN v_payload;
END;
$normalize_clip$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_clip(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_clip$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_normalize_clip(p_input);

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

  IF jsonb_exists(v_payload, 'location') THEN
    v_before := v_before || jsonb_build_object('location_label', v_asset.location_label);
    v_after := v_after || jsonb_build_object('location_label', NULLIF(v_payload->>'location', ''));
  END IF;
  IF jsonb_exists(v_payload, 'product') THEN
    v_before := v_before || jsonb_build_object('product_label', v_asset.product_label);
    v_after := v_after || jsonb_build_object('product_label', NULLIF(v_payload->>'product', ''));
  END IF;
  IF jsonb_exists(v_payload, 'summary') THEN
    v_before := v_before || jsonb_build_object('summary', v_asset.summary);
    v_after := v_after || jsonb_build_object('summary', NULLIF(v_payload->>'summary', ''));
  END IF;
  IF jsonb_exists(v_payload, 'note') THEN
    v_before := v_before || jsonb_build_object('note', v_asset.note);
    v_after := v_after || jsonb_build_object('note', NULLIF(v_payload->>'note', ''));
  END IF;
  IF jsonb_exists(v_payload, 'origin') THEN
    v_before := v_before || jsonb_build_object('origin', v_asset.origin);
    v_after := v_after || jsonb_build_object('origin', v_payload->>'origin');
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.clips.upsert',
    v_payload,
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_asset.file_key,
    'before', v_before,
    'after', v_after,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_clip$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_clip(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_clip$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id,
    p_organization_id,
    p_preview_id,
    'footage.clips.upsert'
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

  IF jsonb_exists(v_payload, 'location') THEN
    v_before := v_before || jsonb_build_object('location_label', v_asset.location_label);
    v_after := v_after || jsonb_build_object('location_label', NULLIF(v_payload->>'location', ''));
  END IF;
  IF jsonb_exists(v_payload, 'product') THEN
    v_before := v_before || jsonb_build_object('product_label', v_asset.product_label);
    v_after := v_after || jsonb_build_object('product_label', NULLIF(v_payload->>'product', ''));
  END IF;
  IF jsonb_exists(v_payload, 'summary') THEN
    v_before := v_before || jsonb_build_object('summary', v_asset.summary);
    v_after := v_after || jsonb_build_object('summary', NULLIF(v_payload->>'summary', ''));
  END IF;
  IF jsonb_exists(v_payload, 'note') THEN
    v_before := v_before || jsonb_build_object('note', v_asset.note);
    v_after := v_after || jsonb_build_object('note', NULLIF(v_payload->>'note', ''));
  END IF;
  IF jsonb_exists(v_payload, 'origin') THEN
    v_before := v_before || jsonb_build_object('origin', v_asset.origin);
    v_after := v_after || jsonb_build_object('origin', v_payload->>'origin');
  END IF;

  UPDATE public.footage_assets a
  SET
    location_label = CASE
      WHEN jsonb_exists(v_payload, 'location') THEN NULLIF(v_payload->>'location', '')
      ELSE a.location_label
    END,
    product_label = CASE
      WHEN jsonb_exists(v_payload, 'product') THEN NULLIF(v_payload->>'product', '')
      ELSE a.product_label
    END,
    summary = CASE
      WHEN jsonb_exists(v_payload, 'summary') THEN NULLIF(v_payload->>'summary', '')
      ELSE a.summary
    END,
    note = CASE
      WHEN jsonb_exists(v_payload, 'note') THEN NULLIF(v_payload->>'note', '')
      ELSE a.note
    END,
    origin = CASE
      WHEN jsonb_exists(v_payload, 'origin') THEN v_payload->>'origin'
      ELSE a.origin
    END
  WHERE a.id = v_asset.id
    AND a.organization_id = p_organization_id;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_asset.file_key,
    'before', v_before,
    'after', v_after
  );
END;
$apply_clip$;

REVOKE ALL ON FUNCTION public.mcp_footage_normalize_clip(jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_footage_clip(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_clip(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_clip(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_clip(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.mcp_preview_footage_clip(uuid, uuid, jsonb) IS
  'MCP footage.clips.upsert.preview. Existing clip only. Saves nothing. Does not change the stored address.';
COMMENT ON FUNCTION public.mcp_apply_footage_clip(uuid, uuid, uuid) IS
  'MCP footage.clips.upsert. Applies one preview. Does not change file_key or storage_status.';
