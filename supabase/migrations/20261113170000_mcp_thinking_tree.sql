-- MCP Thinking Lab, stage 1: list Master Thoughts and read one whole tree
-- (Master Thought -> Big Thought -> Territory -> Angle -> Idea) with each
-- item's status, admission, audit verdict, and failure reason. Read only.

CREATE OR REPLACE FUNCTION public.mcp_thinking_member_guard(p_user_id uuid, p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_member_guard(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_member_guard(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_list_thinking_masters(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  statement text,
  prior_belief text,
  audience text,
  status text,
  big_thoughts integer,
  ideas integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  RETURN QUERY
  SELECT
    m.id,
    left(btrim(COALESCE(NULLIF(m.statement, ''), m.original_input, '')), 500),
    left(btrim(COALESCE(m.prior_belief, '')), 500),
    left(btrim(COALESCE(m.audience, '')), 300),
    COALESCE(m.mt_status, m.status, ''),
    (SELECT count(*)::int FROM public.thinking_big_thoughts b WHERE b.master_thought_id = m.id),
    (SELECT count(*)::int
       FROM public.thinking_lab_ideas i
       JOIN public.thinking_lab_angles a ON a.id = i.angle_id
       JOIN public.thinking_lab_territories t ON t.id = a.territory_id
       JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id
      WHERE b.master_thought_id = m.id),
    m.updated_at
  FROM public.thinking_master_thoughts m
  WHERE m.organization_id = p_organization_id
  ORDER BY m.updated_at DESC
  LIMIT 30;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_list_thinking_masters(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_thinking_masters(uuid, uuid) TO service_role;

-- Audit verdict and failure reason of one code inside a set record's audit.items.
CREATE OR REPLACE FUNCTION public.mcp_thinking_audit_item(p_set jsonb, p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'verdict', item->>'verdict',
    'reason', left(COALESCE(item->'gateFailure'->>'reason', ''), 400)
  )
  FROM jsonb_array_elements(COALESCE(p_set->'audit'->'items', '[]'::jsonb)) item
  WHERE upper(item->>'code') = upper(p_code)
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.mcp_get_thinking_tree(
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
   WHERE id = p_master_thought_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'master', jsonb_build_object(
      'id', v_master.id,
      'statement', left(btrim(COALESCE(NULLIF(v_master.statement, ''), v_master.original_input, '')), 500),
      'prior_belief', left(btrim(COALESCE(v_master.prior_belief, '')), 500),
      'audience', left(btrim(COALESCE(v_master.audience, '')), 300),
      'subject', left(COALESCE(v_master.canonical_semantic->>'subject', ''), 300),
      'status', COALESCE(v_master.mt_status, v_master.status, '')
    ),
    'big_thoughts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'code', b.code,
        'label', b.title,
        'statement', left(btrim(b.statement), 500),
        'status', b.status,
        'audit', public.mcp_thinking_audit_item(v_master.last_audit, b.code),
        'failure', NULLIF(left(COALESCE(b.canonical_semantic->'gateFailure'->>'reason', ''), 400), ''),
        'territories', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', t.id,
            'code', t.code,
            'statement', left(btrim(t.statement), 300),
            'status', t.status,
            'admission', t.admission,
            'audit', public.mcp_thinking_audit_item(b.territory_set, t.code),
            'angles', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'code', a.code,
                'statement', left(btrim(a.statement), 500),
                'status', a.status,
                'admission', a.admission,
                'audit', public.mcp_thinking_audit_item(t.angle_set, a.code),
                'ideas', COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', i.id,
                    'code', i.code,
                    'statement', left(btrim(i.statement), 600),
                    'status', i.status,
                    'admission', i.admission,
                    'decision', i.validation->>'decision',
                    'failed', (
                      SELECT jsonb_build_object('id', c->>'id', 'reason', left(COALESCE(c->>'explanation', c->>'reason', ''), 400))
                      FROM jsonb_array_elements(COALESCE(i.validation->'criteria', '[]'::jsonb)) c
                      WHERE c->>'status' <> 'PASS'
                      LIMIT 1
                    )
                  ) ORDER BY i.sort_order, i.code)
                  FROM public.thinking_lab_ideas i
                  WHERE i.angle_id = a.id AND i.organization_id = p_organization_id
                ), '[]'::jsonb)
              ) ORDER BY a.sort_order, a.code)
              FROM public.thinking_lab_angles a
              WHERE a.territory_id = t.id AND a.organization_id = p_organization_id
            ), '[]'::jsonb)
          ) ORDER BY t.sort_order, t.code)
          FROM public.thinking_lab_territories t
          WHERE t.big_thought_id = b.id AND t.organization_id = p_organization_id
        ), '[]'::jsonb)
      ) ORDER BY b.sort_order, b.code)
      FROM public.thinking_big_thoughts b
      WHERE b.master_thought_id = v_master.id AND b.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_get_thinking_tree(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_thinking_tree(uuid, uuid, uuid) TO service_role;
