-- Performance Advisor: multiple permissive SELECT policies on public.agency_packages.
-- Previously: agency_packages_select_public (TO public, is_published)
--           + agency_packages_select_admin (TO authenticated, cms_admins)
-- Authenticated users matched both → duplicate permissive evaluation.
-- Single SELECT policy (TO public): published rows for everyone; full rows for CMS admins.

DO $$
BEGIN
  IF to_regclass('public.agency_packages') IS NULL
     OR to_regclass('public.cms_admins') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "agency_packages_select_admin" ON public.agency_packages';
  EXECUTE 'DROP POLICY IF EXISTS "agency_packages_select_public" ON public.agency_packages';
  -- Idempotent: cloud may already have this policy from a prior partial apply / MCP.
  EXECUTE 'DROP POLICY IF EXISTS "agency_packages_select_published_or_cms" ON public.agency_packages';

  EXECUTE $pol$
    CREATE POLICY "agency_packages_select_published_or_cms"
      ON public.agency_packages
      FOR SELECT
      TO public
      USING (
        agency_packages.is_published = true
        OR EXISTS (
          SELECT 1
          FROM public.cms_admins a
          WHERE a.user_id = (SELECT auth.uid())
        )
      )
  $pol$;
END;
$$;
