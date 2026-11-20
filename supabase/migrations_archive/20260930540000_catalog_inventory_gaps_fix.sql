-- Inventory settings v1.1: cancel transfer role gate + cleanup stale feature_access rows on save.

CREATE OR REPLACE FUNCTION public.upsert_catalog_inventory_settings(
  p_organization_id uuid,
  p_po_mode text,
  p_transfer_mode text,
  p_feature_access jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_key text;
  v_roles text[];
  v_po_keys text[] := ARRAY['po_request', 'po_approval', 'po_fulfillment'];
  v_transfer_keys text[] := ARRAY[
    'transfer_request', 'transfer_approval', 'transfer_shipment', 'transfer_fulfillment'
  ];
  v_required text[];
  v_present text[] := '{}'::text[];
  v_active_keys text[] := '{}'::text[];
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_po_mode NOT IN ('simple', 'advanced') OR p_transfer_mode NOT IN ('simple', 'advanced') THEN
    RAISE EXCEPTION 'catalog_inventory_mode_invalid';
  END IF;

  v_required := ARRAY[]::text[];
  IF p_po_mode = 'advanced' THEN
    v_required := v_required || v_po_keys;
  END IF;
  IF p_transfer_mode = 'advanced' THEN
    v_required := v_required || v_transfer_keys;
  END IF;
  v_active_keys := v_required;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_feature_access, '[]'::jsonb))
  LOOP
    v_key := NULLIF(btrim(v_item ->> 'feature_key'), '');
    IF v_key IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(DISTINCT r ORDER BY r), '{}'::text[])
      INTO v_roles
    FROM unnest(
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(v_item -> 'allowed_roles')),
        '{}'::text[]
      )
    ) AS r
    WHERE r IN ('owner', 'admin', 'hr', 'employee');

    IF v_key = ANY (v_required) AND COALESCE(array_length(v_roles, 1), 0) = 0 THEN
      RAISE EXCEPTION 'catalog_inventory_access_roles_required';
    END IF;

    v_present := array_append(v_present, v_key);

    INSERT INTO public.catalog_inventory_feature_access (
      organization_id,
      feature_key,
      allowed_roles
    ) VALUES (
      p_organization_id,
      v_key,
      v_roles
    )
    ON CONFLICT (organization_id, feature_key) DO UPDATE SET
      allowed_roles = EXCLUDED.allowed_roles,
      updated_at = now();
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM unnest(v_required) AS req(key)
    WHERE NOT (req.key = ANY (v_present))
  ) THEN
    RAISE EXCEPTION 'catalog_inventory_access_roles_required';
  END IF;

  INSERT INTO public.catalog_inventory_settings (
    organization_id,
    po_mode,
    transfer_mode
  ) VALUES (
    p_organization_id,
    p_po_mode,
    p_transfer_mode
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    po_mode = EXCLUDED.po_mode,
    transfer_mode = EXCLUDED.transfer_mode,
    updated_at = now();

  DELETE FROM public.catalog_inventory_feature_access fa
  WHERE fa.organization_id = p_organization_id
    AND (
      COALESCE(array_length(v_active_keys, 1), 0) = 0
      OR NOT (fa.feature_key = ANY (v_active_keys))
    );

  RETURN public.get_or_create_catalog_inventory_settings(p_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_catalog_stock_transfer(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.catalog_stock_transfers%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_transfer_forbidden';
  END IF;

  IF public.catalog_inventory_transfer_mode(p_organization_id) = 'advanced'
    AND NOT (
      public.user_has_inventory_feature_access(p_organization_id, 'transfer_request')
      OR public.user_has_inventory_feature_access(p_organization_id, 'transfer_approval')
    )
  THEN
    RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
  END IF;

  SELECT * INTO v_transfer
  FROM public.catalog_stock_transfers
  WHERE id = p_transfer_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_transfer_not_found';
  END IF;
  IF v_transfer.status NOT IN ('pending_approval', 'approved') THEN
    RAISE EXCEPTION 'catalog_transfer_invalid_status';
  END IF;

  UPDATE public.catalog_stock_transfers
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    updated_at = now()
  WHERE id = v_transfer.id;

  PERFORM public.catalog_transfer_insert_event(v_transfer.id, p_organization_id, 'cancelled', p_comment);

  RETURN to_jsonb((SELECT t FROM public.catalog_stock_transfers t WHERE t.id = v_transfer.id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_catalog_inventory_settings(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_catalog_stock_transfer(uuid, uuid, text) TO authenticated;
