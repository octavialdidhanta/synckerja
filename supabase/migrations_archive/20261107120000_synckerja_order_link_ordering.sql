-- Advertising link (mode=link) can show a cart without opening checkout.
-- Default off: the public link is browse-only until the outlet turns this on.

ALTER TABLE public.synckerja_order_outlet_settings
  ADD COLUMN IF NOT EXISTS link_ordering_enabled boolean NOT NULL DEFAULT false;

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
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'link_ordering_enabled', false);
  END IF;

  SELECT s.link_ordering_enabled INTO v_enabled
  FROM public.synckerja_order_outlet_settings s
  WHERE s.outlet_id = v_out.outlet_id
    AND s.organization_id = v_out.organization_id;

  RETURN jsonb_build_object(
    'ok', true,
    'link_ordering_enabled', COALESCE(v_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_link(text) TO anon, authenticated;
