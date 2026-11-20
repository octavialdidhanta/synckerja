-- Synckerja Order: public_code, org/outlet/catalog settings, anon RPCs scoped by code.

-- ---------------------------------------------------------------------------
-- pos_outlets.public_code (globally unique, 6 chars a-z0-9)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pos_outlets
  ADD COLUMN IF NOT EXISTS public_code text;

ALTER TABLE public.pos_outlets
  DROP CONSTRAINT IF EXISTS pos_outlets_public_code_format;

ALTER TABLE public.pos_outlets
  ADD CONSTRAINT pos_outlets_public_code_format
  CHECK (public_code IS NULL OR public_code ~ '^[a-z0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_outlets_public_code
  ON public.pos_outlets (public_code)
  WHERE public_code IS NOT NULL AND is_deleted = false;

CREATE OR REPLACE FUNCTION public.generate_pos_outlet_public_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_i int := 0;
BEGIN
  LOOP
    v_i := v_i + 1;
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr('abcdefghijklmnopqrstuvwxyz0123456789', 1 + floor(random() * 36)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pos_outlets o
      WHERE o.public_code = v_code AND o.is_deleted = false
    );
    IF v_i > 40 THEN
      RAISE EXCEPTION 'public_code_generate_failed';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_outlets_assign_public_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_code IS NULL OR btrim(NEW.public_code) = '' THEN
    NEW.public_code := public.generate_pos_outlet_public_code();
  ELSE
    NEW.public_code := lower(btrim(NEW.public_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_outlets_assign_public_code ON public.pos_outlets;
CREATE TRIGGER trg_pos_outlets_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.pos_outlets
  FOR EACH ROW EXECUTE FUNCTION public.pos_outlets_assign_public_code();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.pos_outlets
    WHERE public_code IS NULL AND is_deleted = false
  LOOP
    UPDATE public.pos_outlets
    SET public_code = public.generate_pos_outlet_public_code()
    WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Settings tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.synckerja_order_org_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  terms_accepted_at timestamptz,
  terms_version text,
  business_name text NOT NULL DEFAULT '',
  logo_path text,
  cover_path text,
  contact_phone text,
  contact_email text,
  contact_whatsapp text,
  contact_instagram text,
  terms_html text,
  pickup_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.synckerja_order_outlet_settings (
  outlet_id uuid PRIMARY KEY REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_synckerja_order_outlet_settings_org
  ON public.synckerja_order_outlet_settings (organization_id);

CREATE TABLE IF NOT EXISTS public.synckerja_order_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT synckerja_order_catalog_items_unique UNIQUE (outlet_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_synckerja_order_catalog_org_outlet
  ON public.synckerja_order_catalog_items (organization_id, outlet_id);

DROP TRIGGER IF EXISTS update_synckerja_order_org_settings_updated_at ON public.synckerja_order_org_settings;
CREATE TRIGGER update_synckerja_order_org_settings_updated_at
  BEFORE UPDATE ON public.synckerja_order_org_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_synckerja_order_outlet_settings_updated_at ON public.synckerja_order_outlet_settings;
CREATE TRIGGER update_synckerja_order_outlet_settings_updated_at
  BEFORE UPDATE ON public.synckerja_order_outlet_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.synckerja_order_org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synckerja_order_outlet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synckerja_order_catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS synckerja_order_org_settings_select ON public.synckerja_order_org_settings;
CREATE POLICY synckerja_order_org_settings_select
  ON public.synckerja_order_org_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
DROP POLICY IF EXISTS synckerja_order_org_settings_write ON public.synckerja_order_org_settings;
CREATE POLICY synckerja_order_org_settings_ins
  ON public.synckerja_order_org_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY synckerja_order_org_settings_upd
  ON public.synckerja_order_org_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_outlet_settings_select ON public.synckerja_order_outlet_settings;
CREATE POLICY synckerja_order_outlet_settings_select
  ON public.synckerja_order_outlet_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY synckerja_order_outlet_settings_ins
  ON public.synckerja_order_outlet_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY synckerja_order_outlet_settings_upd
  ON public.synckerja_order_outlet_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_catalog_items_select ON public.synckerja_order_catalog_items;
CREATE POLICY synckerja_order_catalog_items_select
  ON public.synckerja_order_catalog_items FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY synckerja_order_catalog_items_ins
  ON public.synckerja_order_catalog_items FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY synckerja_order_catalog_items_del
  ON public.synckerja_order_catalog_items FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
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
SET search_path = public
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

CREATE OR REPLACE FUNCTION public._synckerja_order_org_actor(p_org uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.organization_id = p_org
    AND lower(ur.role::text) IN ('owner', 'admin')
  ORDER BY CASE WHEN lower(ur.role::text) = 'owner' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_sanitize_cart(
  p_org uuid,
  p_outlet uuid,
  p_cart jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line jsonb;
  v_out jsonb := '[]'::jsonb;
  v_item public.default_prices%ROWTYPE;
  v_qty numeric;
  v_price numeric;
  v_name text;
BEGIN
  IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_cart)
  LOOP
    v_qty := GREATEST(1, floor(COALESCE((v_line ->> 'quantity')::numeric, 1)));
    SELECT dp.* INTO v_item
    FROM public.default_prices dp
    JOIN public.synckerja_order_catalog_items ci
      ON ci.catalog_item_id = dp.id
     AND ci.outlet_id = p_outlet
     AND ci.organization_id = p_org
    WHERE dp.id = NULLIF(v_line ->> 'catalogId', '')::uuid
      AND dp.organization_id = p_org
      AND COALESCE(dp.pos_status, 'available') <> 'hidden'
    LIMIT 1;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    v_price := COALESCE(v_item.unit_price, 0);
    v_name := COALESCE(NULLIF(v_item.name, ''), COALESCE(v_line ->> 'serviceName', 'Item'));
    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'lineKey', COALESCE(NULLIF(v_line ->> 'lineKey', ''), 'plain:' || v_item.id::text),
        'catalogId', v_item.id,
        'kind', COALESCE(NULLIF(v_item.kind, ''), 'product'),
        'serviceId', v_item.service_id,
        'subServiceId', v_item.sub_service_id,
        'serviceName', v_name,
        'subServiceName', v_line -> 'subServiceName',
        'quantity', v_qty,
        'unitPrice', v_price,
        'trackStock', COALESCE(v_item.track_stock, false),
        'inventorySkuId', v_item.inventory_sku_id,
        'availableQty', NULL,
        'productCategoryId', v_item.product_category_id,
        'variantId', NULLIF(v_line ->> 'variantId', ''),
        'variantName', NULLIF(v_line ->> 'variantName', '')
      )
    );
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_cart_subtotal(p_cart jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(SUM(
    GREATEST(0, COALESCE((elem ->> 'quantity')::numeric, 0))
    * GREATEST(0, COALESCE((elem ->> 'unitPrice')::numeric, 0))
  ), 0)
  FROM jsonb_array_elements(COALESCE(p_cart, '[]'::jsonb)) AS elem;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_checkout_totals(p_org uuid, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax numeric := 0;
  v_grat numeric := 0;
  v_settings public.catalog_checkout_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings
  FROM public.catalog_checkout_settings
  WHERE organization_id = p_org;
  IF COALESCE(v_settings.tax_enabled, false) THEN
    SELECT COALESCE(SUM(p_subtotal * amount_percent / 100.0), 0) INTO v_tax
    FROM public.catalog_taxes
    WHERE organization_id = p_org AND is_active = true;
  END IF;
  IF COALESCE(v_settings.gratuity_enabled, false) THEN
    SELECT COALESCE(SUM(p_subtotal * amount_percent / 100.0), 0) INTO v_grat
    FROM public.catalog_gratuities
    WHERE organization_id = p_org AND is_active = true;
  END IF;
  v_tax := round(v_tax);
  v_grat := round(v_grat);
  RETURN jsonb_build_object(
    'subtotal', p_subtotal,
    'taxBase', p_subtotal,
    'taxLines', '[]'::jsonb,
    'gratuityLines', '[]'::jsonb,
    'taxTotal', v_tax,
    'gratuityTotal', v_grat,
    'grandTotal', p_subtotal + v_tax + v_grat,
    'applicationMethod', COALESCE(v_settings.application_method, 'add')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_table_state(
  p_org uuid,
  p_outlet uuid,
  p_table_name text
)
RETURNS TABLE (
  table_id uuid,
  table_name text,
  group_id uuid,
  table_pax int,
  occupied_pax int,
  remaining_pax int,
  open_session_id uuid,
  join_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.pos_tables%ROWTYPE;
  v_occ int := 0;
  v_session uuid;
BEGIN
  IF p_table_name IS NULL OR btrim(p_table_name) = '' THEN
    RETURN;
  END IF;
  SELECT t.* INTO v_table
  FROM public.pos_tables t
  WHERE t.organization_id = p_org
    AND t.outlet_id = p_outlet
    AND t.is_deleted = false
    AND lower(btrim(t.name)) = lower(btrim(p_table_name))
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM(s.pax), 0) INTO v_occ
  FROM public.pos_table_sessions s
  WHERE s.organization_id = p_org
    AND s.outlet_id = p_outlet
    AND s.pos_table_id = v_table.id
    AND s.status = 'open';
  SELECT s.id INTO v_session
  FROM public.pos_table_sessions s
  WHERE s.organization_id = p_org
    AND s.outlet_id = p_outlet
    AND s.pos_table_id = v_table.id
    AND s.status = 'open'
    AND s.sales_activity_id IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;
  IF v_session IS NULL THEN
    SELECT s.id INTO v_session
    FROM public.pos_table_sessions s
    WHERE s.organization_id = p_org
      AND s.outlet_id = p_outlet
      AND s.pos_table_id = v_table.id
      AND s.status = 'open'
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;
  table_id := v_table.id;
  table_name := v_table.name;
  group_id := v_table.group_id;
  table_pax := v_table.pax;
  occupied_pax := v_occ;
  remaining_pax := GREATEST(0, v_table.pax - v_occ);
  open_session_id := v_session;
  IF v_occ <= 0 THEN
    join_state := 'empty';
  ELSIF remaining_pax >= 1 THEN
    join_state := 'join';
  ELSE
    join_state := 'full';
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_fire_kitchen(
  p_org uuid,
  p_outlet uuid,
  p_session uuid,
  p_table_id uuid,
  p_table_name text,
  p_customer_name text,
  p_cart jsonb,
  p_event text,
  p_sales_type_label text,
  p_sales_type_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy text;
  v_should boolean := false;
  v_had boolean := false;
  v_ticket uuid;
  v_line jsonb;
  v_sort int := 0;
BEGIN
  SELECT COALESCE(kitchen_fire_by_sales_type ->> 'dine_in', 'save_bill')
  INTO v_policy
  FROM public.pos_kitchen_outlet_settings
  WHERE organization_id = p_org AND outlet_id = p_outlet
  LIMIT 1;
  v_policy := COALESCE(v_policy, 'save_bill');

  SELECT EXISTS (
    SELECT 1 FROM public.pos_kitchen_tickets t
    WHERE t.session_id = p_session AND t.status IN ('new', 'in_progress', 'ready', 'done')
  ) INTO v_had;

  IF p_event = 'save_bill' THEN
    v_should := (v_policy = 'save_bill');
  ELSIF p_event = 'on_pay' THEN
    v_should := (v_policy = 'on_pay') OR (v_policy = 'save_bill' AND NOT v_had);
  END IF;
  IF NOT v_should THEN
    RETURN;
  END IF;
  IF jsonb_array_length(COALESCE(p_cart, '[]'::jsonb)) < 1 THEN
    RETURN;
  END IF;

  INSERT INTO public.pos_kitchen_tickets (
    organization_id, outlet_id, session_id, pos_table_id, table_name,
    customer_name, sales_type_id, sales_type_label, status
  ) VALUES (
    p_org, p_outlet, p_session, p_table_id, COALESCE(NULLIF(btrim(p_table_name), ''), 'Walk-in'),
    NULLIF(btrim(COALESCE(p_customer_name, '')), ''), p_sales_type_id, p_sales_type_label, 'new'
  ) RETURNING id INTO v_ticket;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_cart)
  LOOP
    IF COALESCE(v_line ->> 'kind', 'product') <> 'product' THEN
      CONTINUE;
    END IF;
    v_sort := v_sort + 1;
    INSERT INTO public.pos_kitchen_ticket_lines (
      ticket_id, line_fingerprint, display_name, modifiers_text, quantity, sort_index
    ) VALUES (
      v_ticket,
      COALESCE(NULLIF(v_line ->> 'lineKey', ''), 'plain:' || COALESCE(v_line ->> 'catalogId', '')),
      COALESCE(NULLIF(v_line ->> 'serviceName', ''), 'Item'),
      NULLIF(v_line ->> 'variantName', ''),
      GREATEST(1, floor(COALESCE((v_line ->> 'quantity')::numeric, 1))::int),
      v_sort
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_store(
  p_code text,
  p_table_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_org public.synckerja_order_org_settings%ROWTYPE;
  v_tbl record;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_org FROM public.synckerja_order_org_settings WHERE organization_id = v_out.organization_id;
  IF p_table_name IS NOT NULL AND btrim(p_table_name) <> '' THEN
    SELECT * INTO v_tbl FROM public._synckerja_order_table_state(v_out.organization_id, v_out.outlet_id, p_table_name);
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'public_code', v_out.public_code,
        'outlet_id', v_out.outlet_id,
        'outlet_name', v_out.outlet_name,
        'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
        'logo_path', v_org.logo_path,
        'cover_path', v_org.cover_path,
        'pickup_enabled', v_org.pickup_enabled,
        'table', NULL,
        'table_error', 'not_found'
      );
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'public_code', v_out.public_code,
    'outlet_id', v_out.outlet_id,
    'outlet_name', v_out.outlet_name,
    'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
    'logo_path', v_org.logo_path,
    'cover_path', v_org.cover_path,
    'pickup_enabled', v_org.pickup_enabled,
    'table', CASE WHEN v_tbl.table_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_tbl.table_id,
      'name', v_tbl.table_name,
      'pax', v_tbl.table_pax,
      'remaining_pax', v_tbl.remaining_pax,
      'join', v_tbl.join_state,
      'session_id', v_tbl.open_session_id
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_catalog(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_items jsonb;
  v_cats jsonb;
  v_st_id uuid;
  v_st_name text := 'Dine In';
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'categories', '[]'::jsonb, 'items', '[]'::jsonb);
  END IF;
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id
    AND st.is_active = true
    AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order
  LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', dp.id,
    'name', COALESCE(dp.name, 'Item'),
    'description', dp.description,
    'unit_price', COALESCE(dp.unit_price, 0),
    'photo_path', dp.photo_path,
    'product_category_id', dp.product_category_id,
    'product_category_name', c.name,
    'pos_status', COALESCE(dp.pos_status, 'available'),
    'kind', COALESCE(dp.kind, 'product'),
    'service_id', dp.service_id,
    'sub_service_id', dp.sub_service_id,
    'track_stock', COALESCE(dp.track_stock, false),
    'inventory_sku_id', dp.inventory_sku_id,
    'available_qty', NULL,
    'variants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price) ORDER BY v.sort_order)
      FROM public.catalog_product_variants v
      WHERE v.product_id = dp.id
    ), '[]'::jsonb)
  ) ORDER BY ci.sort_order, dp.name), '[]'::jsonb)
  INTO v_items
  FROM public.synckerja_order_catalog_items ci
  JOIN public.default_prices dp ON dp.id = ci.catalog_item_id AND dp.organization_id = v_out.organization_id
  LEFT JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
  WHERE ci.outlet_id = v_out.outlet_id
    AND COALESCE(dp.pos_status, 'available') <> 'hidden';

  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name)), '[]'::jsonb)
  INTO v_cats
  FROM public.synckerja_order_catalog_items ci
  JOIN public.default_prices dp ON dp.id = ci.catalog_item_id
  JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
  WHERE ci.outlet_id = v_out.outlet_id;

  RETURN jsonb_build_object(
    'ok', true,
    'categories', v_cats,
    'items', v_items,
    'dine_in_sales_type_id', v_st_id,
    'dine_in_sales_type_label', COALESCE(v_st_name, 'Dine In')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_pay_later(
  p_code text,
  p_table_name text,
  p_guest_name text,
  p_cart jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_tbl record;
  v_cart jsonb;
  v_session uuid;
  v_st_id uuid;
  v_st_name text := 'Dine In';
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_tbl FROM public._synckerja_order_table_state(v_out.organization_id, v_out.outlet_id, p_table_name);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_not_found');
  END IF;
  IF v_tbl.join_state = 'full' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_full');
  END IF;
  v_cart := public._synckerja_order_sanitize_cart(v_out.organization_id, v_out.outlet_id, p_cart);
  IF jsonb_array_length(v_cart) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_cart');
  END IF;
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;

  IF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    UPDATE public.pos_table_sessions
    SET
      cart_snapshot = COALESCE(cart_snapshot, '[]'::jsonb) || v_cart,
      pax = pax + 1,
      customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(btrim(COALESCE(p_guest_name, '')), ''))
    WHERE id = v_tbl.open_session_id
      AND organization_id = v_out.organization_id
      AND outlet_id = v_out.outlet_id
      AND status = 'open'
    RETURNING id INTO v_session;
  ELSE
    INSERT INTO public.pos_table_sessions (
      organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
      status, cart_snapshot, customer_name
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
      'open', v_cart, NULLIF(btrim(COALESCE(p_guest_name, '')), '')
    ) RETURNING id INTO v_session;
  END IF;

  PERFORM public._synckerja_order_fire_kitchen(
    v_out.organization_id, v_out.outlet_id, v_session, v_tbl.table_id, v_tbl.table_name,
    p_guest_name, v_cart, 'save_bill', COALESCE(v_st_name, 'Dine In'), v_st_id
  );
  RETURN jsonb_build_object('ok', true, 'session_id', v_session);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_create_qris(
  p_code text,
  p_table_name text,
  p_guest_name text,
  p_cart jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_tbl record;
  v_cart jsonb;
  v_session uuid;
  v_subtotal numeric;
  v_totals jsonb;
  v_payload jsonb;
  v_pending uuid;
  v_actor uuid;
  v_lead uuid;
  v_st_id uuid;
  v_st_name text := 'Dine In';
  v_client text;
  v_items jsonb := '[]'::jsonb;
  v_line jsonb;
  v_status uuid;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_tbl FROM public._synckerja_order_table_state(v_out.organization_id, v_out.outlet_id, p_table_name);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_not_found');
  END IF;
  IF v_tbl.join_state = 'full' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_full');
  END IF;
  v_cart := public._synckerja_order_sanitize_cart(v_out.organization_id, v_out.outlet_id, p_cart);
  IF jsonb_array_length(v_cart) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_cart');
  END IF;
  v_subtotal := public._synckerja_order_cart_subtotal(v_cart);
  v_totals := public._synckerja_order_checkout_totals(v_out.organization_id, v_subtotal);
  IF COALESCE((v_totals ->> 'grandTotal')::numeric, 0) < 1500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pos_qris_amount_too_low');
  END IF;
  v_actor := public._synckerja_order_org_actor(v_out.organization_id);
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_ready');
  END IF;
  v_client := COALESCE(NULLIF(btrim(p_guest_name), ''), 'Walk-in');
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;
  SELECT id INTO v_status FROM public.lead_statuses
  WHERE organization_id = v_out.organization_id OR organization_id IS NULL
  ORDER BY sort_order ASC LIMIT 1;

  INSERT INTO public.leads (
    ticket_id, client, title, category, created_by, created_by_name, assignee,
    status_id, organization_id, source, followup
  ) VALUES (
    'pos-walkin-' || gen_random_uuid()::text,
    v_client,
    'POS Walk-in',
    'POS',
    v_actor,
    'Synckerja Order',
    '',
    v_status,
    v_out.organization_id,
    'POS',
    0
  ) RETURNING id INTO v_lead;

  IF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    v_session := v_tbl.open_session_id;
    UPDATE public.pos_table_sessions
    SET pax = pax + 1,
        customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(v_client, 'Walk-in'))
    WHERE id = v_session AND status = 'open';
  ELSE
    INSERT INTO public.pos_table_sessions (
      organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
      status, cart_snapshot, customer_name
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
      'open', '[]'::jsonb, NULLIF(v_client, 'Walk-in')
    ) RETURNING id INTO v_session;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_cart)
  LOOP
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'service_id', v_line -> 'serviceId',
      'sub_service_id', v_line -> 'subServiceId',
      'service_name', v_line ->> 'serviceName',
      'sub_service_name', v_line -> 'subServiceName',
      'quantity', (v_line ->> 'quantity')::numeric,
      'unit_price', (v_line ->> 'unitPrice')::numeric,
      'total_price', (v_line ->> 'quantity')::numeric * (v_line ->> 'unitPrice')::numeric,
      'notes', NULL,
      'item_kind', 'product',
      'inventory_sku_id', v_line -> 'inventorySkuId',
      'track_stock', COALESCE((v_line ->> 'trackStock')::boolean, false),
      'catalog_product_id', v_line ->> 'catalogId',
      'catalog_variant_id', v_line -> 'variantId',
      'catalog_bundle_id', NULL,
      'catalog_sales_type_id', v_st_id,
      'unit_cogs', NULL,
      'cogs_source', 'none'
    ));
  END LOOP;

  v_payload := jsonb_build_object(
    'activity', jsonb_build_object(
      'lead_id', v_lead,
      'client_name', v_client,
      'client_phone', NULL,
      'date', CURRENT_DATE,
      'created_by', v_actor,
      'total_amount', (v_totals ->> 'grandTotal')::numeric,
      'table_number', v_tbl.table_name,
      'pos_table_id', v_tbl.table_id,
      'catalog_sales_type_id', v_st_id,
      'checkout_subtotal', (v_totals ->> 'subtotal')::numeric,
      'checkout_tax_amount', (v_totals ->> 'taxTotal')::numeric,
      'checkout_gratuity_amount', (v_totals ->> 'gratuityTotal')::numeric,
      'checkout_application_method', v_totals ->> 'applicationMethod',
      'checkout_discount_amount', 0,
      'description', 'Synckerja Order'
    ),
    'items', v_items,
    'modifiers', '[]'::jsonb,
    'discounts', '[]'::jsonb,
    'catalogStockLines', '[]'::jsonb,
    'checkoutTotals', v_totals,
    'leadId', v_lead,
    'sessionId', v_session,
    'keepSessionOpen', true,
    'remainderCartLines', '[]'::jsonb
  );

  INSERT INTO public.pos_pending_checkouts (
    organization_id, pos_outlet_id, status, payload, lead_id, session_id,
    keep_session_open, expires_at, created_by
  ) VALUES (
    v_out.organization_id, v_out.outlet_id, 'pending', v_payload, v_lead, v_session,
    true, now() + interval '90 seconds', v_actor
  ) RETURNING id INTO v_pending;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_checkout_id', v_pending,
    'session_id', v_session
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_qris_status(
  p_code text,
  p_pending_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_req public.xendit_payment_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
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

CREATE OR REPLACE FUNCTION public.complete_synckerja_order_qris(
  p_code text,
  p_pending_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_st_id uuid;
  v_st_name text := 'Dine In';
  v_cart jsonb;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
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
  v_cart := COALESCE(v_pending.payload -> 'items', '[]'::jsonb);
  -- Map finalize items back to cart-like lines for kitchen fingerprint.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lineKey', 'plain:' || COALESCE(elem ->> 'catalog_product_id', ''),
    'catalogId', elem ->> 'catalog_product_id',
    'kind', 'product',
    'serviceName', elem ->> 'service_name',
    'quantity', elem ->> 'quantity',
    'unitPrice', elem ->> 'unit_price'
  )), '[]'::jsonb)
  INTO v_cart
  FROM jsonb_array_elements(COALESCE(v_pending.payload -> 'items', '[]'::jsonb)) AS elem;

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

REVOKE ALL ON FUNCTION public._synckerja_order_resolve_outlet(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_org_actor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_sanitize_cart(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_checkout_totals(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_table_state(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_fire_kitchen(uuid, uuid, uuid, uuid, text, text, jsonb, text, text, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_store(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_store(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_synckerja_order_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_catalog(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_pay_later(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_pay_later(text, text, text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_synckerja_order_qris_status(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_qris_status(text, uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_synckerja_order_qris(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_synckerja_order_qris(text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Page access + default admin permission
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_configuration_defaults (
  page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
VALUES (
  '/operations/synckerja-order',
  'Operations — POS — Synckerja Order',
  true,
  ARRAY['owner', 'admin', 'hr']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id, page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/operations/synckerja-order'
  AND NOT EXISTS (
    SELECT 1 FROM public.permission_configurations p
    WHERE p.organization_id = o.id AND p.page_path = d.page_path
  );

CREATE OR REPLACE FUNCTION public.pos_default_admin_permission_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'app.pos.charge',
    'app.pos.manage_open_bills',
    'app.pos.discounts',
    'app.pos.refunds',
    'app.pos.void_cancel',
    'app.pos.resend_receipt',
    'app.shift.view_print',
    'app.shift.cash_movement',
    'app.settings.view',
    'app.settings.edit',
    'app.customers.edit',
    'app.table_map',
    'app.online_orders',
    'app.inventory',
    'app.kitchen_display',
    'bo.library',
    'bo.library.products',
    'bo.library.bundles',
    'bo.library.categories',
    'bo.library.brands',
    'bo.library.modifiers',
    'bo.library.promos',
    'bo.library.discounts',
    'bo.library.sales_types',
    'bo.library.taxes',
    'bo.library.gratuity',
    'bo.ingredient',
    'bo.ingredient.list',
    'bo.ingredient.categories',
    'bo.ingredient.recipes',
    'bo.settings',
    'bo.settings.outlets',
    'bo.settings.checkout',
    'bo.settings.receipt',
    'bo.settings.email_notifications',
    'bo.settings.inventory',
    'bo.settings.bank_account',
    'bo.customers',
    'bo.customers.list',
    'bo.customers.feedback',
    'bo.employees',
    'bo.employees.slots',
    'bo.employees.access',
    'bo.employees.pin_access',
    'bo.table_management',
    'bo.table_management.group',
    'bo.table_management.map',
    'bo.table_management.report',
    'bo.synckerja_order',
    'bo.dashboard',
    'bo.reports',
    'bo.reports.sales',
    'bo.reports.transactions',
    'bo.reports.invoices',
    'bo.reports.shift',
    'bo.inventory',
    'bo.inventory.summary',
    'bo.inventory.suppliers',
    'bo.inventory.purchase_orders',
    'bo.inventory.transfer',
    'bo.inventory.adjustments',
    'bo.inventory.sync_logs'
  ]::text[];
$$;

INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
SELECT r.id, 'bo.synckerja_order'
FROM public.pos_employee_roles r
WHERE r.slug = 'administrator'
  AND NOT EXISTS (
    SELECT 1 FROM public.pos_employee_role_permissions p
    WHERE p.role_id = r.id AND p.permission_key = 'bo.synckerja_order'
  );
