-- MCP Thinking Lab, update from chat: read one Master Thought's whole subtree with the fields
-- needed to rewrite fingerprints, and apply one batch of row changes inside that subtree.

CREATE OR REPLACE FUNCTION public.mcp_thinking_subtree(p_user_id uuid, p_organization_id uuid, p_master_thought_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_master jsonb;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  SELECT jsonb_build_object(
    'id', m.id, 'statement', m.statement, 'root_belief', m.root_belief, 'prior_belief', m.prior_belief,
    'audience', m.audience, 'status', m.status, 'mt_status', m.mt_status,
    'semantic_fingerprint', m.semantic_fingerprint, 'last_audit', m.last_audit, 'canonical_semantic', m.canonical_semantic
  ) INTO v_master
  FROM public.thinking_master_thoughts m
  WHERE m.id = p_master_thought_id AND m.organization_id = p_organization_id AND m.workspace = 'thinking_lab';
  IF v_master IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'master', v_master,
    'big_thoughts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'code', b.code, 'title', b.title, 'statement', b.statement, 'status', b.status,
        'semantic_fingerprint', b.semantic_fingerprint, 'territory_set', b.territory_set, 'canonical_semantic', b.canonical_semantic
      ) ORDER BY b.sort_order)
      FROM public.thinking_big_thoughts b
      WHERE b.master_thought_id = p_master_thought_id AND b.organization_id = p_organization_id), '[]'::jsonb),
    'territories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'code', t.code, 'big_thought_id', t.big_thought_id, 'statement', t.statement, 'status', t.status,
        'admission', t.admission, 'semantic_fingerprint', t.semantic_fingerprint, 'angle_set', t.angle_set,
        'canonical_semantic', t.canonical_semantic
      ) ORDER BY t.sort_order)
      FROM public.thinking_lab_territories t
      JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id AND b.organization_id = t.organization_id
      WHERE b.master_thought_id = p_master_thought_id AND t.organization_id = p_organization_id), '[]'::jsonb),
    'angles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'code', a.code, 'territory_id', a.territory_id, 'statement', a.statement, 'status', a.status,
        'admission', a.admission, 'semantic_fingerprint', a.semantic_fingerprint,
        'parent_territory_fingerprint', a.parent_territory_fingerprint, 'idea_set', a.idea_set,
        'canonical_semantic', a.canonical_semantic
      ) ORDER BY a.sort_order)
      FROM public.thinking_lab_angles a
      JOIN public.thinking_lab_territories t ON t.id = a.territory_id AND t.organization_id = a.organization_id
      JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id AND b.organization_id = a.organization_id
      WHERE b.master_thought_id = p_master_thought_id AND a.organization_id = p_organization_id), '[]'::jsonb),
    'ideas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'code', i.code, 'angle_id', i.angle_id, 'statement', i.statement, 'status', i.status,
        'admission', i.admission, 'semantic_fingerprint', i.semantic_fingerprint,
        'parent_angle_fingerprint', i.parent_angle_fingerprint, 'validation', i.validation,
        'canonical_semantic', i.canonical_semantic
      ) ORDER BY i.sort_order)
      FROM public.thinking_lab_ideas i
      JOIN public.thinking_lab_angles a ON a.id = i.angle_id AND a.organization_id = i.organization_id
      JOIN public.thinking_lab_territories t ON t.id = a.territory_id AND t.organization_id = i.organization_id
      JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id AND b.organization_id = i.organization_id
      WHERE b.master_thought_id = p_master_thought_id AND i.organization_id = p_organization_id), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_subtree(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_subtree(uuid, uuid, uuid) TO service_role;

-- One batch of changes inside one Master Thought's subtree, in one transaction. Only the keys present
-- in each change are written. A row outside the subtree raises not_found and nothing is written.
CREATE OR REPLACE FUNCTION public.mcp_thinking_apply(
  p_user_id uuid,
  p_organization_id uuid,
  p_master_thought_id uuid,
  p_changes jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v jsonb;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.thinking_master_thoughts
   WHERE id = p_master_thought_id AND organization_id = p_organization_id AND workspace = 'thinking_lab'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  v := p_changes->'master';
  IF v IS NOT NULL AND jsonb_typeof(v) = 'object' THEN
    UPDATE public.thinking_master_thoughts SET
      statement = CASE WHEN v ? 'statement' THEN btrim(v->>'statement') ELSE statement END,
      root_belief = CASE WHEN v ? 'root_belief' THEN v->>'root_belief' ELSE root_belief END,
      prior_belief = CASE WHEN v ? 'prior_belief' THEN v->>'prior_belief' ELSE prior_belief END,
      audience = CASE WHEN v ? 'audience' THEN v->>'audience' ELSE audience END,
      canonical_semantic = CASE WHEN v ? 'canonical_semantic' THEN v->'canonical_semantic' ELSE canonical_semantic END,
      semantic_fingerprint = CASE WHEN v ? 'semantic_fingerprint' THEN v->>'semantic_fingerprint' ELSE semantic_fingerprint END,
      last_audit = CASE WHEN v ? 'last_audit' THEN v->'last_audit' ELSE last_audit END,
      updated_at = now()
    WHERE id = p_master_thought_id AND organization_id = p_organization_id;
  END IF;

  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_changes->'big_thoughts', '[]'::jsonb)) LOOP
    UPDATE public.thinking_big_thoughts b SET
      statement = CASE WHEN v ? 'statement' THEN btrim(v->>'statement') ELSE b.statement END,
      title = CASE WHEN v ? 'title' THEN v->>'title' ELSE b.title END,
      canonical_semantic = CASE WHEN v ? 'canonical_semantic' THEN v->'canonical_semantic' ELSE b.canonical_semantic END,
      semantic_fingerprint = CASE WHEN v ? 'semantic_fingerprint' THEN v->>'semantic_fingerprint' ELSE b.semantic_fingerprint END,
      territory_set = CASE WHEN v ? 'territory_set' THEN v->'territory_set' ELSE b.territory_set END,
      updated_at = now()
    WHERE b.id = (v->>'id')::uuid AND b.organization_id = p_organization_id AND b.master_thought_id = p_master_thought_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  END LOOP;

  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_changes->'territories', '[]'::jsonb)) LOOP
    UPDATE public.thinking_lab_territories t SET
      statement = CASE WHEN v ? 'statement' THEN btrim(v->>'statement') ELSE t.statement END,
      canonical_semantic = CASE WHEN v ? 'canonical_semantic' THEN v->'canonical_semantic' ELSE t.canonical_semantic END,
      semantic_fingerprint = CASE WHEN v ? 'semantic_fingerprint' THEN v->>'semantic_fingerprint' ELSE t.semantic_fingerprint END,
      angle_set = CASE WHEN v ? 'angle_set' THEN v->'angle_set' ELSE t.angle_set END,
      updated_at = now()
    FROM public.thinking_big_thoughts b
    WHERE t.id = (v->>'id')::uuid AND t.organization_id = p_organization_id
      AND b.id = t.big_thought_id AND b.master_thought_id = p_master_thought_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  END LOOP;

  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_changes->'angles', '[]'::jsonb)) LOOP
    UPDATE public.thinking_lab_angles a SET
      statement = CASE WHEN v ? 'statement' THEN btrim(v->>'statement') ELSE a.statement END,
      canonical_semantic = CASE WHEN v ? 'canonical_semantic' THEN v->'canonical_semantic' ELSE a.canonical_semantic END,
      semantic_fingerprint = CASE WHEN v ? 'semantic_fingerprint' THEN v->>'semantic_fingerprint' ELSE a.semantic_fingerprint END,
      parent_territory_fingerprint = CASE WHEN v ? 'parent_territory_fingerprint' THEN v->>'parent_territory_fingerprint' ELSE a.parent_territory_fingerprint END,
      idea_set = CASE WHEN v ? 'idea_set' THEN v->'idea_set' ELSE a.idea_set END,
      updated_at = now()
    FROM public.thinking_lab_territories t
    JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id
    WHERE a.id = (v->>'id')::uuid AND a.organization_id = p_organization_id
      AND t.id = a.territory_id AND b.master_thought_id = p_master_thought_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  END LOOP;

  FOR v IN SELECT * FROM jsonb_array_elements(COALESCE(p_changes->'ideas', '[]'::jsonb)) LOOP
    UPDATE public.thinking_lab_ideas i SET
      statement = CASE WHEN v ? 'statement' THEN btrim(v->>'statement') ELSE i.statement END,
      canonical_semantic = CASE WHEN v ? 'canonical_semantic' THEN v->'canonical_semantic' ELSE i.canonical_semantic END,
      semantic_fingerprint = CASE WHEN v ? 'semantic_fingerprint' THEN v->>'semantic_fingerprint' ELSE i.semantic_fingerprint END,
      parent_angle_fingerprint = CASE WHEN v ? 'parent_angle_fingerprint' THEN v->>'parent_angle_fingerprint' ELSE i.parent_angle_fingerprint END,
      validation = CASE WHEN v ? 'validation' THEN v->'validation' ELSE i.validation END,
      updated_at = now()
    FROM public.thinking_lab_angles a
    JOIN public.thinking_lab_territories t ON t.id = a.territory_id
    JOIN public.thinking_big_thoughts b ON b.id = t.big_thought_id
    WHERE i.id = (v->>'id')::uuid AND i.organization_id = p_organization_id
      AND a.id = i.angle_id AND b.master_thought_id = p_master_thought_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_apply(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_apply(uuid, uuid, uuid, jsonb) TO service_role;
