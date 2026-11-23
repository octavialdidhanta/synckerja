-- Synckerja Agent — step 4: AI tags for new footage, saved as "perlu dicek" (needs a human look).
--
-- footage_assets.tag_status
--   belum        registered by the Agent, nothing tagged yet
--   perlu_dicek  tagged by AI; shown with a badge in Office until a person checks it
--   dicek        tagged or checked by a person (every older row)
-- Any edit by a person (Office, MCP) to the clip, its scenes or their tags turns it into "dicek".
-- The Agent may only fill tags while the clip is still "belum": it never overwrites a person's work.

ALTER TABLE public.footage_assets
  ADD COLUMN tag_status text NOT NULL DEFAULT 'dicek'
  CONSTRAINT footage_assets_tag_status_check CHECK (tag_status IN ('belum', 'perlu_dicek', 'dicek'));

COMMENT ON COLUMN public.footage_assets.tag_status IS
  'belum = registered by the Agent, untagged; perlu_dicek = AI tags, not yet checked; dicek = by or checked by a person.';

CREATE INDEX footage_assets_tag_status_idx ON public.footage_assets (organization_id, tag_status)
  WHERE tag_status <> 'dicek';

-- Writes inside agent_* functions set this for their own transaction only.
CREATE OR REPLACE FUNCTION public.agent_is_writing()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT COALESCE(current_setting('synckerja.agent_write', true), '') = 'on' $$;

-- ── A person's edit means the tags were looked at.

CREATE OR REPLACE FUNCTION public.footage_tag_status_on_asset_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $asset_edit$
BEGIN
  IF NOT public.agent_is_writing()
     AND NEW.tag_status = OLD.tag_status
     AND NEW.tag_status <> 'dicek'
     AND (NEW.product_label IS DISTINCT FROM OLD.product_label
       OR NEW.location_label IS DISTINCT FROM OLD.location_label
       OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.note IS DISTINCT FROM OLD.note) THEN
    NEW.tag_status := 'dicek';
  END IF;
  RETURN NEW;
END;
$asset_edit$;

CREATE TRIGGER footage_assets_tag_status_edit
  BEFORE UPDATE OF product_label, location_label, summary, note ON public.footage_assets
  FOR EACH ROW EXECUTE FUNCTION public.footage_tag_status_on_asset_edit();

CREATE OR REPLACE FUNCTION public.footage_tag_status_on_scene_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $scene_edit$
DECLARE
  v_scene uuid;
BEGIN
  IF public.agent_is_writing() THEN
    RETURN NULL;
  END IF;
  IF TG_TABLE_NAME = 'footage_scenes' THEN
    IF NEW.scene_kind IS NOT DISTINCT FROM OLD.scene_kind
       AND NEW.summary IS NOT DISTINCT FROM OLD.summary
       AND NEW.note IS NOT DISTINCT FROM OLD.note THEN
      RETURN NULL;
    END IF;
    UPDATE public.footage_assets SET tag_status = 'dicek'
    WHERE id = NEW.asset_id AND tag_status <> 'dicek';
    RETURN NULL;
  END IF;
  -- footage_tag_values
  v_scene := CASE WHEN TG_OP = 'DELETE' THEN OLD.scene_id ELSE NEW.scene_id END;
  IF v_scene IS NOT NULL THEN
    UPDATE public.footage_assets a SET tag_status = 'dicek'
    FROM public.footage_scenes s
    WHERE s.id = v_scene AND a.id = s.asset_id AND a.tag_status <> 'dicek';
  END IF;
  RETURN NULL;
END;
$scene_edit$;

CREATE TRIGGER footage_scenes_tag_status_edit
  AFTER UPDATE OF scene_kind, summary, note ON public.footage_scenes
  FOR EACH ROW EXECUTE FUNCTION public.footage_tag_status_on_scene_edit();

CREATE TRIGGER footage_tag_values_tag_status_edit
  AFTER INSERT OR UPDATE OR DELETE ON public.footage_tag_values
  FOR EACH ROW EXECUTE FUNCTION public.footage_tag_status_on_scene_edit();

-- ── Register (step 3) now marks Agent clips "belum".

CREATE OR REPLACE FUNCTION public.agent_footage_register(p_token_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $register$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_payload jsonb;
  v_asset_id uuid;
  v_scene_id uuid;
  v_item jsonb;
  v_scenes jsonb := '[]'::jsonb;
BEGIN
  IF upper(COALESCE(p_input->>'file_key', '')) NOT LIKE 'INBOX/%' OR p_input ? 'storage_status' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_payload := public.mcp_footage_normalize_clip_create(p_input);
  PERFORM set_config('synckerja.agent_write', 'on', true);

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'footage_asset:' || v_org::text || ':' || (v_payload->>'file_key'), 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.footage_assets a
    WHERE a.organization_id = v_org AND a.file_key = v_payload->>'file_key'
  ) THEN
    RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.footage_assets (
    organization_id, file_key, media_type, origin, location_label, product_label,
    summary, note, duration_seconds, storage_status, tag_status
  ) VALUES (
    v_org,
    v_payload->>'file_key',
    v_payload->>'media_type',
    v_payload->>'origin',
    v_payload->>'location',
    v_payload->>'product',
    v_payload->>'summary',
    v_payload->>'note',
    (v_payload->>'duration_seconds')::numeric,
    'inbox',
    'belum'
  )
  RETURNING id INTO v_asset_id;

  FOR v_item IN SELECT s FROM jsonb_array_elements(v_payload->'scenes') s LOOP
    INSERT INTO public.footage_scenes (
      organization_id, asset_id, scene_index, start_seconds, end_seconds, scene_kind, summary, note
    ) VALUES (
      v_org, v_asset_id,
      (v_item->>'scene_index')::integer,
      (v_item->>'start_seconds')::numeric,
      (v_item->>'end_seconds')::numeric,
      v_item->>'scene_kind',
      v_item->>'summary',
      v_item->>'note'
    )
    RETURNING id INTO v_scene_id;
    v_scenes := v_scenes || jsonb_build_array(jsonb_build_object(
      'scene_id', v_scene_id,
      'scene_index', (v_item->>'scene_index')::integer,
      'start_seconds', (v_item->>'start_seconds')::numeric,
      'end_seconds', (v_item->>'end_seconds')::numeric
    ));
  END LOOP;

  RETURN jsonb_build_object('asset_id', v_asset_id, 'file_key', v_payload->>'file_key', 'scenes', v_scenes);
END;
$register$;

-- ── What the AI needs to know about this organization's catalog.
-- Example thumbnails are paths; agent-api signs them.

CREATE OR REPLACE FUNCTION public.agent_catalog_context(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $context$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN jsonb_build_object(
    'tag_defs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', t.key, 'label', t.label, 'value_type', t.value_type) ORDER BY t.position, t.key)
      FROM public.footage_tag_defs t
      WHERE t.organization_id = v_org AND t.applies_to = 'scene'
    ), '[]'::jsonb),
    'scene_kinds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k.key, 'label', k.label) ORDER BY k.position, k.key)
      FROM public.footage_scene_kind_defs k WHERE k.organization_id = v_org
    ), '[]'::jsonb),
    'menus', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', m.name, 'aliases', COALESCE(to_jsonb(m.aliases), '[]'::jsonb)) ORDER BY m.created_at)
      FROM public.catalog_menus m WHERE m.organization_id = v_org
    ), '[]'::jsonb),
    'product_labels', COALESCE((
      SELECT jsonb_agg(p ORDER BY p) FROM (
        SELECT DISTINCT btrim(x) AS p
        FROM public.footage_assets a, unnest(string_to_array(a.product_label, ';')) x
        WHERE a.organization_id = v_org AND a.deleted_at IS NULL AND a.tag_status = 'dicek' AND btrim(x) <> ''
      ) q
    ), '[]'::jsonb),
    'location_labels', COALESCE((
      SELECT jsonb_agg(l ORDER BY l) FROM (
        SELECT DISTINCT a.location_label AS l
        FROM public.footage_assets a
        WHERE a.organization_id = v_org AND a.deleted_at IS NULL AND a.tag_status = 'dicek'
          AND COALESCE(btrim(a.location_label), '') NOT IN ('', '?')
      ) q
    ), '[]'::jsonb),
    'locations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', l.name,
        'notes', (SELECT left(string_agg(s.title || ': ' || s.body, E'\n' ORDER BY s.position), 1500)
                  FROM public.catalog_location_sections s WHERE s.location_id = l.id)
      ) ORDER BY l.name)
      FROM public.catalog_locations l WHERE l.organization_id = v_org
    ), '[]'::jsonb),
    'bans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reason', b.reason, 'scene', left(COALESCE(s.summary, ''), 200)))
      FROM (SELECT * FROM public.footage_bans WHERE organization_id = v_org ORDER BY created_at DESC LIMIT 40) b
      JOIN public.footage_scenes s ON s.id = b.scene_id
    ), '[]'::jsonb),
    -- Human-tagged scenes as worked examples (newest first).
    'examples', COALESCE((
      SELECT jsonb_agg(e) FROM (
        SELECT jsonb_build_object(
          'location', a.location_label,
          'product', a.product_label,
          'scene_kind', s.scene_kind,
          'summary', s.summary,
          'tags', COALESCE((
            SELECT jsonb_object_agg(d.key, COALESCE(to_jsonb(v.value_bool), to_jsonb(v.value_text)))
            FROM public.footage_tag_values v JOIN public.footage_tag_defs d ON d.id = v.tag_def_id
            WHERE v.scene_id = s.id
          ), '{}'::jsonb)
        ) AS e
        FROM public.footage_scenes s
        JOIN public.footage_assets a ON a.id = s.asset_id
        WHERE s.organization_id = v_org AND a.deleted_at IS NULL AND a.tag_status = 'dicek'
          AND COALESCE(btrim(s.summary), '') <> ''
        ORDER BY s.updated_at DESC
        LIMIT 40
      ) q
    ), '[]'::jsonb),
    -- Up to 3 thumbnails per known location, so the AI can compare the place it sees.
    'location_thumbs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('location', q.location_label, 'path', q.thumb_storage_path))
      FROM (
        SELECT a.location_label, s.thumb_storage_path,
               row_number() OVER (PARTITION BY a.location_label ORDER BY s.updated_at DESC) AS n
        FROM public.footage_scenes s
        JOIN public.footage_assets a ON a.id = s.asset_id
        WHERE s.organization_id = v_org AND a.deleted_at IS NULL AND a.tag_status = 'dicek'
          AND s.thumb_storage_path IS NOT NULL
          AND s.scene_kind IN ('suasana', 'lokasi', 'orang')
          AND COALESCE(btrim(a.location_label), '') NOT IN ('', '?')
      ) q
      WHERE q.n <= 3
    ), '[]'::jsonb)
  );
END;
$context$;

-- Clips waiting for AI tags (thumbnails already uploaded, so the scene list is final).
CREATE OR REPLACE FUNCTION public.agent_footage_untagged(p_token_id uuid, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $untagged$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN jsonb_build_object('clips', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'asset_id', a.id,
      'file_key', a.file_key,
      'media_type', a.media_type,
      'duration_seconds', a.duration_seconds,
      'scenes', (
        SELECT jsonb_agg(jsonb_build_object(
          'scene_index', s.scene_index, 'start_seconds', s.start_seconds, 'end_seconds', s.end_seconds
        ) ORDER BY s.scene_index)
        FROM public.footage_scenes s WHERE s.asset_id = a.id
      )
    ) ORDER BY a.created_at)
    FROM (
      SELECT * FROM public.footage_assets a
      WHERE a.organization_id = v_org AND a.tag_status = 'belum' AND a.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.footage_scenes s
          WHERE s.asset_id = a.id AND s.thumb_storage_path IS NULL AND s.thumb_required
        )
      ORDER BY a.created_at
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
    ) a
  ), '[]'::jsonb));
END;
$untagged$;

-- Save AI tags for one clip that is still "belum". Unknown tag keys or scene kinds are refused.
CREATE OR REPLACE FUNCTION public.agent_footage_tags(p_token_id uuid, p_asset_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $tags$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_status text;
  v_field text;
  v_text text;
  v_scene jsonb;
  v_scene_id uuid;
  v_kind text;
  v_key text;
  v_val jsonb;
  v_has_kinds boolean;
  v_count integer := 0;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('product', 'location', 'summary', 'note', 'scenes')
  ) OR jsonb_typeof(p_input->'scenes') <> 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT tag_status INTO v_status
  FROM public.footage_assets
  WHERE id = p_asset_id AND organization_id = v_org AND deleted_at IS NULL
  FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'belum' THEN
    RAISE EXCEPTION 'already_tagged' USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('synckerja.agent_write', 'on', true);

  FOREACH v_field IN ARRAY ARRAY['product', 'location', 'summary', 'note'] LOOP
    IF p_input ? v_field AND jsonb_typeof(p_input->v_field) <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF char_length(COALESCE(p_input->>v_field, '')) > (CASE WHEN v_field IN ('product', 'location') THEN 500 ELSE 4000 END) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  UPDATE public.footage_assets SET
    product_label = COALESCE(NULLIF(btrim(p_input->>'product'), ''), product_label),
    location_label = COALESCE(NULLIF(btrim(p_input->>'location'), ''), location_label),
    summary = COALESCE(NULLIF(btrim(p_input->>'summary'), ''), summary),
    note = COALESCE(NULLIF(btrim(p_input->>'note'), ''), note),
    tag_status = 'perlu_dicek',
    updated_at = now()
  WHERE id = p_asset_id;

  v_has_kinds := EXISTS (SELECT 1 FROM public.footage_scene_kind_defs WHERE organization_id = v_org);

  FOR v_scene IN SELECT s FROM jsonb_array_elements(p_input->'scenes') s LOOP
    IF jsonb_typeof(v_scene) <> 'object' OR jsonb_typeof(v_scene->'scene_index') <> 'number' OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_scene) k WHERE k NOT IN ('scene_index', 'scene_kind', 'summary', 'note', 'tags')
    ) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_scene_id FROM public.footage_scenes
    WHERE asset_id = p_asset_id AND scene_index = (v_scene->>'scene_index')::integer;
    IF v_scene_id IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    v_kind := NULLIF(btrim(COALESCE(v_scene->>'scene_kind', '')), '');
    IF v_kind IS NOT NULL AND (char_length(v_kind) > 80 OR (v_has_kinds AND NOT EXISTS (
      SELECT 1 FROM public.footage_scene_kind_defs WHERE organization_id = v_org AND key = v_kind
    ))) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    FOREACH v_field IN ARRAY ARRAY['summary', 'note'] LOOP
      IF v_scene ? v_field AND (jsonb_typeof(v_scene->v_field) <> 'string' OR char_length(v_scene->>v_field) > 4000) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END LOOP;

    UPDATE public.footage_scenes SET
      scene_kind = COALESCE(v_kind, scene_kind),
      summary = COALESCE(NULLIF(btrim(v_scene->>'summary'), ''), summary),
      note = COALESCE(NULLIF(btrim(v_scene->>'note'), ''), note),
      updated_at = now()
    WHERE id = v_scene_id;

    IF v_scene ? 'tags' THEN
      IF jsonb_typeof(v_scene->'tags') <> 'object' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      FOR v_key, v_val IN SELECT * FROM jsonb_each(v_scene->'tags') LOOP
        PERFORM public.mcp_footage_set_scene_tag_value(v_org, v_scene_id, v_key, v_val);
      END LOOP;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('asset_id', p_asset_id, 'tag_status', 'perlu_dicek', 'scenes', v_count);
END;
$tags$;

REVOKE ALL ON FUNCTION public.agent_catalog_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_catalog_context(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_untagged(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_untagged(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_tags(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_tags(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.footage_tag_status_on_scene_edit() FROM PUBLIC, anon, authenticated;
