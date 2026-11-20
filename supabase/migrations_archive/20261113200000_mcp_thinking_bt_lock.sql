-- MCP Thinking Lab: Big Thought facts in the context, and Lock for the Big Thought set.

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
        'status', b.status, 'sort_order', b.sort_order,
        'canonical_semantic', b.canonical_semantic, 'semantic_fingerprint', b.semantic_fingerprint
      ) ORDER BY b.sort_order, b.code)
      FROM public.thinking_big_thoughts b
      WHERE b.master_thought_id = v_master.id AND b.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mcp_lock_thinking_big_thoughts(
  p_user_id uuid,
  p_organization_id uuid,
  p_master_thought_id uuid,
  p_big_thought_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  PERFORM 1 FROM public.thinking_master_thoughts
   WHERE id = p_master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab'
     AND confirmation_source IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.thinking_big_thoughts
     SET status = 'locked'
   WHERE id = ANY(COALESCE(p_big_thought_ids, '{}'::uuid[]))
     AND organization_id = p_organization_id
     AND master_thought_id = p_master_thought_id
     AND status = 'candidate';
  UPDATE public.thinking_master_thoughts
     SET mt_status = 'locked', status = 'locked'
   WHERE id = p_master_thought_id AND organization_id = p_organization_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_lock_thinking_big_thoughts(uuid, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_lock_thinking_big_thoughts(uuid, uuid, uuid, uuid[]) TO service_role;
