-- Allow selecting default (organization_id IS NULL) hooks for all tenants,
-- while keeping writes restricted to the user's organizations.
--
-- Previous policy "product_knowledge_hooks_org" was FOR ALL and blocked
-- selecting rows with organization_id IS NULL.

DO $$
BEGIN
  IF to_regclass('public.product_knowledge_hooks') IS NULL THEN
    RETURN;
  END IF;

  -- Drop legacy policy if it exists
  EXECUTE 'DROP POLICY IF EXISTS "product_knowledge_hooks_org" ON public.product_knowledge_hooks';

  -- Drop new policies too (idempotent)
  EXECUTE 'DROP POLICY IF EXISTS "product_knowledge_hooks_select" ON public.product_knowledge_hooks';
  EXECUTE 'DROP POLICY IF EXISTS "product_knowledge_hooks_insert" ON public.product_knowledge_hooks';
  EXECUTE 'DROP POLICY IF EXISTS "product_knowledge_hooks_update" ON public.product_knowledge_hooks';
  EXECUTE 'DROP POLICY IF EXISTS "product_knowledge_hooks_delete" ON public.product_knowledge_hooks';

  -- SELECT: allow both org-specific and default hooks (organization_id NULL)
  EXECUTE $sql$
    CREATE POLICY "product_knowledge_hooks_select" ON public.product_knowledge_hooks
      FOR SELECT TO authenticated
      USING (
        organization_id IS NULL
        OR organization_id IN (SELECT public.user_organization_ids())
      )
  $sql$;

  -- INSERT: only allow inserting into user's organizations (no defaults)
  EXECUTE $sql$
    CREATE POLICY "product_knowledge_hooks_insert" ON public.product_knowledge_hooks
      FOR INSERT TO authenticated
      WITH CHECK (
        organization_id IN (SELECT public.user_organization_ids())
      )
  $sql$;

  -- UPDATE: only allow updating rows belonging to user's organizations (no defaults)
  EXECUTE $sql$
    CREATE POLICY "product_knowledge_hooks_update" ON public.product_knowledge_hooks
      FOR UPDATE TO authenticated
      USING (
        organization_id IN (SELECT public.user_organization_ids())
      )
      WITH CHECK (
        organization_id IN (SELECT public.user_organization_ids())
      )
  $sql$;

  -- DELETE: only allow deleting rows belonging to user's organizations (no defaults)
  EXECUTE $sql$
    CREATE POLICY "product_knowledge_hooks_delete" ON public.product_knowledge_hooks
      FOR DELETE TO authenticated
      USING (
        organization_id IN (SELECT public.user_organization_ids())
      )
  $sql$;
END;
$$;

