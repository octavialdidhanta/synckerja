-- MCP Thinking Lab, stage 2: create a confirmed Master Thought and add one
-- checked Big Thought. The MCP server runs the same pass checks as the
-- Thinking Lab page before it calls these. Execute is for service_role only.

CREATE OR REPLACE FUNCTION public.mcp_create_thinking_master(
  p_user_id uuid,
  p_organization_id uuid,
  p_statement text,
  p_prior_belief text,
  p_audience text,
  p_facts jsonb,
  p_fingerprint text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
  v_statement text := btrim(COALESCE(p_statement, ''));
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  IF v_statement = '' OR btrim(COALESCE(p_prior_belief, '')) = '' OR p_facts IS NULL OR btrim(COALESCE(p_fingerprint, '')) = '' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.thinking_master_thoughts (
    organization_id, statement, original_input, prior_belief, audience, root_belief,
    confirmation_source, confirmed_at, mt_status, status, workspace,
    canonical_semantic, semantic_fingerprint, created_by
  ) VALUES (
    p_organization_id, v_statement, v_statement, btrim(p_prior_belief), btrim(COALESCE(p_audience, '')), v_statement,
    'original', now(), 'confirmed', 'draft', 'thinking_lab',
    p_facts, p_fingerprint, p_user_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_create_thinking_master(uuid, uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_thinking_master(uuid, uuid, text, text, text, jsonb, text) TO service_role;

-- What the server needs to check a new Big Thought against its Master Thought and siblings.
CREATE OR REPLACE FUNCTION public.mcp_thinking_big_thought_context(
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
    'statement', COALESCE(v_master.statement, ''),
    'root_belief', COALESCE(v_master.root_belief, ''),
    'subject', COALESCE(v_master.canonical_semantic->>'subject', ''),
    'confirmed', v_master.confirmation_source IS NOT NULL,
    'locked', COALESCE(v_master.mt_status, '') = 'locked',
    'last_audit', v_master.last_audit,
    'big_thoughts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'code', b.code, 'label', b.title, 'statement', b.statement,
        'status', b.status, 'sort_order', b.sort_order
      ) ORDER BY b.sort_order, b.code)
      FROM public.thinking_big_thoughts b
      WHERE b.master_thought_id = v_master.id AND b.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_big_thought_context(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_big_thought_context(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_add_thinking_big_thought(
  p_user_id uuid,
  p_organization_id uuid,
  p_master_thought_id uuid,
  p_code text,
  p_label text,
  p_statement text,
  p_sort_order integer,
  p_facts jsonb,
  p_fingerprint text,
  p_last_audit jsonb
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
  IF btrim(COALESCE(p_statement, '')) = '' OR btrim(COALESCE(p_code, '')) = '' OR p_facts IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.thinking_master_thoughts
   WHERE id = p_master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab'
     AND confirmation_source IS NOT NULL AND COALESCE(mt_status, '') <> 'locked'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.thinking_big_thoughts (
    organization_id, master_thought_id, code, title, statement, core_belief, boundary, axis,
    meaning, ownership_label, ownership_statement, reason_slot_label, reason_slot_explanation,
    function_type, claim_type, sort_order, status, canonical_semantic, semantic_fingerprint
  ) VALUES (
    p_organization_id, p_master_thought_id, btrim(p_code), btrim(COALESCE(p_label, '')), btrim(p_statement), '', '', '',
    '', '', '', '', '', '', '', COALESCE(p_sort_order, 0), 'candidate', p_facts, p_fingerprint
  )
  RETURNING id INTO v_id;
  IF p_last_audit IS NOT NULL THEN
    UPDATE public.thinking_master_thoughts
       SET last_audit = p_last_audit, last_audit_at = now()
     WHERE id = p_master_thought_id AND organization_id = p_organization_id;
  END IF;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_add_thinking_big_thought(uuid, uuid, uuid, text, text, text, integer, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_add_thinking_big_thought(uuid, uuid, uuid, text, text, text, integer, jsonb, text, jsonb) TO service_role;
