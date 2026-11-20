-- Several banner photos per outlet. The order page slides them every 5 seconds.
-- cover_path stays the first photo so an older client still shows one image.

ALTER TABLE public.synckerja_order_outlet_settings
  ADD COLUMN IF NOT EXISTS cover_paths text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.synckerja_order_cover_paths_ok(paths text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $ok$
  SELECT COALESCE(cardinality(paths), 0) <= 8
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(paths, ARRAY[]::text[])) AS item
      WHERE item IS NULL
        OR char_length(btrim(item)) < 1
        OR char_length(item) > 500
    );
$ok$;

ALTER TABLE public.synckerja_order_outlet_settings
  DROP CONSTRAINT IF EXISTS synckerja_order_outlet_settings_cover_paths_ok;
ALTER TABLE public.synckerja_order_outlet_settings
  ADD CONSTRAINT synckerja_order_outlet_settings_cover_paths_ok
  CHECK (public.synckerja_order_cover_paths_ok(cover_paths));

CREATE OR REPLACE FUNCTION public.synckerja_order_sync_outlet_cover_paths()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $sync$
BEGIN
  IF NEW.cover_paths IS NULL THEN
    NEW.cover_paths := '{}';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF cardinality(NEW.cover_paths) > 0 THEN
      NEW.cover_path := NULLIF(btrim(NEW.cover_paths[1]), '');
    ELSIF NULLIF(btrim(NEW.cover_path), '') IS NOT NULL THEN
      NEW.cover_paths := ARRAY[btrim(NEW.cover_path)];
      NEW.cover_path := btrim(NEW.cover_path);
    ELSE
      NEW.cover_paths := '{}';
      NEW.cover_path := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.cover_paths IS DISTINCT FROM OLD.cover_paths THEN
    NEW.cover_path := NULLIF(btrim(NEW.cover_paths[1]), '');
  ELSIF NEW.cover_path IS DISTINCT FROM OLD.cover_path THEN
    IF NULLIF(btrim(NEW.cover_path), '') IS NULL THEN
      NEW.cover_paths := '{}';
      NEW.cover_path := NULL;
    ELSE
      NEW.cover_paths := ARRAY[btrim(NEW.cover_path)];
      NEW.cover_path := btrim(NEW.cover_path);
    END IF;
  END IF;
  RETURN NEW;
END;
$sync$;

DROP TRIGGER IF EXISTS synckerja_order_outlet_cover_paths_sync ON public.synckerja_order_outlet_settings;
CREATE TRIGGER synckerja_order_outlet_cover_paths_sync
  BEFORE INSERT OR UPDATE OF cover_path, cover_paths
  ON public.synckerja_order_outlet_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.synckerja_order_sync_outlet_cover_paths();

UPDATE public.synckerja_order_outlet_settings
SET cover_paths = ARRAY[btrim(cover_path)]
WHERE cover_path IS NOT NULL
  AND btrim(cover_path) <> ''
  AND cardinality(cover_paths) = 0;

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
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
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
      RETURN jsonb_build_object(
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
END;
$rpc$;
