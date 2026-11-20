-- Public order card can show the logo uploaded in Receipt settings for that outlet.

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_store(
  p_code text,
  p_table_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out record;
  v_org public.synckerja_order_org_settings%ROWTYPE;
  v_tbl record;
  v_table jsonb := NULL;
  v_hours jsonb;
  v_address text;
  v_cover text;
  v_outlet_logo text;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_org FROM public.synckerja_order_org_settings WHERE organization_id = v_out.organization_id;
  SELECT NULLIF(btrim(o.address), '') INTO v_address
  FROM public.pos_outlets o
  WHERE o.id = v_out.outlet_id;
  SELECT NULLIF(btrim(s.cover_path), '') INTO v_cover
  FROM public.synckerja_order_outlet_settings s
  WHERE s.outlet_id = v_out.outlet_id;
  v_cover := COALESCE(v_cover, v_org.cover_path);
  SELECT NULLIF(btrim(r.logo_storage_path), '') INTO v_outlet_logo
  FROM public.pos_outlet_receipt_settings r
  WHERE r.outlet_id = v_out.outlet_id;
  v_hours := public._synckerja_order_hours_state(v_out.outlet_id);
  IF p_table_name IS NOT NULL AND btrim(p_table_name) <> '' THEN
    SELECT * INTO v_tbl FROM public._synckerja_order_table_state(v_out.organization_id, v_out.outlet_id, p_table_name);
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'public_code', v_out.public_code,
        'outlet_id', v_out.outlet_id,
        'outlet_name', v_out.outlet_name,
        'outlet_address', v_address,
        'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
        'logo_path', v_org.logo_path,
        'outlet_logo_path', v_outlet_logo,
        'cover_path', v_cover,
        'pickup_enabled', v_org.pickup_enabled,
        'is_open', COALESCE((v_hours ->> 'is_open')::boolean, false),
        'hours', v_hours,
        'table', NULL,
        'table_error', 'not_found'
      );
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
  RETURN jsonb_build_object(
    'ok', true,
    'public_code', v_out.public_code,
    'outlet_id', v_out.outlet_id,
    'outlet_name', v_out.outlet_name,
    'outlet_address', v_address,
    'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
    'logo_path', v_org.logo_path,
    'outlet_logo_path', v_outlet_logo,
    'cover_path', v_cover,
    'pickup_enabled', v_org.pickup_enabled,
    'is_open', COALESCE((v_hours ->> 'is_open')::boolean, false),
    'hours', v_hours,
    'table', v_table
  );
END;
$$;

DROP POLICY IF EXISTS "outlet_receipt_logo_public_order" ON storage.objects;
CREATE POLICY "outlet_receipt_logo_public_order"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'outlet-receipt-assets'
    AND (storage.foldername(name))[2] = 'outlets'
    AND split_part(name, '/', 4) LIKE 'logo.%'
    AND (storage.foldername(name))[3] IN (
      SELECT s.outlet_id::text
      FROM public.synckerja_order_outlet_settings s
      WHERE s.enabled = true
    )
  );
