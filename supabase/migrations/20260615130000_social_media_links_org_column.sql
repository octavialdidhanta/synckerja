-- social_media_links needs organization_id for indexed plan matching (via plan FK exists; add denormalized if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_media_links'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.social_media_links ADD COLUMN organization_id uuid NULL;

    UPDATE public.social_media_links l
    SET organization_id = p.organization_id
    FROM public.social_media_plans p
    WHERE p.id = l.social_media_plan_id
      AND l.organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_social_media_links_org_platform
      ON public.social_media_links (organization_id, platform)
      WHERE organization_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_social_media_links_external_post_id
      ON public.social_media_links (organization_id, external_post_id)
      WHERE external_post_id IS NOT NULL;
  END IF;
END $$;
