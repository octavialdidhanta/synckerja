-- Manual lock per plan/platform/account + per-account active schedule uniqueness.

ALTER TABLE public.social_media_scheduled_posts
  ADD COLUMN IF NOT EXISTS platform_account_id text NULL;

COMMENT ON COLUMN public.social_media_scheduled_posts.platform_account_id IS
  'OAuth account id denormalized from provider_config for multi-account per platform.';

UPDATE public.social_media_scheduled_posts
SET platform_account_id = provider_config->>'open_id'
WHERE platform = 'TikTok' AND platform_account_id IS NULL AND provider_config->>'open_id' IS NOT NULL;

UPDATE public.social_media_scheduled_posts
SET platform_account_id = provider_config->>'channel_id'
WHERE platform = 'YouTube' AND platform_account_id IS NULL AND provider_config->>'channel_id' IS NOT NULL;

UPDATE public.social_media_scheduled_posts
SET platform_account_id = provider_config->>'instagram_business_account_id'
WHERE platform = 'Instagram' AND platform_account_id IS NULL
  AND provider_config->>'instagram_business_account_id' IS NOT NULL;

UPDATE public.social_media_scheduled_posts
SET platform_account_id = provider_config->>'page_id'
WHERE platform = 'LinkedIn' AND platform_account_id IS NULL AND provider_config->>'page_id' IS NOT NULL;

DROP INDEX IF EXISTS public.idx_social_media_scheduled_posts_one_active_per_plan_platform;

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_one_active_per_plan_platform_account
  ON public.social_media_scheduled_posts (social_media_plan_id, platform, platform_account_id)
  WHERE status IN ('pending', 'publishing') AND platform_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.social_media_plan_schedule_manual_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_account_id text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT social_media_plan_schedule_manual_locks_unique
    UNIQUE (social_media_plan_id, platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_schedule_manual_locks_plan
  ON public.social_media_plan_schedule_manual_locks (social_media_plan_id);

ALTER TABLE public.social_media_plan_schedule_manual_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_schedule_manual_locks_org ON public.social_media_plan_schedule_manual_locks;
CREATE POLICY plan_schedule_manual_locks_org
  ON public.social_media_plan_schedule_manual_locks
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
