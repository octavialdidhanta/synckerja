-- Public location screen lists the organization's other order outlets.

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

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_branches(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_branches(text) TO anon, authenticated;
