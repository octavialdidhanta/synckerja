-- Thinking Lab ↔ Daftar Klaim. A claim backs an Angle (the argument) and, optionally, a Master Thought (a new belief).
-- The link is a product_claim_uses row: module thinking_lab, ref_id "angle:<id>" or "master:<id>", so it also shows as
-- Jejak pemakaian. Office writes these rows directly (RLS by organization); the MCP uses the functions below.
-- An Execution inherits the claims of its Angle and Master Thought; a plan from it is refused while any of them
-- is not approved (mcp_thinking_chain_claims gives the list to check).

CREATE OR REPLACE FUNCTION public.thinking_claim_target_ok(p_organization_id uuid, p_target text, p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE p_target
    WHEN 'angle' THEN EXISTS (SELECT 1 FROM public.thinking_lab_angles a WHERE a.id = p_target_id AND a.organization_id = p_organization_id)
    WHEN 'master' THEN EXISTS (SELECT 1 FROM public.thinking_master_thoughts m WHERE m.id = p_target_id AND m.organization_id = p_organization_id)
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.thinking_claim_target_ok(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Replace the claims linked to one Angle or Master Thought. Returns the linked claims and the codes it did not know.
CREATE OR REPLACE FUNCTION public.mcp_set_thinking_claim_links(p_user_id uuid, p_organization_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target text := p_input->>'target';
  v_target_id uuid;
  v_ref text;
  v_codes text[];
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  BEGIN
    v_target_id := (p_input->>'target_id')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;
  IF v_target NOT IN ('angle', 'master') OR v_target_id IS NULL
     OR jsonb_typeof(p_input->'codes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'codes') > 20 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT public.thinking_claim_target_ok(p_organization_id, v_target, v_target_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  v_ref := v_target || ':' || v_target_id::text;
  SELECT COALESCE(array_agg(DISTINCT upper(btrim(c))), '{}'::text[]) INTO v_codes FROM jsonb_array_elements_text(p_input->'codes') c;

  DELETE FROM public.product_claim_uses u
  WHERE u.organization_id = p_organization_id AND u.module = 'thinking_lab' AND u.ref_id = v_ref;

  INSERT INTO public.product_claim_uses (organization_id, claim_id, module, ref_id, label, created_by)
  SELECT p_organization_id, pc.id, 'thinking_lab', v_ref, NULLIF(left(btrim(COALESCE(p_input->>'label', '')), 300), ''), p_user_id
  FROM public.product_claims pc
  WHERE pc.organization_id = p_organization_id AND pc.code = ANY (v_codes);

  RETURN jsonb_build_object(
    'claims', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', pc.code, 'text', pc.text, 'status', pc.status) ORDER BY pc.seq)
      FROM public.product_claim_uses u JOIN public.product_claims pc ON pc.id = u.claim_id
      WHERE u.organization_id = p_organization_id AND u.module = 'thinking_lab' AND u.ref_id = v_ref
    ), '[]'::jsonb),
    'unknown_codes', to_jsonb(ARRAY(
      SELECT c FROM unnest(v_codes) c
      WHERE NOT EXISTS (SELECT 1 FROM public.product_claims pc WHERE pc.organization_id = p_organization_id AND pc.code = c)
    ))
  );
END;
$$;

-- The claims an Idea's Execution inherits: those of its Angle and its Master Thought. Input: idea_id or execution_id.
CREATE OR REPLACE FUNCTION public.mcp_thinking_chain_claims(p_user_id uuid, p_organization_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_angle uuid;
  v_master uuid;
  v_idea uuid;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  BEGIN
    v_idea := NULLIF(p_input->>'idea_id', '')::uuid;
    IF v_idea IS NULL AND NULLIF(p_input->>'execution_id', '') IS NOT NULL THEN
      SELECT e.idea_id INTO v_idea FROM public.thinking_lab_executions e
      WHERE e.id = (p_input->>'execution_id')::uuid AND e.organization_id = p_organization_id;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;
  SELECT i.angle_id, b.master_thought_id INTO v_angle, v_master
  FROM public.thinking_lab_ideas i
  JOIN public.thinking_lab_angles a ON a.id = i.angle_id
  JOIN public.thinking_lab_territories t ON t.id = a.territory_id
  JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id
  WHERE i.id = v_idea AND i.organization_id = p_organization_id;
  IF v_angle IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'idea_id', v_idea,
    'angle_id', v_angle,
    'master_thought_id', v_master,
    'claims', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('code', pc.code, 'text', pc.text, 'status', pc.status, 'from', split_part(u.ref_id, ':', 1)))
      FROM public.product_claim_uses u JOIN public.product_claims pc ON pc.id = u.claim_id
      WHERE u.organization_id = p_organization_id AND u.module = 'thinking_lab'
        AND u.ref_id IN ('angle:' || v_angle::text, 'master:' || COALESCE(v_master::text, '-'))
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_set_thinking_claim_links(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_thinking_chain_claims(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_thinking_claim_links(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_chain_claims(uuid, uuid, jsonb) TO service_role;
