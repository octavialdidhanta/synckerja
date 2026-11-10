-- Sales tenants: a disabled POS module closes the public order page and checkout.
-- A disabled WhatsApp Business API module (or its omnichannel parent) hides the
-- order-page WhatsApp button. Mandiri tenants (self-service null or true) stay open.
-- An in-flight paid QRIS can still be confirmed via the ungated resolver.

CREATE OR REPLACE FUNCTION public.synckerja_order_sales_module_enabled(
  p_organization_id uuid,
  p_module_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN COALESCE((
      SELECT o.subscription_self_service_enabled
      FROM public.organizations o
      WHERE o.id = p_organization_id
    ), true) THEN true
    ELSE COALESCE((
      SELECT m.is_enabled
      FROM public.organization_sales_module_access m
      WHERE m.organization_id = p_organization_id
        AND m.module_key = p_module_key
    ), false)
  END;
$$;

REVOKE ALL ON FUNCTION public.synckerja_order_sales_module_enabled(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.synckerja_order_sales_module_enabled(uuid, text) FROM anon, authenticated;

-- Outlet lookup that ignores the sales POS flag. Used only to finish a QRIS
-- that was already paid, so turning POS off does not drop a payment in flight.
CREATE OR REPLACE FUNCTION public._synckerja_order_resolve_outlet_paid(p_code text)
RETURNS TABLE (
  organization_id uuid,
  outlet_id uuid,
  outlet_name text,
  public_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT o.organization_id, o.id, o.name, o.public_code
  FROM public.pos_outlets o
  JOIN public.synckerja_order_outlet_settings s ON s.outlet_id = o.id AND s.enabled = true
  JOIN public.synckerja_order_org_settings org ON org.organization_id = o.organization_id
    AND org.terms_accepted_at IS NOT NULL
  WHERE o.public_code = lower(btrim(p_code))
    AND o.is_deleted = false
    AND o.is_active = true
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_resolve_outlet_paid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_resolve_outlet_paid(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._synckerja_order_resolve_outlet_paid(text) TO service_role;

CREATE OR REPLACE FUNCTION public._synckerja_order_resolve_outlet(p_code text)
RETURNS TABLE (
  organization_id uuid,
  outlet_id uuid,
  outlet_name text,
  public_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT o.organization_id, o.id, o.name, o.public_code
  FROM public.pos_outlets o
  JOIN public.synckerja_order_outlet_settings s ON s.outlet_id = o.id AND s.enabled = true
  JOIN public.synckerja_order_org_settings org ON org.organization_id = o.organization_id
    AND org.terms_accepted_at IS NOT NULL
  WHERE o.public_code = lower(btrim(p_code))
    AND o.is_deleted = false
    AND o.is_active = true
    AND public.synckerja_order_sales_module_enabled(o.organization_id, 'pos')
  LIMIT 1;
END;
$$;

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
        v_payload := v_payload || jsonb_build_object('ok', false, 'error', 'ordering_unavailable');
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
    v_payload := v_payload || jsonb_build_object('ok', false, 'error', 'ordering_unavailable');
  END IF;
  RETURN v_payload;
END;
$rpc$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_whatsapp(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out record;
  v_settings public.synckerja_order_outlet_settings%ROWTYPE;
  v_digits text;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF NOT public.synckerja_order_sales_module_enabled(v_out.organization_id, 'omnichannel')
     OR NOT public.synckerja_order_sales_module_enabled(v_out.organization_id, 'whatsappBusiness') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'disabled');
  END IF;

  SELECT * INTO v_settings
  FROM public.synckerja_order_outlet_settings
  WHERE outlet_id = v_out.outlet_id AND organization_id = v_out.organization_id;

  IF NOT FOUND OR NOT v_settings.whatsapp_button_enabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'disabled');
  END IF;

  IF v_settings.whatsapp_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_selected');
  END IF;

  SELECT nullif(regexp_replace(coalesce(a.display_phone_number, ''), '\D', '', 'g'), '')
    INTO v_digits
  FROM public.organization_whatsapp_accounts a
  WHERE a.id = v_settings.whatsapp_account_id
    AND a.organization_id = v_out.organization_id
    AND a.is_active = true;

  IF v_digits IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inactive');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'phone_digits', v_digits,
    'prefill_message', nullif(btrim(coalesce(v_settings.whatsapp_prefill_message, '')), '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_synckerja_order_qris(
  p_code text,
  p_pending_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out record;
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_st_id uuid;
  v_st_name text := 'Dine In';
  v_cart jsonb;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet_paid(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE id = p_pending_id
    AND organization_id = v_out.organization_id
    AND pos_outlet_id = v_out.outlet_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_pending.status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_paid');
  END IF;
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;
  v_cart := COALESCE(v_pending.payload -> 'cart', '[]'::jsonb);
  IF jsonb_typeof(v_cart) <> 'array' OR jsonb_array_length(v_cart) < 1 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'lineKey', 'plain:' || COALESCE(elem ->> 'catalog_product_id', ''),
      'catalogId', elem ->> 'catalog_product_id',
      'kind', COALESCE(NULLIF(elem ->> 'item_kind', ''), 'product'),
      'serviceName', elem ->> 'service_name',
      'subServiceName', elem -> 'sub_service_name',
      'quantity', elem ->> 'quantity',
      'unitPrice', elem ->> 'unit_price',
      'variantId', elem -> 'catalog_variant_id'
    )), '[]'::jsonb)
    INTO v_cart
    FROM jsonb_array_elements(COALESCE(v_pending.payload -> 'items', '[]'::jsonb)) AS elem;
  END IF;

  IF v_pending.session_id IS NOT NULL AND v_pending.sales_activity_id IS NOT NULL THEN
    UPDATE public.pos_table_sessions
    SET sales_activity_id = COALESCE(sales_activity_id, v_pending.sales_activity_id)
    WHERE id = v_pending.session_id
      AND organization_id = v_out.organization_id
      AND outlet_id = v_out.outlet_id
      AND status = 'open';
    PERFORM public._synckerja_order_fire_kitchen(
      v_out.organization_id,
      v_out.outlet_id,
      v_pending.session_id,
      NULLIF(v_pending.payload #>> '{activity,pos_table_id}', '')::uuid,
      COALESCE(v_pending.payload #>> '{activity,table_number}', 'Walk-in'),
      v_pending.payload #>> '{activity,client_name}',
      v_cart,
      'on_pay',
      COALESCE(v_st_name, 'Dine In'),
      v_st_id
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'sales_activity_id', v_pending.sales_activity_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_qris_status(
  p_code text,
  p_pending_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out record;
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_req public.xendit_payment_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet_paid(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE id = p_pending_id
    AND organization_id = v_out.organization_id
    AND pos_outlet_id = v_out.outlet_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_req
  FROM public.xendit_payment_requests
  WHERE pos_pending_checkout_id = v_pending.id
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN jsonb_build_object(
    'ok', true,
    'status', COALESCE(v_req.status, v_pending.status),
    'sales_activity_id', COALESCE(v_pending.sales_activity_id, v_req.sales_activity_id),
    'qr_string', v_req.qr_string,
    'expires_at', v_req.expires_at
  );
END;
$$;

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
  v_blocked boolean := false;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet_paid(p_code);
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'not_found',
        'link_ordering_enabled', false,
        'maps_url', null
      );
    END IF;
    v_blocked := true;
  END IF;

  SELECT s.link_ordering_enabled, s.maps_url
    INTO v_enabled, v_maps
  FROM public.synckerja_order_outlet_settings s
  WHERE s.outlet_id = v_out.outlet_id
    AND s.organization_id = v_out.organization_id;

  RETURN jsonb_build_object(
    'ok', true,
    'link_ordering_enabled', CASE WHEN v_blocked THEN false ELSE COALESCE(v_enabled, false) END,
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
    SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet_paid(p_code);
    IF NOT FOUND THEN
      RETURN '[]'::jsonb;
    END IF;
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
