-- Livechat Resolve creates draft lead_submissions for WA-only leads (no website form submit).
-- form_id is NOT NULL (FK to website capture forms). Reuse an existing form_id for the org/web_id.

CREATE OR REPLACE FUNCTION public.resolve_form_id_for_omnichannel_submission(
  p_organization_id uuid,
  p_web_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id uuid;
  v_web text := nullif(btrim(coalesce(p_web_id, '')), '');
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'form_id_required_for_submission' USING ERRCODE = 'P0001';
  END IF;

  IF v_web IS NOT NULL THEN
    SELECT s.form_id
    INTO v_form_id
    FROM public.lead_submissions s
    WHERE s.organization_id = p_organization_id
      AND s.form_id IS NOT NULL
      AND s.web_id = v_web
    ORDER BY s.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_form_id IS NOT NULL THEN
      RETURN v_form_id;
    END IF;
  END IF;

  SELECT s.form_id
  INTO v_form_id
  FROM public.lead_submissions s
  WHERE s.organization_id = p_organization_id
    AND s.form_id IS NOT NULL
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_form_id IS NOT NULL THEN
    RETURN v_form_id;
  END IF;

  RAISE EXCEPTION 'form_id_required_for_submission' USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text) IS
  'Pick form_id for omnichannel draft lead_submissions (WA livechat). Uses latest submission for org/web_id.';

REVOKE ALL ON FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text) TO authenticated, service_role;
