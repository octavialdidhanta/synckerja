-- Google Maps link for the advertising storefront (mode=link).
-- The public page shows this map instead of the guest profile.

ALTER TABLE public.synckerja_order_outlet_settings
  ADD COLUMN IF NOT EXISTS maps_url text;

ALTER TABLE public.synckerja_order_outlet_settings
  DROP CONSTRAINT IF EXISTS synckerja_order_outlet_settings_maps_url_len;
ALTER TABLE public.synckerja_order_outlet_settings
  ADD CONSTRAINT synckerja_order_outlet_settings_maps_url_len
  CHECK (
    maps_url IS NULL
    OR (char_length(maps_url) BETWEEN 12 AND 2000 AND maps_url ~ '^https://')
  );

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

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_link(text) TO anon, authenticated;
