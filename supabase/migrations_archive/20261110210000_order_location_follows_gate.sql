-- Location, phone, map, and branch list follow the same public-order gate as the menu.
-- Sales tenants stay closed while POS is off. Mandiri tenants stay closed after the
-- trial or subscription end date. A paused store still returns its name, cover, and hours.

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_store(
  p_code text,
  p_table_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $rpc$
DECLARE
  v_out record;
  v_org public.synckerja_order_org_settings%ROWTYPE;
  v_tbl record;
  v_table jsonb := NULL;
  v_hours jsonb;
  v_address text;
  v_phone text;
  v_cover text;
  v_covers text[];
  v_outlet_logo text;
  v_blocked boolean := false;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet_paid(p_code);
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    v_blocked := true;
  END IF;
  SELECT * INTO v_org FROM public.synckerja_order_org_settings WHERE organization_id = v_out.organization_id;
  SELECT NULLIF(btrim(o.address), ''), NULLIF(btrim(o.phone), '')
  INTO v_address, v_phone
  FROM public.pos_outlets o
  WHERE o.id = v_out.outlet_id;
  v_phone := COALESCE(v_phone, NULLIF(btrim(v_org.contact_phone), ''));
  SELECT s.cover_paths, NULLIF(btrim(s.cover_path), '')
  INTO v_covers, v_cover
  FROM public.synckerja_order_outlet_settings s
  WHERE s.outlet_id = v_out.outlet_id;
  IF v_covers IS NULL OR cardinality(v_covers) = 0 THEN
    v_covers := CASE WHEN v_cover IS NOT NULL THEN ARRAY[v_cover] ELSE ARRAY[]::text[] END;
  END IF;
  IF cardinality(v_covers) = 0 AND NULLIF(btrim(v_org.cover_path), '') IS NOT NULL THEN
    v_covers := ARRAY[btrim(v_org.cover_path)];
  END IF;
  v_cover := NULLIF(btrim(v_covers[1]), '');
  SELECT NULLIF(btrim(r.logo_storage_path), '') INTO v_outlet_logo
  FROM public.pos_outlet_receipt_settings r
  WHERE r.outlet_id = v_out.outlet_id;
  v_hours := public._synckerja_order_hours_state(v_out.outlet_id);
  IF p_table_name IS NOT NULL AND btrim(p_table_name) <> '' THEN
    SELECT * INTO v_tbl FROM public._synckerja_order_table_state(v_out.organization_id, v_out.outlet_id, p_table_name);
    IF NOT FOUND THEN
      v_payload := jsonb_build_object(
        'ok', true,
        'public_code', v_out.public_code,
        'outlet_id', v_out.outlet_id,
        'outlet_name', v_out.outlet_name,
        'outlet_address', v_address,
        'outlet_phone', v_phone,
        'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
        'logo_path', v_org.logo_path,
        'outlet_logo_path', v_outlet_logo,
        'cover_path', v_cover,
        'cover_paths', to_jsonb(v_covers),
        'pickup_enabled', v_org.pickup_enabled,
        'is_open', COALESCE((v_hours ->> 'is_open')::boolean, false),
        'hours', v_hours,
        'table', NULL,
        'table_error', 'not_found'
      );
      IF v_blocked THEN
        v_payload := v_payload || jsonb_build_object(
          'ok', false,
          'error', 'ordering_unavailable',
          'outlet_address', NULL,
          'outlet_phone', NULL
        );
      END IF;
      RETURN v_payload;
    END IF;
    IF v_tbl.table_id IS NOT NULL THEN
      v_table := jsonb_build_object(
        'id', v_tbl.table_id,
        'name', v_tbl.table_name,
        'pax', v_tbl.table_pax,
        'remaining_pax', v_tbl.remaining_pax,
        'join', v_tbl.join_state,
        'session_id', v_tbl.open_session_id
      );
    END IF;
  END IF;
  v_payload := jsonb_build_object(
    'ok', true,
    'public_code', v_out.public_code,
    'outlet_id', v_out.outlet_id,
    'outlet_name', v_out.outlet_name,
    'outlet_address', v_address,
    'outlet_phone', v_phone,
    'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
    'logo_path', v_org.logo_path,
    'outlet_logo_path', v_outlet_logo,
    'cover_path', v_cover,
    'cover_paths', to_jsonb(v_covers),
    'pickup_enabled', v_org.pickup_enabled,
    'is_open', COALESCE((v_hours ->> 'is_open')::boolean, false),
    'hours', v_hours,
    'table', v_table
  );
  IF v_blocked THEN
    v_payload := v_payload || jsonb_build_object(
      'ok', false,
      'error', 'ordering_unavailable',
      'outlet_address', NULL,
      'outlet_phone', NULL
    );
  END IF;
  RETURN v_payload;
END;
$rpc$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_link(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out record;
  v_enabled boolean;
  v_maps text;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'not_found',
      'link_ordering_enabled', false,
      'maps_url', null
    );
  END IF;

  SELECT s.link_ordering_enabled, s.maps_url
    INTO v_enabled, v_maps
  FROM public.synckerja_order_outlet_settings s
  WHERE s.outlet_id = v_out.outlet_id
    AND s.organization_id = v_out.organization_id;

  RETURN jsonb_build_object(
    'ok', true,
    'link_ordering_enabled', COALESCE(v_enabled, false),
    'maps_url', CASE
      WHEN v_maps ~ '^https://' THEN v_maps
      ELSE NULL
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_branches(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out record;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'name', o.name,
        'address', NULLIF(btrim(o.address), ''),
        'public_code', o.public_code
      )
      ORDER BY o.sort_order, o.name
    )
    FROM public.pos_outlets o
    JOIN public.synckerja_order_outlet_settings s
      ON s.outlet_id = o.id
     AND s.organization_id = o.organization_id
     AND s.enabled = true
    WHERE o.organization_id = v_out.organization_id
      AND o.id <> v_out.outlet_id
      AND COALESCE(o.is_deleted, false) = false
      AND o.is_active = true
      AND o.public_code IS NOT NULL
  ), '[]'::jsonb);
END;
$$;

NOTIFY pgrst, 'reload schema';
