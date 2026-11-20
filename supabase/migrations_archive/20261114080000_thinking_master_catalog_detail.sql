-- Master Thought catalog: the category (services row) is required to keep a belief; sub-categories
-- (sub_services) and features (product_knowledge_features) are optional and can be several, so the
-- subject check can test the subject against what the offer really has.

ALTER TABLE public.thinking_master_thoughts
  ADD COLUMN IF NOT EXISTS sub_service_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS feature_ids uuid[] NOT NULL DEFAULT '{}';

-- The sub-categories and features of one active category of the organization.
CREATE OR REPLACE FUNCTION public.mcp_thinking_catalog_options(
  p_user_id uuid,
  p_organization_id uuid,
  p_service_id uuid
)
RETURNS TABLE (kind text, id uuid, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  RETURN QUERY
  SELECT 'sub_category'::text, ss.id, btrim(ss.name)
    FROM public.sub_services ss
    JOIN public.services s ON s.id = ss.service_id
   WHERE ss.service_id = p_service_id
     AND s.organization_id = p_organization_id
     AND COALESCE(s.is_active, true) = true
  UNION ALL
  SELECT 'feature'::text, f.id, btrim(f.feature_name)
    FROM public.product_knowledge_features f
   WHERE f.organization_id = p_organization_id
     AND f.service_id = p_service_id
  ORDER BY 1, 3;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_catalog_options(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_catalog_options(uuid, uuid, uuid) TO service_role;

-- The catalog linked to one Master Thought, by name.
CREATE OR REPLACE FUNCTION public.mcp_thinking_master_catalog(
  p_user_id uuid,
  p_organization_id uuid,
  p_master_thought_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_master public.thinking_master_thoughts%ROWTYPE;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  SELECT * INTO v_master FROM public.thinking_master_thoughts
   WHERE id = p_master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'category', (SELECT btrim(s.name) FROM public.services s WHERE s.id = v_master.service_id),
    'sub_categories', COALESCE((
      SELECT jsonb_agg(btrim(ss.name) ORDER BY ss.name)
        FROM public.sub_services ss WHERE ss.id = ANY (v_master.sub_service_ids)
    ), '[]'::jsonb),
    'features', COALESCE((
      SELECT jsonb_agg(btrim(f.feature_name) ORDER BY f.feature_name)
        FROM public.product_knowledge_features f WHERE f.id = ANY (v_master.feature_ids)
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_master_catalog(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_master_catalog(uuid, uuid, uuid) TO service_role;

-- Link a Master Thought to one category, with optional sub-categories and features of that category.
DROP FUNCTION IF EXISTS public.mcp_set_thinking_master_catalog(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.mcp_set_thinking_master_catalog(
  p_user_id uuid,
  p_organization_id uuid,
  p_master_thought_id uuid,
  p_service_id uuid,
  p_sub_service_ids uuid[],
  p_feature_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_subs uuid[] := COALESCE(p_sub_service_ids, '{}');
  v_features uuid[] := COALESCE(p_feature_ids, '{}');
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  IF p_service_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.services s
     WHERE s.id = p_service_id AND s.organization_id = p_organization_id AND COALESCE(s.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_subs) sid
     WHERE NOT EXISTS (SELECT 1 FROM public.sub_services ss WHERE ss.id = sid AND ss.service_id = p_service_id)
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_features) fid
     WHERE NOT EXISTS (
       SELECT 1 FROM public.product_knowledge_features f
        WHERE f.id = fid AND f.organization_id = p_organization_id AND f.service_id = p_service_id
     )
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  UPDATE public.thinking_master_thoughts
     SET service_id = p_service_id,
         sub_service_ids = v_subs,
         feature_ids = v_features
   WHERE id = p_master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_set_thinking_master_catalog(uuid, uuid, uuid, uuid, uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_thinking_master_catalog(uuid, uuid, uuid, uuid, uuid[], uuid[]) TO service_role;
