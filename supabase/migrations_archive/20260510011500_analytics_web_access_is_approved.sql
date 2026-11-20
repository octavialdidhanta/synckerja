-- Approval gate for traffic web_id access.
-- Existing connections stay approved so current dashboards do not lose access.

ALTER TABLE public.analytics_web_access
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

UPDATE public.analytics_web_access
SET is_approved = true
WHERE is_approved = false;

CREATE INDEX IF NOT EXISTS idx_analytics_web_access_approved_web_id
  ON public.analytics_web_access (web_id)
  WHERE is_approved = true;

CREATE INDEX IF NOT EXISTS idx_analytics_web_access_org_approved
  ON public.analytics_web_access (organization_id, is_approved);

CREATE OR REPLACE FUNCTION public.can_access_web_id(p_web_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.analytics_web_access a
    JOIN public.profiles p
      ON p.active_organization_id = a.organization_id
     AND p.user_id = (SELECT auth.uid())
    WHERE a.web_id = p_web_id
      AND a.is_approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.list_accessible_web_ids()
RETURNS TABLE (web_id text)
LANGUAGE sql
STABLE
AS $$
  SELECT a.web_id
  FROM public.analytics_web_access a
  JOIN public.profiles p
    ON p.active_organization_id = a.organization_id
   AND p.user_id = (SELECT auth.uid())
  WHERE a.is_approved = true
  ORDER BY a.web_id;
$$;

REVOKE ALL ON FUNCTION public.can_access_web_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_web_id(text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_accessible_web_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accessible_web_ids() TO authenticated;

COMMENT ON COLUMN public.analytics_web_access.is_approved IS
  'When false, the web_id connection request exists but does not grant analytics access yet.';
