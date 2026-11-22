-- Style, standing prompt, references, and shot lists.
-- Reference videos and photos stay on disk. The document column keeps the laptop JSON shape.
-- Menu and location tables are unchanged.

-- ---------------------------------------------------------------------------
-- catalog_style_fields
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_style_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  body text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_style_fields_org_key UNIQUE (organization_id, field_key),
  CONSTRAINT catalog_style_fields_org_position UNIQUE (organization_id, position),
  CONSTRAINT catalog_style_fields_key_check CHECK (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT catalog_style_fields_body_check CHECK (
    char_length(btrim(body)) > 0
    AND char_length(body) <= 4000
  ),
  CONSTRAINT catalog_style_fields_position_check CHECK (position >= 0)
);

COMMENT ON TABLE public.catalog_style_fields IS
  'The five style boxes: vo, editing, teks, musik, and talent.';

CREATE INDEX catalog_style_fields_org_idx
  ON public.catalog_style_fields (organization_id);

CREATE TRIGGER update_catalog_style_fields_updated_at
  BEFORE UPDATE ON public.catalog_style_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- catalog_prompt_fields
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_prompt_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  body text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_prompt_fields_org_key UNIQUE (organization_id, field_key),
  CONSTRAINT catalog_prompt_fields_org_position UNIQUE (organization_id, position),
  CONSTRAINT catalog_prompt_fields_key_check CHECK (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT catalog_prompt_fields_body_check CHECK (
    char_length(btrim(body)) > 0
    AND char_length(body) <= 4000
  ),
  CONSTRAINT catalog_prompt_fields_position_check CHECK (position >= 0)
);

COMMENT ON TABLE public.catalog_prompt_fields IS
  'Standing Google Flow prompt blocks from prompt_tetap.json.';

CREATE INDEX catalog_prompt_fields_org_idx
  ON public.catalog_prompt_fields (organization_id);

CREATE TRIGGER update_catalog_prompt_fields_updated_at
  BEFORE UPDATE ON public.catalog_prompt_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- catalog_references
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_references (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_references_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT catalog_references_org_external_id_key UNIQUE (organization_id, external_id),
  CONSTRAINT catalog_references_external_id_check CHECK (
    external_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(external_id) <= 80
  ),
  CONSTRAINT catalog_references_document_check CHECK (
    jsonb_typeof(document) = 'object'
    AND octet_length(document::text) <= 200000
  )
);

COMMENT ON COLUMN public.catalog_references.document IS
  'Original referensi.json object, including beats and motion graphics. The video file is not uploaded.';

CREATE INDEX catalog_references_org_idx
  ON public.catalog_references (organization_id);

CREATE TRIGGER update_catalog_references_updated_at
  BEFORE UPDATE ON public.catalog_references
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- catalog_shot_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_shot_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_shot_jobs_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT catalog_shot_jobs_org_external_id_key UNIQUE (organization_id, external_id),
  CONSTRAINT catalog_shot_jobs_external_id_check CHECK (
    external_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(external_id) <= 80
  ),
  CONSTRAINT catalog_shot_jobs_document_check CHECK (
    jsonb_typeof(document) = 'object'
    AND octet_length(document::text) <= 200000
  )
);

COMMENT ON COLUMN public.catalog_shot_jobs.document IS
  'Original shotlist.json job, including its shots. Archived jobs stay in this table.';

CREATE INDEX catalog_shot_jobs_org_idx
  ON public.catalog_shot_jobs (organization_id);

CREATE TRIGGER update_catalog_shot_jobs_updated_at
  BEFORE UPDATE ON public.catalog_shot_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalog_style_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_prompt_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_shot_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_style_fields_org ON public.catalog_style_fields
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_prompt_fields_org ON public.catalog_prompt_fields
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_references_org ON public.catalog_references
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_shot_jobs_org ON public.catalog_shot_jobs
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

REVOKE ALL ON TABLE public.catalog_style_fields FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_prompt_fields FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_references FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_shot_jobs FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_style_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_prompt_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_references TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_shot_jobs TO authenticated;

GRANT ALL ON TABLE public.catalog_style_fields TO service_role;
GRANT ALL ON TABLE public.catalog_prompt_fields TO service_role;
GRANT ALL ON TABLE public.catalog_references TO service_role;
GRANT ALL ON TABLE public.catalog_shot_jobs TO service_role;

-- ---------------------------------------------------------------------------
-- MCP reads. Membership helper already exists. service_role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_get_catalog_style(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $style$
DECLARE
  v_body jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_style_fields f
    WHERE f.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_object_agg(f.field_key, f.body ORDER BY f.position)
  INTO v_body
  FROM public.catalog_style_fields f
  WHERE f.organization_id = p_organization_id;

  RETURN COALESCE(v_body, '{}'::jsonb);
END;
$style$;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_prompts(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $prompts$
DECLARE
  v_body jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_prompt_fields f
    WHERE f.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_object_agg(f.field_key, f.body ORDER BY f.position)
  INTO v_body
  FROM public.catalog_prompt_fields f
  WHERE f.organization_id = p_organization_id;

  RETURN COALESCE(v_body, '{}'::jsonb);
END;
$prompts$;

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_references(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_refs$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  SELECT COALESCE(jsonb_agg(item.payload ORDER BY item.external_id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.external_id,
      jsonb_build_object(
        'id', r.external_id,
        'title', r.document->>'judul',
        'file', r.document->>'file',
        'creator', r.document->>'kreator',
        'has_voice', CASE WHEN jsonb_typeof(r.document->'ada_vo') = 'boolean' THEN r.document->'ada_vo' ELSE 'false'::jsonb END,
        'beat_count', CASE
          WHEN jsonb_typeof(r.document->'beats') = 'array' THEN jsonb_array_length(r.document->'beats')
          ELSE 0
        END,
        'motion_count', CASE
          WHEN jsonb_typeof(r.document->'mg') = 'array' THEN jsonb_array_length(r.document->'mg')
          ELSE 0
        END
      ) AS payload
    FROM public.catalog_references r
    WHERE r.organization_id = p_organization_id
  ) item;

  RETURN jsonb_build_object(
    'total', COALESCE(jsonb_array_length(v_rows), 0),
    'references', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$list_refs$;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_reference(
  p_user_id uuid,
  p_organization_id uuid,
  p_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_ref$
DECLARE
  v_id text := NULLIF(lower(btrim(COALESCE(p_id, ''))), '');
  v_document jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT r.document
  INTO v_document
  FROM public.catalog_references r
  WHERE r.organization_id = p_organization_id
    AND r.external_id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_document;
END;
$get_ref$;

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_shot_jobs(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_shots$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  SELECT COALESCE(jsonb_agg(item.payload ORDER BY item.title), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      COALESCE(j.document->>'judul', j.external_id) AS title,
      jsonb_build_object(
        'id', j.external_id,
        'title', j.document->>'judul',
        'location_id', j.document->>'lokasi',
        'archived', CASE WHEN jsonb_typeof(j.document->'arsip') = 'boolean' THEN j.document->'arsip' ELSE 'false'::jsonb END,
        'shot_count', CASE
          WHEN jsonb_typeof(j.document->'shots') = 'array' THEN jsonb_array_length(j.document->'shots')
          ELSE 0
        END
      ) AS payload
    FROM public.catalog_shot_jobs j
    WHERE j.organization_id = p_organization_id
  ) item;

  RETURN jsonb_build_object(
    'total', COALESCE(jsonb_array_length(v_rows), 0),
    'jobs', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$list_shots$;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_shot_job(
  p_user_id uuid,
  p_organization_id uuid,
  p_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_shot$
DECLARE
  v_id text := NULLIF(lower(btrim(COALESCE(p_id, ''))), '');
  v_document jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT j.document
  INTO v_document
  FROM public.catalog_shot_jobs j
  WHERE j.organization_id = p_organization_id
    AND j.external_id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_document;
END;
$get_shot$;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_style(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_style(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_style(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_prompts(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_prompts(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_prompts(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_catalog_references(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_catalog_references(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_references(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_reference(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_reference(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_reference(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_catalog_shot_jobs(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_catalog_shot_jobs(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_shot_jobs(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_shot_job(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_shot_job(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_shot_job(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.mcp_get_catalog_style(uuid, uuid) IS
  'MCP catalog.style.get. Session org only.';
COMMENT ON FUNCTION public.mcp_get_catalog_prompts(uuid, uuid) IS
  'MCP catalog.prompts.get. Session org only.';
COMMENT ON FUNCTION public.mcp_list_catalog_references(uuid, uuid) IS
  'MCP catalog.references.list. Session org only. Omits beats and motion graphics.';
COMMENT ON FUNCTION public.mcp_get_catalog_reference(uuid, uuid, text) IS
  'MCP catalog.reference.get. Session org only. Returns the stored reference document.';
COMMENT ON FUNCTION public.mcp_list_catalog_shot_jobs(uuid, uuid) IS
  'MCP catalog.shotlists.list. Session org only. Omits shot text.';
COMMENT ON FUNCTION public.mcp_get_catalog_shot_job(uuid, uuid, text) IS
  'MCP catalog.shotlist.get. Session org only. Returns the stored shot job.';
