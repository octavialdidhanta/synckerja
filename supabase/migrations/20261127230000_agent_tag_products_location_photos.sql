-- Tagger context, part 2:
-- * products: the product names of the Produk tab (catalog_menus.name) with their aliases. The Agent writes the
--   product of new footage as exactly one of these names, from the AI answer or from the clip's folder name.
-- * location_photos: the photos of the Lokasi tab with their descriptions, as the AI's reference per location label.
-- * agent_open_shotlists: each shot list also carries its location label and each shot its product names.

CREATE OR REPLACE FUNCTION public.agent_catalog_extras(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $catalog_extras$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN jsonb_build_object(
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', btrim(m.name),
        'aliases', COALESCE(to_jsonb(m.aliases), '[]'::jsonb)
      ) ORDER BY m.created_at)
      FROM public.catalog_menus m
      WHERE m.organization_id = v_org AND btrim(COALESCE(m.name, '')) <> ''
    ), '[]'::jsonb),
    'location_photos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'label', q.label, 'name', q.name, 'description', q.description, 'path', q.storage_path
      ) ORDER BY q.label, q.name, q.position)
      FROM (
        SELECT l.label, l.name, p.position, p.storage_path,
               left(COALESCE(NULLIF(btrim(p.description), ''), NULLIF(btrim(p.label), ''), ''), 300) AS description,
               row_number() OVER (PARTITION BY l.id ORDER BY p.position, p.id) AS n
        FROM public.catalog_location_photos p
        JOIN public.catalog_locations l ON l.id = p.location_id
        WHERE l.organization_id = v_org
          AND p.storage_path IS NOT NULL
          AND COALESCE(btrim(l.label), '') NOT IN ('', '?')
      ) q
      WHERE q.n <= 4
    ), '[]'::jsonb)
  );
END;
$catalog_extras$;

REVOKE ALL ON FUNCTION public.agent_catalog_extras(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_catalog_extras(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.agent_open_shotlists(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $agent_shotlists$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'external_id', j.external_id,
      'judul', left(COALESCE(j.document->>'judul', ''), 200),
      'lokasi', left(COALESCE(j.document->>'lokasi', ''), 120),
      'location_label', (
        SELECT l.label FROM public.catalog_locations l
        WHERE l.organization_id = v_org AND l.external_id = j.document->>'lokasi'
          AND COALESCE(btrim(l.label), '') NOT IN ('', '?')
        LIMIT 1
      ),
      'shots', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s->>'id',
          'judul', left(COALESCE(s->>'judul', s->>'title', ''), 160),
          'action', left(COALESCE(s->>'action', s->>'prompt', ''), 260),
          'menu', left(COALESCE(CASE WHEN jsonb_typeof(s->'menu') = 'string' THEN s->>'menu' END, ''), 80),
          'products', COALESCE((
            SELECT jsonb_agg(DISTINCT btrim(m.name))
            FROM public.catalog_menus m
            WHERE m.organization_id = v_org
              AND m.external_id IN (
                SELECT s->>'menu' WHERE jsonb_typeof(s->'menu') = 'string'
                UNION ALL
                SELECT x FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(s->'menu') = 'array' THEN s->'menu' ELSE '[]'::jsonb END) x
              )
          ), '[]'::jsonb)
        ) ORDER BY ord)
        FROM jsonb_array_elements(j.document->'shots') WITH ORDINALITY AS x(s, ord)
        WHERE COALESCE((s->>'done')::boolean, false) = false
      ), '[]'::jsonb)
    ))
    FROM (SELECT * FROM public.footage_open_shot_jobs(v_org) LIMIT 8) j
  ), '[]'::jsonb);
END;
$agent_shotlists$;
