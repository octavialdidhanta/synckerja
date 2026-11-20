-- Leads table sync columns: show when OAuth + account exist, regardless of uploads toggle (is_active).

CREATE OR REPLACE FUNCTION public.is_google_ads_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_google_ads_connections c
    INNER JOIN public.organization_google_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_google_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_google_ads_connected(uuid) IS
  'True when org has Google Ads OAuth and at least one active customer account (uploads toggle may still be off).';

GRANT EXECUTE ON FUNCTION public.is_google_ads_connected(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_meta_ads_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_connections c
    INNER JOIN public.organization_meta_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_meta_ads_connected(uuid) IS
  'True when org has Meta Ads OAuth and at least one active ad account (uploads toggle may still be off).';

GRANT EXECUTE ON FUNCTION public.is_meta_ads_connected(uuid) TO authenticated;
