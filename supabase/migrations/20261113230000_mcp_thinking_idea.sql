-- MCP Thinking Lab, stage 3d: add one checked Idea under a locked Angle.

CREATE OR REPLACE FUNCTION public.mcp_thinking_idea_context(
  p_user_id uuid,
  p_organization_id uuid,
  p_angle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_a public.thinking_lab_angles%ROWTYPE;
  v_t public.thinking_lab_territories%ROWTYPE;
  v_bt public.thinking_big_thoughts%ROWTYPE;
  v_master public.thinking_master_thoughts%ROWTYPE;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  SELECT * INTO v_a FROM public.thinking_lab_angles WHERE id = p_angle_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_t FROM public.thinking_lab_territories WHERE id = v_a.territory_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_bt FROM public.thinking_big_thoughts WHERE id = v_t.big_thought_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_master FROM public.thinking_master_thoughts
   WHERE id = v_bt.master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'master', jsonb_build_object(
      'statement', COALESCE(v_master.statement, ''),
      'root_belief', COALESCE(v_master.root_belief, ''),
      'audience', COALESCE(v_master.audience, ''),
      'prior_belief', COALESCE(v_master.prior_belief, ''),
      'subject', COALESCE(v_master.canonical_semantic->>'subject', '')
    ),
    'big_thought', jsonb_build_object(
      'id', v_bt.id, 'statement', v_bt.statement, 'status', v_bt.status, 'semantic_fingerprint', v_bt.semantic_fingerprint
    ),
    'territory', jsonb_build_object(
      'id', v_t.id, 'statement', v_t.statement, 'status', v_t.status,
      'semantic_fingerprint', v_t.semantic_fingerprint, 'big_thought_id', v_t.big_thought_id
    ),
    'angle', jsonb_build_object(
      'id', v_a.id, 'code', v_a.code, 'statement', v_a.statement, 'status', v_a.status,
      'semantic_fingerprint', v_a.semantic_fingerprint, 'territory_id', v_a.territory_id, 'idea_set', v_a.idea_set
    ),
    -- Every Idea under this Master Thought: the history for K5 and the no-twins-across-branches rule.
    'ideas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'code', i.code, 'statement', i.statement, 'angle_id', i.angle_id,
        'admission', i.admission, 'status', i.status, 'sort_order', i.sort_order, 'validation', i.validation
      ) ORDER BY i.created_at DESC)
      FROM public.thinking_lab_ideas i
      JOIN public.thinking_lab_angles a ON a.id = i.angle_id
      JOIN public.thinking_lab_territories t ON t.id = a.territory_id
      JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id
      WHERE b.master_thought_id = v_master.id AND i.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_idea_context(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_idea_context(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_add_thinking_idea(
  p_user_id uuid,
  p_organization_id uuid,
  p_angle_id uuid,
  p_code text,
  p_statement text,
  p_sort_order integer,
  p_parent_fingerprint text,
  p_facts jsonb,
  p_validation jsonb,
  p_idea_set jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  IF btrim(COALESCE(p_statement, '')) = '' OR btrim(COALESCE(p_code, '')) = '' OR p_facts IS NULL OR p_validation IS NULL OR p_idea_set IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.thinking_lab_angles
   WHERE id = p_angle_id AND organization_id = p_organization_id AND status = 'locked'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.thinking_lab_ideas (
    organization_id, angle_id, code, statement, sort_order, parent_angle_fingerprint,
    canonical_semantic, admission, status, semantic_fingerprint, parent_idea_id, validation
  ) VALUES (
    p_organization_id, p_angle_id, btrim(p_code), btrim(p_statement), COALESCE(p_sort_order, 0), p_parent_fingerprint,
    p_facts, 'GENERATE_VALID', 'candidate', NULL, NULL, p_validation
  )
  RETURNING id INTO v_id;
  UPDATE public.thinking_lab_angles SET idea_set = p_idea_set
   WHERE id = p_angle_id AND organization_id = p_organization_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_add_thinking_idea(uuid, uuid, uuid, text, text, integer, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_add_thinking_idea(uuid, uuid, uuid, text, text, integer, text, jsonb, jsonb, jsonb) TO service_role;
