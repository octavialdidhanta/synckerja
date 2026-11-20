-- Platform-agnostic scheduled social media posts (TikTok auto-publish phase 1).

CREATE TABLE IF NOT EXISTS public.social_media_scheduled_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  platform text NOT NULL,
  delivery_mode text NOT NULL DEFAULT 'api_auto',
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  media_source text NOT NULL DEFAULT 'google_drive_link',
  media_url_snapshot text NOT NULL,
  media_resolved_url text NULL,
  caption text NULL,
  title text NULL,
  privacy_level text NULL DEFAULT 'PUBLIC_TO_EVERYONE',
  provider_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_post_id text NULL,
  published_url text NULL,
  published_at timestamptz NULL,
  error_message text NULL,
  retry_count integer NOT NULL DEFAULT 0,
  scheduled_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_media_scheduled_posts_status_check CHECK (
    status IN ('pending', 'publishing', 'published', 'failed', 'cancelled')
  ),
  CONSTRAINT social_media_scheduled_posts_delivery_mode_check CHECK (
    delivery_mode IN ('api_auto', 'manual_only')
  )
);

CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_org
  ON public.social_media_scheduled_posts (organization_id);

CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_plan
  ON public.social_media_scheduled_posts (social_media_plan_id);

CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_due
  ON public.social_media_scheduled_posts (scheduled_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_one_active_per_plan_platform
  ON public.social_media_scheduled_posts (social_media_plan_id, platform)
  WHERE status IN ('pending', 'publishing');

COMMENT ON TABLE public.social_media_scheduled_posts IS
  'Scheduled auto-publish jobs per social_media_plan and platform. Phase 1: TikTok api_auto.';

ALTER TABLE public.social_media_scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_media_scheduled_posts_org ON public.social_media_scheduled_posts;
CREATE POLICY social_media_scheduled_posts_org
  ON public.social_media_scheduled_posts
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
  );

-- Cancel pending schedules when plan gates fail.
CREATE OR REPLACE FUNCTION public.cancel_social_media_scheduled_posts_for_plan(
  p_plan_id uuid,
  p_reason text DEFAULT 'plan_gate_failed'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.social_media_scheduled_posts
  SET
    status = 'cancelled',
    error_message = COALESCE(p_reason, 'cancelled'),
    updated_at = now()
  WHERE social_media_plan_id = p_plan_id
    AND status IN ('pending', 'publishing');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_social_media_scheduled_posts_for_plan(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_cancel_scheduled_posts_on_plan_gate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_type text;
  v_new_type text;
BEGIN
  SELECT name INTO v_old_type
  FROM public.content_types
  WHERE id = OLD.content_type_id;

  SELECT name INTO v_new_type
  FROM public.content_types
  WHERE id = NEW.content_type_id;

  IF NEW.approved IS DISTINCT FROM TRUE
    OR NEW.production_approved IS DISTINCT FROM TRUE
    OR NEW.google_drive_link IS NULL
    OR trim(COALESCE(NEW.google_drive_link, '')) = ''
    OR NEW.post_date IS NULL
    OR v_new_type IS DISTINCT FROM 'Reel'
  THEN
    PERFORM public.cancel_social_media_scheduled_posts_for_plan(NEW.id, 'plan_gate_failed');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_media_plans_cancel_scheduled_posts ON public.social_media_plans;
CREATE TRIGGER social_media_plans_cancel_scheduled_posts
  AFTER UPDATE ON public.social_media_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cancel_scheduled_posts_on_plan_gate_change();
