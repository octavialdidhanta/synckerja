-- A Content Studio product may point at one sellable thing.
-- F&B points at an Item Library product. Software points at a content feature.
-- Price, stock, and the content-plan category stay where they are.
-- Deleting the source keeps the visual columns and clears the link.

ALTER TABLE public.catalog_menus
  ADD COLUMN default_price_id uuid NULL REFERENCES public.default_prices (id) ON DELETE SET NULL,
  ADD COLUMN feature_id uuid NULL REFERENCES public.product_knowledge_features (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.catalog_menus.default_price_id IS
  'Item Library product (default_prices.kind = product). Null when this row is typed by hand or linked to a feature.';

COMMENT ON COLUMN public.catalog_menus.feature_id IS
  'Content feature (product_knowledge_features). Null when this row is typed by hand or linked to an Item Library product.';

ALTER TABLE public.catalog_menus
  ADD CONSTRAINT catalog_menus_one_source_check
  CHECK (default_price_id IS NULL OR feature_id IS NULL);

CREATE UNIQUE INDEX catalog_menus_org_default_price_uidx
  ON public.catalog_menus (organization_id, default_price_id)
  WHERE default_price_id IS NOT NULL;

CREATE UNIQUE INDEX catalog_menus_org_feature_uidx
  ON public.catalog_menus (organization_id, feature_id)
  WHERE feature_id IS NOT NULL;

-- Same catalog context as 20261125160000, except a linked row uses the live source name.

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
      SELECT jsonb_agg(jsonb_build_object(
        'name', COALESCE(NULLIF(btrim(dp.name), ''), NULLIF(btrim(pkf.feature_name), ''), m.name),
        'aliases', COALESCE(to_jsonb(m.aliases), '[]'::jsonb),
        'line', (
          SELECT left(btrim(f.body), 160)
          FROM public.catalog_menu_fields f
          WHERE f.menu_id = m.id AND f.field_key = 'main' AND btrim(f.body) <> ''
          LIMIT 1
        )
      ) ORDER BY m.created_at)
      FROM public.catalog_menus m
      LEFT JOIN public.default_prices dp
        ON dp.id = m.default_price_id
       AND dp.organization_id = m.organization_id
       AND dp.kind = 'product'
      LEFT JOIN public.product_knowledge_features pkf
        ON pkf.id = m.feature_id
       AND pkf.organization_id = m.organization_id
      WHERE m.organization_id = v_org
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
        SELECT DISTINCT btrim(loc.label) AS l
        FROM public.catalog_locations loc
        WHERE loc.organization_id = v_org
          AND COALESCE(btrim(loc.label), '') NOT IN ('', '?')
      ) q
    ), '[]'::jsonb),
    'locations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'label', l.label,
        'name', l.name,
        'notes', (
          SELECT left(string_agg(s.title || ': ' || s.body, E'\n' ORDER BY s.position), 400)
          FROM public.catalog_location_sections s
          WHERE s.location_id = l.id
        )
      ) ORDER BY l.label, l.name)
      FROM public.catalog_locations l WHERE l.organization_id = v_org
    ), '[]'::jsonb),
    'bans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reason', b.reason, 'scene', left(COALESCE(s.summary, ''), 200)))
      FROM (SELECT * FROM public.footage_bans WHERE organization_id = v_org ORDER BY created_at DESC LIMIT 40) b
      JOIN public.footage_scenes s ON s.id = b.scene_id
    ), '[]'::jsonb),
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
