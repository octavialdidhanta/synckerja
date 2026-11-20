-- Per-organization BytePlus Seedance key and brief video jobs.
-- The key column is not selectable by the browser. Edge functions read it with the service role.

CREATE TABLE IF NOT EXISTS public.organization_video_ai_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  byteplus_api_key text NULL,
  api_key_configured boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_video_ai_config UNIQUE (organization_id),
  CONSTRAINT organization_video_ai_config_daily_limit_positive CHECK (daily_limit >= 1)
);

CREATE INDEX IF NOT EXISTS idx_organization_video_ai_config_organization_id
  ON public.organization_video_ai_config USING btree (organization_id);

DROP TRIGGER IF EXISTS trigger_organization_video_ai_config_updated_at ON public.organization_video_ai_config;
CREATE TRIGGER trigger_organization_video_ai_config_updated_at
  BEFORE UPDATE ON public.organization_video_ai_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_video_ai_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org video ai config" ON public.organization_video_ai_config;
CREATE POLICY "Users can view own org video ai config"
  ON public.organization_video_ai_config FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_video_ai_config.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org video ai config" ON public.organization_video_ai_config;
CREATE POLICY "Users can insert own org video ai config"
  ON public.organization_video_ai_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org video ai config" ON public.organization_video_ai_config;
CREATE POLICY "Users can update own org video ai config"
  ON public.organization_video_ai_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_video_ai_config.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

REVOKE ALL ON TABLE public.organization_video_ai_config FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, organization_id, api_key_configured, daily_limit, created_at, updated_at)
  ON public.organization_video_ai_config TO authenticated;
GRANT INSERT (organization_id, byteplus_api_key, api_key_configured, daily_limit)
  ON public.organization_video_ai_config TO authenticated;
GRANT UPDATE (byteplus_api_key, api_key_configured, daily_limit, updated_at)
  ON public.organization_video_ai_config TO authenticated;
GRANT ALL ON TABLE public.organization_video_ai_config TO service_role;

COMMENT ON TABLE public.organization_video_ai_config IS 'Per-organization BytePlus API key for Seedance video. The key is written by the org and read only by the service role.';
COMMENT ON COLUMN public.organization_video_ai_config.byteplus_api_key IS 'BytePlus ModelArk API key for this organization. Not selectable by authenticated clients.';

CREATE TABLE IF NOT EXISTS public.video_ai_daily_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_video_ai_daily_usage_org_date UNIQUE (organization_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_video_ai_daily_usage_org_date
  ON public.video_ai_daily_usage USING btree (organization_id, usage_date);

DROP TRIGGER IF EXISTS trigger_video_ai_daily_usage_updated_at ON public.video_ai_daily_usage;
CREATE TRIGGER trigger_video_ai_daily_usage_updated_at
  BEFORE UPDATE ON public.video_ai_daily_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.video_ai_daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org video ai usage" ON public.video_ai_daily_usage;
CREATE POLICY "Users can view own org video ai usage"
  ON public.video_ai_daily_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = video_ai_daily_usage.organization_id
    )
  );

REVOKE ALL ON TABLE public.video_ai_daily_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.video_ai_daily_usage TO authenticated;
GRANT ALL ON TABLE public.video_ai_daily_usage TO service_role;

CREATE TABLE IF NOT EXISTS public.brief_shot_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('shot', 'master')),
  row_index integer NOT NULL CHECK (row_index >= 0),
  row_indexes integer[] NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  provider_task_id text NULL,
  model text NOT NULL,
  resolution text NOT NULL,
  duration_seconds integer NOT NULL,
  ratio text NOT NULL,
  generate_audio boolean NOT NULL DEFAULT false,
  storage_path text NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_shot_videos_plan
  ON public.brief_shot_videos USING btree (social_media_plan_id, created_at DESC);

DROP TRIGGER IF EXISTS trigger_brief_shot_videos_updated_at ON public.brief_shot_videos;
CREATE TRIGGER trigger_brief_shot_videos_updated_at
  BEFORE UPDATE ON public.brief_shot_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.brief_shot_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org brief videos" ON public.brief_shot_videos;
CREATE POLICY "Users can view own org brief videos"
  ON public.brief_shot_videos FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

REVOKE ALL ON TABLE public.brief_shot_videos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.brief_shot_videos TO authenticated;
GRANT ALL ON TABLE public.brief_shot_videos TO service_role;

COMMENT ON TABLE public.brief_shot_videos IS 'Seedance videos generated from brief shots. Older rows are kept when a shot is generated again.';
