-- MCP Thinking Lab: write the chosen content pillars (development paths) of one locked, passed Idea.
-- The server builds the whole development_paths array; this function only checks access and stores it.

CREATE OR REPLACE FUNCTION public.mcp_set_thinking_idea_paths(
  p_user_id uuid,
  p_organization_id uuid,
  p_idea_id uuid,
  p_paths jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  IF p_idea_id IS NULL OR p_paths IS NULL OR jsonb_typeof(p_paths) <> 'array' OR jsonb_array_length(p_paths) > 60 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  UPDATE public.thinking_lab_ideas idea
     SET development_paths = p_paths,
         updated_at = now()
   WHERE idea.id = p_idea_id
     AND idea.organization_id = p_organization_id
     AND idea.status = 'locked'
     AND idea.validation->>'decision' = 'LOLOS';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_set_thinking_idea_paths(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_set_thinking_idea_paths(uuid, uuid, uuid, jsonb) TO service_role;

-- Lock the passing Ideas of one locked Angle (pillars need a locked Idea).
CREATE OR REPLACE FUNCTION public.mcp_lock_thinking_ideas(
  p_user_id uuid,
  p_organization_id uuid,
  p_angle_id uuid,
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
  PERFORM 1 FROM public.thinking_lab_angles
   WHERE id = p_angle_id AND organization_id = p_organization_id AND status = 'locked'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) LOOP
    UPDATE public.thinking_lab_ideas
       SET status = 'locked', semantic_fingerprint = v_row->>'fingerprint'
     WHERE id = (v_row->>'id')::uuid AND organization_id = p_organization_id AND angle_id = p_angle_id;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_lock_thinking_ideas(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_lock_thinking_ideas(uuid, uuid, uuid, jsonb) TO service_role;
