-- Render drafts kept on the server so still previews and the full-render preview can be called with a short
-- draft_id (+ a small patch) instead of sending the whole spec again each time. Drafts expire after 7 days.

CREATE TABLE IF NOT EXISTS public.mcp_render_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  plan_id uuid NULL,
  spec jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS mcp_render_drafts_org_idx ON public.mcp_render_drafts (organization_id, created_at DESC);

ALTER TABLE public.mcp_render_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_render_drafts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mcp_save_render_draft(
  p_user_id uuid,
  p_organization_id uuid,
  p_title text,
  p_plan_id uuid,
  p_spec jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $save_draft$
DECLARE
  v_row public.mcp_render_drafts%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  IF p_spec IS NULL OR jsonb_typeof(p_spec) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF octet_length(p_spec::text) > 512000 THEN
    RAISE EXCEPTION 'invalid_input: spec too large';
  END IF;
  DELETE FROM public.mcp_render_drafts WHERE expires_at < now();
  INSERT INTO public.mcp_render_drafts (organization_id, user_id, title, plan_id, spec)
  VALUES (p_organization_id, p_user_id, left(coalesce(p_title, ''), 200), p_plan_id, p_spec)
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('draft_id', v_row.id, 'expires_at', v_row.expires_at);
END;
$save_draft$;

CREATE OR REPLACE FUNCTION public.mcp_get_render_draft(p_user_id uuid, p_organization_id uuid, p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_draft$
DECLARE
  v_row public.mcp_render_drafts%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  SELECT * INTO v_row FROM public.mcp_render_drafts
  WHERE id = p_draft_id AND organization_id = p_organization_id AND expires_at >= now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_not_found';
  END IF;
  RETURN jsonb_build_object('draft_id', v_row.id, 'title', v_row.title, 'plan_id', v_row.plan_id, 'spec', v_row.spec,
    'expires_at', v_row.expires_at);
END;
$get_draft$;

-- A patch overwrites the same draft (same draft_id), so there is only ever one current version.
CREATE OR REPLACE FUNCTION public.mcp_update_render_draft(
  p_user_id uuid,
  p_organization_id uuid,
  p_draft_id uuid,
  p_title text,
  p_plan_id uuid,
  p_spec jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $update_draft$
DECLARE
  v_row public.mcp_render_drafts%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  IF p_spec IS NULL OR jsonb_typeof(p_spec) <> 'object' OR octet_length(p_spec::text) > 512000 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  UPDATE public.mcp_render_drafts
  SET spec = p_spec, title = left(coalesce(p_title, title), 200), plan_id = p_plan_id,
      expires_at = now() + interval '7 days'
  WHERE id = p_draft_id AND organization_id = p_organization_id AND expires_at >= now()
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_not_found';
  END IF;
  RETURN jsonb_build_object('draft_id', v_row.id, 'expires_at', v_row.expires_at);
END;
$update_draft$;

REVOKE ALL ON FUNCTION public.mcp_save_render_draft(uuid, uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_save_render_draft(uuid, uuid, text, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_get_render_draft(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_render_draft(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_update_render_draft(uuid, uuid, uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_render_draft(uuid, uuid, uuid, text, uuid, jsonb) TO service_role;
