-- MCP Thinking Lab, stage 3c: add one checked Angle under a locked Territory, and lock Angles.

CREATE OR REPLACE FUNCTION public.mcp_thinking_angle_context(
  p_user_id uuid,
  p_organization_id uuid,
  p_territory_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_t public.thinking_lab_territories%ROWTYPE;
  v_bt public.thinking_big_thoughts%ROWTYPE;
  v_master public.thinking_master_thoughts%ROWTYPE;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  SELECT * INTO v_t FROM public.thinking_lab_territories WHERE id = p_territory_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_bt FROM public.thinking_big_thoughts WHERE id = v_t.big_thought_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_master FROM public.thinking_master_thoughts
   WHERE id = v_bt.master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab';
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'master', jsonb_build_object(
      'statement', COALESCE(v_master.statement, ''),
      'root_belief', COALESCE(v_master.root_belief, '')
    ),
    'big_thought', jsonb_build_object(
      'id', v_bt.id, 'statement', v_bt.statement, 'status', v_bt.status, 'semantic_fingerprint', v_bt.semantic_fingerprint
    ),
    'territory', jsonb_build_object(
      'id', v_t.id, 'code', v_t.code, 'statement', v_t.statement, 'status', v_t.status,
      'semantic_fingerprint', v_t.semantic_fingerprint, 'big_thought_id', v_t.big_thought_id, 'angle_set', v_t.angle_set
    ),
    'angles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'code', a.code, 'statement', a.statement, 'status', a.status, 'admission', a.admission,
        'sort_order', a.sort_order, 'subject', COALESCE(a.canonical_semantic->>'subject', '')
      ) ORDER BY a.sort_order, a.code)
      FROM public.thinking_lab_angles a
      WHERE a.territory_id = v_t.id AND a.organization_id = p_organization_id
    ), '[]'::jsonb),
    'master_codes', COALESCE((
      SELECT jsonb_agg(a.code)
      FROM public.thinking_lab_angles a
      JOIN public.thinking_lab_territories t ON t.id = a.territory_id
      JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id
      WHERE b.master_thought_id = v_master.id AND a.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_angle_context(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_angle_context(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_add_thinking_angle(
  p_user_id uuid,
  p_organization_id uuid,
  p_territory_id uuid,
  p_code text,
  p_statement text,
  p_sort_order integer,
  p_parent_fingerprint text,
  p_facts jsonb,
  p_angle_set jsonb
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
  IF btrim(COALESCE(p_statement, '')) = '' OR btrim(COALESCE(p_code, '')) = '' OR p_facts IS NULL OR p_angle_set IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.thinking_lab_territories
   WHERE id = p_territory_id AND organization_id = p_organization_id AND status = 'locked'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.thinking_lab_angles (
    organization_id, territory_id, code, statement, sort_order, parent_territory_fingerprint,
    canonical_semantic, admission, status, semantic_fingerprint
  ) VALUES (
    p_organization_id, p_territory_id, btrim(p_code), btrim(p_statement), COALESCE(p_sort_order, 0), p_parent_fingerprint,
    p_facts, 'GENERATE_VALID', 'candidate', NULL
  )
  RETURNING id INTO v_id;
  UPDATE public.thinking_lab_territories SET angle_set = p_angle_set
   WHERE id = p_territory_id AND organization_id = p_organization_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_add_thinking_angle(uuid, uuid, uuid, text, text, integer, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_add_thinking_angle(uuid, uuid, uuid, text, text, integer, text, jsonb, jsonb) TO service_role;

-- p_rows: [{ "id": uuid, "fingerprint": text }]
CREATE OR REPLACE FUNCTION public.mcp_lock_thinking_angles(
  p_user_id uuid,
  p_organization_id uuid,
  p_territory_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row jsonb;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  PERFORM 1 FROM public.thinking_lab_territories
   WHERE id = p_territory_id AND organization_id = p_organization_id AND status = 'locked'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) LOOP
    UPDATE public.thinking_lab_angles
       SET status = 'locked', semantic_fingerprint = v_row->>'fingerprint'
     WHERE id = (v_row->>'id')::uuid AND organization_id = p_organization_id AND territory_id = p_territory_id;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_lock_thinking_angles(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_lock_thinking_angles(uuid, uuid, uuid, jsonb) TO service_role;
