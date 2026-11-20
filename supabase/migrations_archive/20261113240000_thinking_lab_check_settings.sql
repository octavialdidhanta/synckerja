-- Thinking Lab pass-check switches, one per check per level, per organization.
-- checks is {"<level>.<checkId>": true}. A missing key is OFF, so every check
-- starts OFF for every organization. Only an owner or admin can change them.

CREATE TABLE IF NOT EXISTS public.thinking_lab_check_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.thinking_lab_check_settings ENABLE ROW LEVEL SECURITY;
-- No direct table policies: reads and writes go through the functions below.

CREATE OR REPLACE FUNCTION public.thinking_lab_check_settings_get(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_checks jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  SELECT s.checks INTO v_checks FROM public.thinking_lab_check_settings s WHERE s.organization_id = p_organization_id;
  RETURN jsonb_build_object(
    'checks', COALESCE(v_checks, '{}'::jsonb),
    'can_edit', public.user_is_org_owner_or_admin(p_organization_id)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.thinking_lab_check_settings_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.thinking_lab_check_settings_get(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.thinking_lab_check_settings_set(p_organization_id uuid, p_checks jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_clean jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_organization_id IS NULL OR p_checks IS NULL OR jsonb_typeof(p_checks) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  -- Keep only "<level>.<id>": true entries; anything else is OFF.
  SELECT COALESCE(jsonb_object_agg(e.key, true), '{}'::jsonb) INTO v_clean
  FROM jsonb_each(p_checks) e
  WHERE e.value = 'true'::jsonb
    AND e.key ~ '^(master|bigThought|territory|angle|idea)\.[A-Za-z0-9]{1,40}$';
  INSERT INTO public.thinking_lab_check_settings (organization_id, checks, updated_by, updated_at)
  VALUES (p_organization_id, v_clean, auth.uid(), now())
  ON CONFLICT (organization_id) DO UPDATE
    SET checks = EXCLUDED.checks, updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN jsonb_build_object('checks', v_clean, 'can_edit', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.thinking_lab_check_settings_set(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.thinking_lab_check_settings_set(uuid, jsonb) TO authenticated;

-- MCP read (service role, membership checked by the shared guard).
CREATE OR REPLACE FUNCTION public.mcp_thinking_check_settings(p_user_id uuid, p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_checks jsonb;
BEGIN
  PERFORM public.mcp_thinking_member_guard(p_user_id, p_organization_id);
  SELECT s.checks INTO v_checks FROM public.thinking_lab_check_settings s WHERE s.organization_id = p_organization_id;
  RETURN COALESCE(v_checks, '{}'::jsonb);
END;
$fn$;

REVOKE ALL ON FUNCTION public.mcp_thinking_check_settings(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_thinking_check_settings(uuid, uuid) TO service_role;
