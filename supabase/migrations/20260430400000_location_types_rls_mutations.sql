-- location_types: allow org members to INSERT/UPDATE/DELETE their rows (reference: types Insert/Update).
-- Existing policy location_types_org_select only allowed SELECT; mutations failed with 42501.

DROP POLICY IF EXISTS "location_types_org_insert" ON public.location_types;
CREATE POLICY "location_types_org_insert"
  ON public.location_types FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "location_types_org_update" ON public.location_types;
CREATE POLICY "location_types_org_update"
  ON public.location_types FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "location_types_org_delete" ON public.location_types;
CREATE POLICY "location_types_org_delete"
  ON public.location_types FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );
