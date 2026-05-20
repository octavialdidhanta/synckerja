-- Direct WhatsApp / omnichannel drafts: allow lead_submissions without a website form_id.

ALTER TABLE public.lead_submissions
  ALTER COLUMN form_id DROP NOT NULL;

COMMENT ON COLUMN public.lead_submissions.form_id IS
  'Optional FK to website capture form. NULL for omnichannel-only leads (e.g. WhatsApp) with no website submission.';

-- Return NULL when no reusable form_id exists (no exception).
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
    RETURN NULL;
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

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text) IS
  'Returns a reusable form_id when the org has website-form submissions; NULL for WA-only orgs.';
