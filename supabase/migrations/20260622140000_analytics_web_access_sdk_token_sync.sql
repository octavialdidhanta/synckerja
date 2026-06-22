-- Sync analytics_web_access.is_approved with active SDK omnichannel API tokens.

CREATE OR REPLACE FUNCTION public.sync_analytics_web_access_for_web_id(
  p_organization_id uuid,
  p_web_id text,
  p_created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_web_id text := lower(trim(p_web_id));
  v_has_active_sdk boolean;
BEGIN
  IF v_web_id IS NULL OR length(v_web_id) = 0 THEN
    RAISE EXCEPTION 'web_id wajib diisi.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_omnichannel_api_tokens t
    WHERE t.organization_id = p_organization_id
      AND t.web_id = v_web_id
      AND t.token_type = 'sdk'
      AND t.is_active = true
      AND (t.expires_at IS NULL OR t.expires_at > now())
  ) INTO v_has_active_sdk;

  IF v_has_active_sdk THEN
    INSERT INTO public.analytics_web_access (organization_id, web_id, created_by, is_approved)
    VALUES (p_organization_id, v_web_id, p_created_by, true)
    ON CONFLICT (organization_id, web_id) DO UPDATE SET
      is_approved = true;
  ELSE
    UPDATE public.analytics_web_access
    SET is_approved = false
    WHERE organization_id = p_organization_id
      AND web_id = v_web_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_analytics_web_access_for_web_id(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_analytics_web_access_for_web_id(uuid, text, uuid) TO service_role;

-- Backward-compatible wrapper (approve-only callers).
CREATE OR REPLACE FUNCTION public.ensure_analytics_web_access_for_org(
  p_organization_id uuid,
  p_web_id text,
  p_created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_analytics_web_access_for_web_id(
    p_organization_id,
    p_web_id,
    p_created_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_analytics_web_access_for_org(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_analytics_web_access_for_org(uuid, text, uuid) TO service_role;

-- Backfill: pending rows where an active SDK token already exists.
UPDATE public.analytics_web_access awa
SET is_approved = true
WHERE is_approved = false
  AND EXISTS (
    SELECT 1
    FROM public.organization_omnichannel_api_tokens t
    WHERE t.organization_id = awa.organization_id
      AND t.web_id = awa.web_id
      AND t.token_type = 'sdk'
      AND t.is_active = true
      AND (t.expires_at IS NULL OR t.expires_at > now())
  );

COMMENT ON FUNCTION public.sync_analytics_web_access_for_web_id(uuid, text, uuid) IS
  'Sets analytics_web_access.is_approved true when org has an active non-expired SDK token for web_id; otherwise false.';
