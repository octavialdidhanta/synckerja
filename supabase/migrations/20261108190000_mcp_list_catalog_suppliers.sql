-- MCP: find suppliers by name so the assistant can pass supplier_id to
-- inventory.purchase_order.preview. Returns id, name, phone, city only; bank details stay out.

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_suppliers(
  p_user_id uuid,
  p_organization_id uuid,
  p_search text
)
RETURNS TABLE (id uuid, name text, phone text, city text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_search IS NOT NULL AND char_length(v_search) > 80 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, NULLIF(btrim(s.phone), ''), NULLIF(btrim(s.city), '')
  FROM public.catalog_suppliers s
  WHERE s.organization_id = p_organization_id
    AND s.is_deleted = false
    AND (
      v_search IS NULL
      OR s.name ILIKE '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  ORDER BY
    CASE WHEN v_search IS NOT NULL AND lower(btrim(s.name)) = lower(v_search) THEN 0 ELSE 1 END,
    s.name
  LIMIT 50;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_catalog_suppliers(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_suppliers(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
