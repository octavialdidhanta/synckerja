-- Catalog products and locations. Photo bytes stay on disk; these rows store text and relative paths.
-- Footage labels stay text. product_knowledge_id is an optional later link and is not filled here.
-- Menu description blocks are rows so a later industry template can add its own keys.
-- A CHECK constraint cannot contain a subquery, so the list rule is a function.

CREATE FUNCTION public.catalog_text_list_ok(p_items text[], p_max integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $ok$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_items, ARRAY[]::text[])) AS item
    WHERE item IS NULL
       OR char_length(btrim(item)) = 0
       OR char_length(item) > p_max
  );
$ok$;

REVOKE ALL ON FUNCTION public.catalog_text_list_ok(text[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_text_list_ok(text[], integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- catalog_menus
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_menus (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  product_knowledge_id uuid NULL REFERENCES public.product_knowledge (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_menus_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT catalog_menus_org_external_id_key UNIQUE (organization_id, external_id),
  CONSTRAINT catalog_menus_external_id_check CHECK (
    external_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(external_id) <= 80
  ),
  CONSTRAINT catalog_menus_name_check CHECK (
    char_length(btrim(name)) > 0
    AND char_length(name) <= 200
  ),
  CONSTRAINT catalog_menus_aliases_check CHECK (public.catalog_text_list_ok(aliases, 200))
);

COMMENT ON COLUMN public.catalog_menus.external_id IS
  'Stable slug from menu.json, such as iga-bakar-kox2.';
COMMENT ON COLUMN public.catalog_menus.product_knowledge_id IS
  'Optional link to a Product Knowledge row. Import leaves this null.';
COMMENT ON COLUMN public.catalog_menus.aliases IS
  'Alternate names used by footage labels and the shot list. Matching ignores letter case.';

CREATE INDEX catalog_menus_org_idx
  ON public.catalog_menus (organization_id);

CREATE TRIGGER update_catalog_menus_updated_at
  BEFORE UPDATE ON public.catalog_menus
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- catalog_menu_fields
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_menu_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  menu_id uuid NOT NULL,
  field_key text NOT NULL,
  body text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_menu_fields_menu_org_fkey
    FOREIGN KEY (menu_id, organization_id)
    REFERENCES public.catalog_menus (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT catalog_menu_fields_menu_key UNIQUE (menu_id, field_key),
  CONSTRAINT catalog_menu_fields_menu_position UNIQUE (menu_id, position),
  CONSTRAINT catalog_menu_fields_key_check CHECK (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT catalog_menu_fields_body_check CHECK (
    char_length(btrim(body)) > 0
    AND char_length(body) <= 4000
  ),
  CONSTRAINT catalog_menu_fields_position_check CHECK (position >= 0)
);

COMMENT ON TABLE public.catalog_menu_fields IS
  'One prompt block per row. Current menus use main, topping, garnish, presentation, sauce, larangan, and khusus.';

CREATE INDEX catalog_menu_fields_org_menu_idx
  ON public.catalog_menu_fields (organization_id, menu_id);

-- ---------------------------------------------------------------------------
-- catalog_menu_photos
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_menu_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  menu_id uuid NOT NULL,
  file_path text NOT NULL,
  label text NOT NULL,
  ref text,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_menu_photos_menu_org_fkey
    FOREIGN KEY (menu_id, organization_id)
    REFERENCES public.catalog_menus (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT catalog_menu_photos_menu_position UNIQUE (menu_id, position),
  CONSTRAINT catalog_menu_photos_path_check CHECK (
    char_length(btrim(file_path)) > 0
    AND char_length(file_path) <= 500
    AND file_path !~ '^/'
    AND file_path !~ '\\\\'
    AND file_path !~ '(^|/)\.\.(/|$)'
  ),
  CONSTRAINT catalog_menu_photos_label_check CHECK (
    char_length(btrim(label)) > 0
    AND char_length(label) <= 500
  ),
  CONSTRAINT catalog_menu_photos_ref_check CHECK (ref IS NULL OR char_length(ref) <= 2000),
  CONSTRAINT catalog_menu_photos_position_check CHECK (position >= 0)
);

COMMENT ON COLUMN public.catalog_menu_photos.file_path IS
  'Path relative to the laptop _data folder, such as foto/iga-bakar_foto1.png. The file is not uploaded.';

CREATE INDEX catalog_menu_photos_org_menu_idx
  ON public.catalog_menu_photos (organization_id, menu_id);

-- ---------------------------------------------------------------------------
-- catalog_locations
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_locations_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT catalog_locations_org_external_id_key UNIQUE (organization_id, external_id),
  CONSTRAINT catalog_locations_external_id_check CHECK (
    external_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(external_id) <= 80
  ),
  CONSTRAINT catalog_locations_name_check CHECK (
    char_length(btrim(name)) > 0
    AND char_length(name) <= 200
  )
);

COMMENT ON COLUMN public.catalog_locations.external_id IS
  'Stable slug from lokasi.json, such as pik1-foodcourt.';

CREATE INDEX catalog_locations_org_idx
  ON public.catalog_locations (organization_id);

CREATE TRIGGER update_catalog_locations_updated_at
  BEFORE UPDATE ON public.catalog_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- catalog_location_photos
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_location_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  file_path text NOT NULL,
  label text NOT NULL,
  ref text,
  description text,
  areas text[] NOT NULL DEFAULT '{}',
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_location_photos_location_org_fkey
    FOREIGN KEY (location_id, organization_id)
    REFERENCES public.catalog_locations (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT catalog_location_photos_location_position UNIQUE (location_id, position),
  CONSTRAINT catalog_location_photos_path_check CHECK (
    char_length(btrim(file_path)) > 0
    AND char_length(file_path) <= 500
    AND file_path !~ '^/'
    AND file_path !~ '\\\\'
    AND file_path !~ '(^|/)\.\.(/|$)'
  ),
  CONSTRAINT catalog_location_photos_label_check CHECK (
    char_length(btrim(label)) > 0
    AND char_length(label) <= 500
  ),
  CONSTRAINT catalog_location_photos_ref_check CHECK (ref IS NULL OR char_length(ref) <= 2000),
  CONSTRAINT catalog_location_photos_description_check CHECK (
    description IS NULL OR char_length(description) <= 4000
  ),
  CONSTRAINT catalog_location_photos_areas_check CHECK (public.catalog_text_list_ok(areas, 80)),
  CONSTRAINT catalog_location_photos_position_check CHECK (position >= 0)
);

COMMENT ON COLUMN public.catalog_location_photos.description IS
  'Per-photo location text used when that photo is selected. Null until it is written.';

CREATE INDEX catalog_location_photos_org_location_idx
  ON public.catalog_location_photos (organization_id, location_id);

-- ---------------------------------------------------------------------------
-- catalog_location_sections
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_location_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  areas text[] NOT NULL DEFAULT '{}',
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_location_sections_location_org_fkey
    FOREIGN KEY (location_id, organization_id)
    REFERENCES public.catalog_locations (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT catalog_location_sections_location_position UNIQUE (location_id, position),
  CONSTRAINT catalog_location_sections_title_check CHECK (
    char_length(btrim(title)) > 0
    AND char_length(title) <= 200
  ),
  CONSTRAINT catalog_location_sections_body_check CHECK (char_length(body) <= 4000),
  CONSTRAINT catalog_location_sections_areas_check CHECK (public.catalog_text_list_ok(areas, 80)),
  CONSTRAINT catalog_location_sections_position_check CHECK (position >= 0)
);

COMMENT ON TABLE public.catalog_location_sections IS
  'Always-on prompt sections such as Scene, Atmosphere, and Must NOT. areas limits a section to those shot areas.';

CREATE INDEX catalog_location_sections_org_location_idx
  ON public.catalog_location_sections (organization_id, location_id);

-- ---------------------------------------------------------------------------
-- catalog_location_areas
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_location_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_location_areas_location_org_fkey
    FOREIGN KEY (location_id, organization_id)
    REFERENCES public.catalog_locations (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT catalog_location_areas_location_name UNIQUE (location_id, name),
  CONSTRAINT catalog_location_areas_location_position UNIQUE (location_id, position),
  CONSTRAINT catalog_location_areas_name_check CHECK (
    char_length(btrim(name)) > 0
    AND char_length(name) <= 80
  ),
  CONSTRAINT catalog_location_areas_body_check CHECK (
    char_length(btrim(body)) > 0
    AND char_length(body) <= 4000
  ),
  CONSTRAINT catalog_location_areas_position_check CHECK (position >= 0)
);

COMMENT ON TABLE public.catalog_location_areas IS
  'area_info from lokasi.json: one explanation per shot area.';

CREATE INDEX catalog_location_areas_org_location_idx
  ON public.catalog_location_areas (organization_id, location_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalog_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_menu_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_menu_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_location_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_location_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_location_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_menus_org ON public.catalog_menus
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_menu_fields_org ON public.catalog_menu_fields
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_menu_photos_org ON public.catalog_menu_photos
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_locations_org ON public.catalog_locations
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_location_photos_org ON public.catalog_location_photos
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_location_sections_org ON public.catalog_location_sections
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_location_areas_org ON public.catalog_location_areas
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

REVOKE ALL ON TABLE public.catalog_menus FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_menu_fields FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_menu_photos FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_locations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_location_photos FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_location_sections FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.catalog_location_areas FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_menus TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_menu_fields TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_menu_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_location_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_location_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_location_areas TO authenticated;

GRANT ALL ON TABLE public.catalog_menus TO service_role;
GRANT ALL ON TABLE public.catalog_menu_fields TO service_role;
GRANT ALL ON TABLE public.catalog_menu_photos TO service_role;
GRANT ALL ON TABLE public.catalog_locations TO service_role;
GRANT ALL ON TABLE public.catalog_location_photos TO service_role;
GRANT ALL ON TABLE public.catalog_location_sections TO service_role;
GRANT ALL ON TABLE public.catalog_location_areas TO service_role;

-- ---------------------------------------------------------------------------
-- MCP reads. Organization comes from the session. service_role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_catalog_require_member(p_user_id uuid, p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $member$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true)
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
END;
$member$;

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_products(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_products$
DECLARE
  v_products jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  SELECT COALESCE(jsonb_agg(item.payload ORDER BY item.name), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      m.name,
      jsonb_build_object(
        'id', m.external_id,
        'name', m.name,
        'aliases', to_jsonb(m.aliases),
        'photo_count', (
          SELECT count(*)::int
          FROM public.catalog_menu_photos p
          WHERE p.menu_id = m.id
            AND p.organization_id = m.organization_id
        ),
        'waiting', NOT EXISTS (
          SELECT 1
          FROM public.catalog_menu_fields f
          WHERE f.menu_id = m.id
            AND f.organization_id = m.organization_id
            AND btrim(f.body) <> ''
        )
      ) AS payload
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
  ) item;

  RETURN jsonb_build_object(
    'total', COALESCE(jsonb_array_length(v_products), 0),
    'products', COALESCE(v_products, '[]'::jsonb)
  );
END;
$list_products$;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_product(
  p_user_id uuid,
  p_organization_id uuid,
  p_id text,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_product$
DECLARE
  v_id text := NULLIF(lower(btrim(COALESCE(p_id, ''))), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_by_id public.catalog_menus%ROWTYPE;
  v_by_name public.catalog_menus%ROWTYPE;
  v_menu public.catalog_menus%ROWTYPE;
  v_count integer;
  v_fields jsonb;
  v_photos jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF v_id IS NULL AND v_name IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT *
    INTO v_by_id
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
      AND m.external_id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_name IS NOT NULL THEN
    SELECT count(*)::int
    INTO v_count
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
      AND (
        lower(btrim(m.name)) = lower(v_name)
        OR EXISTS (
          SELECT 1
          FROM unnest(m.aliases) AS alias
          WHERE lower(btrim(alias)) = lower(v_name)
        )
      );
    IF v_count = 0 THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_count > 1 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_by_name
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
      AND (
        lower(btrim(m.name)) = lower(v_name)
        OR EXISTS (
          SELECT 1
          FROM unnest(m.aliases) AS alias
          WHERE lower(btrim(alias)) = lower(v_name)
        )
      );
  END IF;

  IF v_id IS NOT NULL AND v_name IS NOT NULL AND v_by_id.id IS DISTINCT FROM v_by_name.id THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_menu := CASE WHEN v_id IS NOT NULL THEN v_by_id ELSE v_by_name END;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', f.field_key,
        'body', f.body,
        'position', f.position
      )
      ORDER BY f.position
    ),
    '[]'::jsonb
  )
  INTO v_fields
  FROM public.catalog_menu_fields f
  WHERE f.menu_id = v_menu.id
    AND f.organization_id = v_menu.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'file_path', p.file_path,
        'label', p.label,
        'ref', p.ref,
        'position', p.position
      )
      ORDER BY p.position
    ),
    '[]'::jsonb
  )
  INTO v_photos
  FROM public.catalog_menu_photos p
  WHERE p.menu_id = v_menu.id
    AND p.organization_id = v_menu.organization_id;

  RETURN jsonb_build_object(
    'id', v_menu.external_id,
    'name', v_menu.name,
    'aliases', to_jsonb(v_menu.aliases),
    'waiting', NOT EXISTS (
      SELECT 1
      FROM public.catalog_menu_fields f
      WHERE f.menu_id = v_menu.id
        AND f.organization_id = v_menu.organization_id
        AND btrim(f.body) <> ''
    ),
    'product_knowledge_id', v_menu.product_knowledge_id,
    'fields', COALESCE(v_fields, '[]'::jsonb),
    'photos', COALESCE(v_photos, '[]'::jsonb)
  );
END;
$get_product$;

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_locations(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_locations$
DECLARE
  v_locations jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  SELECT COALESCE(jsonb_agg(item.payload ORDER BY item.name), '[]'::jsonb)
  INTO v_locations
  FROM (
    SELECT
      l.name,
      jsonb_build_object(
        'id', l.external_id,
        'name', l.name,
        'photo_count', (
          SELECT count(*)::int
          FROM public.catalog_location_photos p
          WHERE p.location_id = l.id
            AND p.organization_id = l.organization_id
        ),
        'waiting',
          NOT EXISTS (
            SELECT 1
            FROM public.catalog_location_sections s
            WHERE s.location_id = l.id
              AND s.organization_id = l.organization_id
              AND btrim(s.body) <> ''
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.catalog_location_photos p
            WHERE p.location_id = l.id
              AND p.organization_id = l.organization_id
              AND btrim(COALESCE(p.description, '')) <> ''
          )
      ) AS payload
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
  ) item;

  RETURN jsonb_build_object(
    'total', COALESCE(jsonb_array_length(v_locations), 0),
    'locations', COALESCE(v_locations, '[]'::jsonb)
  );
END;
$list_locations$;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_location(
  p_user_id uuid,
  p_organization_id uuid,
  p_id text,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_location$
DECLARE
  v_id text := NULLIF(lower(btrim(COALESCE(p_id, ''))), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_by_id public.catalog_locations%ROWTYPE;
  v_by_name public.catalog_locations%ROWTYPE;
  v_location public.catalog_locations%ROWTYPE;
  v_count integer;
  v_photos jsonb;
  v_sections jsonb;
  v_areas jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF v_id IS NULL AND v_name IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT *
    INTO v_by_id
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
      AND l.external_id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_name IS NOT NULL THEN
    SELECT count(*)::int
    INTO v_count
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
      AND lower(btrim(l.name)) = lower(v_name);
    IF v_count = 0 THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_count > 1 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_by_name
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
      AND lower(btrim(l.name)) = lower(v_name);
  END IF;

  IF v_id IS NOT NULL AND v_name IS NOT NULL AND v_by_id.id IS DISTINCT FROM v_by_name.id THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_location := CASE WHEN v_id IS NOT NULL THEN v_by_id ELSE v_by_name END;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'file_path', p.file_path,
        'label', p.label,
        'ref', p.ref,
        'description', p.description,
        'areas', to_jsonb(p.areas),
        'position', p.position
      )
      ORDER BY p.position
    ),
    '[]'::jsonb
  )
  INTO v_photos
  FROM public.catalog_location_photos p
  WHERE p.location_id = v_location.id
    AND p.organization_id = v_location.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'title', s.title,
        'body', s.body,
        'areas', to_jsonb(s.areas),
        'position', s.position
      )
      ORDER BY s.position
    ),
    '[]'::jsonb
  )
  INTO v_sections
  FROM public.catalog_location_sections s
  WHERE s.location_id = v_location.id
    AND s.organization_id = v_location.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', a.name,
        'body', a.body,
        'position', a.position
      )
      ORDER BY a.position
    ),
    '[]'::jsonb
  )
  INTO v_areas
  FROM public.catalog_location_areas a
  WHERE a.location_id = v_location.id
    AND a.organization_id = v_location.organization_id;

  RETURN jsonb_build_object(
    'id', v_location.external_id,
    'name', v_location.name,
    'waiting',
      NOT EXISTS (
        SELECT 1
        FROM public.catalog_location_sections s
        WHERE s.location_id = v_location.id
          AND s.organization_id = v_location.organization_id
          AND btrim(s.body) <> ''
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.catalog_location_photos p
        WHERE p.location_id = v_location.id
          AND p.organization_id = v_location.organization_id
          AND btrim(COALESCE(p.description, '')) <> ''
      ),
    'photos', COALESCE(v_photos, '[]'::jsonb),
    'sections', COALESCE(v_sections, '[]'::jsonb),
    'areas', COALESCE(v_areas, '[]'::jsonb)
  );
END;
$get_location$;

REVOKE ALL ON FUNCTION public.mcp_catalog_require_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_catalog_require_member(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_catalog_require_member(uuid, uuid) FROM service_role;

REVOKE ALL ON FUNCTION public.mcp_list_catalog_products(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_catalog_products(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_products(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_catalog_locations(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_catalog_locations(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_locations(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.mcp_list_catalog_products(uuid, uuid) IS
  'MCP catalog.products.list. Session org only. Omits description text.';
COMMENT ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) IS
  'MCP catalog.product.get. Session org only. id is the slug. name matches the display name or an alias.';
COMMENT ON FUNCTION public.mcp_list_catalog_locations(uuid, uuid) IS
  'MCP catalog.locations.list. Session org only. Omits description text.';
COMMENT ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) IS
  'MCP catalog.location.get. Session org only. id is the slug. name matches the display name.';
