-- Analytics web_id access mapping (multi-tenant, no-leak)

CREATE TABLE IF NOT EXISTS public.analytics_web_access (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  web_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT analytics_web_access_web_id_check CHECK (
    web_id = ANY (ARRAY['vialdi'::text, 'vialdi-wedding'::text, 'synckerja'::text])
  ),
  CONSTRAINT analytics_web_access_pkey PRIMARY KEY (organization_id, web_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_web_access_web_id
  ON public.analytics_web_access (web_id);

ALTER TABLE public.analytics_web_access ENABLE ROW LEVEL SECURITY;

-- Select: any authenticated user in org may read their allowed web_ids
DROP POLICY IF EXISTS "analytics_web_access_select_org" ON public.analytics_web_access;
CREATE POLICY "analytics_web_access_select_org"
  ON public.analytics_web_access FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = analytics_web_access.organization_id
    )
  );

-- Mutations: restrict to owners/admins only (via centralized permission_configurations / roles_allowed),
-- but we keep it simple here: allow only users whose profile role is owner/admin.
-- If your project encodes role elsewhere, adjust accordingly.
DROP POLICY IF EXISTS "analytics_web_access_insert_admin" ON public.analytics_web_access;
CREATE POLICY "analytics_web_access_insert_admin"
  ON public.analytics_web_access FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "analytics_web_access_update_admin" ON public.analytics_web_access;
CREATE POLICY "analytics_web_access_update_admin"
  ON public.analytics_web_access FOR UPDATE TO authenticated
  USING (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  )
  WITH CHECK (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "analytics_web_access_delete_admin" ON public.analytics_web_access;
CREATE POLICY "analytics_web_access_delete_admin"
  ON public.analytics_web_access FOR DELETE TO authenticated
  USING (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  );

-- Helper: check if current user can access a given web_id.
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
  );
$$;

-- Helper: list allowed web_ids for current user.
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
  ORDER BY a.web_id;
$$;

REVOKE ALL ON FUNCTION public.can_access_web_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_web_id(text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_accessible_web_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accessible_web_ids() TO authenticated;

