-- MCP Thinking Lab, stage 3b: add one checked Territory under a locked Big Thought,
-- and lock the Territory set. The MCP server runs the page's checks first.

CREATE OR REPLACE FUNCTION public.mcp_thinking_territory_context(
  p_user_id uuid,
  p_organization_id uuid,
  p_big_thought_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_bt public.thinking_big_thoughts%ROWTYPE;
  v_master public.thinking_master_thoughts%ROWTYPE;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  SELECT * INTO v_bt FROM public.thinking_big_thoughts
   WHERE id = p_big_thought_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_master FROM public.thinking_master_thoughts
   WHERE id = v_bt.master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'master', jsonb_build_object(
      'statement', COALESCE(v_master.statement, ''),
      'root_belief', COALESCE(v_master.root_belief, ''),
      'audience', COALESCE(v_master.audience, ''),
      'confirmed', v_master.confirmation_source IS NOT NULL
    ),
    'big_thought', jsonb_build_object(
      'id', v_bt.id, 'code', v_bt.code, 'statement', v_bt.statement, 'status', v_bt.status,
      'semantic_fingerprint', v_bt.semantic_fingerprint, 'canonical_semantic', v_bt.canonical_semantic,
      'territory_set', v_bt.territory_set
    ),
    'territories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'code', t.code, 'statement', t.statement, 'status', t.status,
        'admission', t.admission, 'sort_order', t.sort_order
      ) ORDER BY t.sort_order, t.code)
      FROM public.thinking_lab_territories t
      WHERE t.big_thought_id = v_bt.id AND t.organization_id = p_organization_id
    ), '[]'::jsonb),
    'master_codes', COALESCE((
      SELECT jsonb_agg(t.code)
      FROM public.thinking_lab_territories t
      JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id
      WHERE b.master_thought_id = v_master.id AND t.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_territory_context(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_territory_context(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_add_thinking_territory(
  p_user_id uuid,
  p_organization_id uuid,
  p_big_thought_id uuid,
  p_code text,
  p_statement text,
  p_sort_order integer,
  p_facts jsonb,
  p_territory_set jsonb,
  p_answered_question text,
  p_answered_question_version text
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
  IF btrim(COALESCE(p_statement, '')) = '' OR btrim(COALESCE(p_code, '')) = '' OR p_facts IS NULL OR p_territory_set IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.thinking_big_thoughts
   WHERE id = p_big_thought_id AND organization_id = p_organization_id AND status = 'locked'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.thinking_lab_territories (
    organization_id, big_thought_id, code, statement, sort_order, canonical_semantic, admission
  ) VALUES (
    p_organization_id, p_big_thought_id, btrim(p_code), btrim(p_statement), COALESCE(p_sort_order, 0), p_facts, 'GENERATE_VALID'
  )
  RETURNING id INTO v_id;
  UPDATE public.thinking_big_thoughts
     SET territory_set = p_territory_set,
         canonical_semantic = CASE
           WHEN btrim(COALESCE(p_answered_question, '')) <> '' AND jsonb_typeof(canonical_semantic) = 'object'
             THEN canonical_semantic
               || jsonb_build_object('answeredQuestion', btrim(p_answered_question), 'answeredQuestionVersion', p_answered_question_version)
           ELSE canonical_semantic
         END
   WHERE id = p_big_thought_id AND organization_id = p_organization_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_add_thinking_territory(uuid, uuid, uuid, text, text, integer, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_add_thinking_territory(uuid, uuid, uuid, text, text, integer, jsonb, jsonb, text, text) TO service_role;

-- p_rows: [{ "id": uuid, "fingerprint": text }] for every Territory to lock.
CREATE OR REPLACE FUNCTION public.mcp_lock_thinking_territories(
  p_user_id uuid,
  p_organization_id uuid,
  p_big_thought_id uuid,
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
  PERFORM 1 FROM public.thinking_big_thoughts
   WHERE id = p_big_thought_id AND organization_id = p_organization_id AND status = 'locked'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) LOOP
    UPDATE public.thinking_lab_territories
       SET status = 'locked', semantic_fingerprint = v_row->>'fingerprint'
     WHERE id = (v_row->>'id')::uuid
       AND organization_id = p_organization_id
       AND big_thought_id = p_big_thought_id;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_lock_thinking_territories(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_lock_thinking_territories(uuid, uuid, uuid, jsonb) TO service_role;
