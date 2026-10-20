-- Per-organization ElevenLabs key and brief voice clips.
-- The key column is not selectable by the browser. Edge functions read it with the service role.

CREATE TABLE IF NOT EXISTS public.organization_voice_ai_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  elevenlabs_api_key text NULL,
  api_key_configured boolean NOT NULL DEFAULT false,
  voice_id text NULL,
  voice_name text NULL,
  tts_model text NOT NULL DEFAULT 'eleven_multilingual_v2',
  stability double precision NOT NULL DEFAULT 0.5,
  similarity_boost double precision NOT NULL DEFAULT 0.75,
  speed double precision NOT NULL DEFAULT 1,
  daily_limit integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_voice_ai_config UNIQUE (organization_id),
  CONSTRAINT organization_voice_ai_config_daily_limit_positive CHECK (daily_limit >= 1),
  CONSTRAINT organization_voice_ai_config_stability_range CHECK (stability >= 0 AND stability <= 1),
  CONSTRAINT organization_voice_ai_config_similarity_range CHECK (similarity_boost >= 0 AND similarity_boost <= 1),
  CONSTRAINT organization_voice_ai_config_speed_range CHECK (speed >= 0.7 AND speed <= 1.2)
);

CREATE INDEX IF NOT EXISTS idx_organization_voice_ai_config_organization_id
  ON public.organization_voice_ai_config USING btree (organization_id);

DROP TRIGGER IF EXISTS trigger_organization_voice_ai_config_updated_at ON public.organization_voice_ai_config;
CREATE TRIGGER trigger_organization_voice_ai_config_updated_at
  BEFORE UPDATE ON public.organization_voice_ai_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_voice_ai_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org voice ai config" ON public.organization_voice_ai_config;
CREATE POLICY "Users can view own org voice ai config"
  ON public.organization_voice_ai_config FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_voice_ai_config.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org voice ai config" ON public.organization_voice_ai_config;
CREATE POLICY "Users can insert own org voice ai config"
  ON public.organization_voice_ai_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org voice ai config" ON public.organization_voice_ai_config;
CREATE POLICY "Users can update own org voice ai config"
  ON public.organization_voice_ai_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_voice_ai_config.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

REVOKE ALL ON TABLE public.organization_voice_ai_config FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, organization_id, api_key_configured, voice_id, voice_name, tts_model,
  stability, similarity_boost, speed, daily_limit, created_at, updated_at
) ON public.organization_voice_ai_config TO authenticated;
GRANT INSERT (
  organization_id, elevenlabs_api_key, api_key_configured, voice_id, voice_name, tts_model,
  stability, similarity_boost, speed, daily_limit
) ON public.organization_voice_ai_config TO authenticated;
GRANT UPDATE (
  elevenlabs_api_key, api_key_configured, voice_id, voice_name, tts_model,
  stability, similarity_boost, speed, daily_limit, updated_at
) ON public.organization_voice_ai_config TO authenticated;
GRANT ALL ON TABLE public.organization_voice_ai_config TO service_role;

COMMENT ON TABLE public.organization_voice_ai_config IS 'Per-organization ElevenLabs key and the one voice used for every brief narration.';
COMMENT ON COLUMN public.organization_voice_ai_config.elevenlabs_api_key IS 'ElevenLabs API key for this organization. Not selectable by authenticated clients.';

CREATE TABLE IF NOT EXISTS public.voice_ai_daily_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_voice_ai_daily_usage_org_date UNIQUE (organization_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_voice_ai_daily_usage_org_date
  ON public.voice_ai_daily_usage USING btree (organization_id, usage_date);

DROP TRIGGER IF EXISTS trigger_voice_ai_daily_usage_updated_at ON public.voice_ai_daily_usage;
CREATE TRIGGER trigger_voice_ai_daily_usage_updated_at
  BEFORE UPDATE ON public.voice_ai_daily_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.voice_ai_daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org voice ai usage" ON public.voice_ai_daily_usage;
CREATE POLICY "Users can view own org voice ai usage"
  ON public.voice_ai_daily_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = voice_ai_daily_usage.organization_id
    )
  );

REVOKE ALL ON TABLE public.voice_ai_daily_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.voice_ai_daily_usage TO authenticated;
GRANT ALL ON TABLE public.voice_ai_daily_usage TO service_role;

CREATE TABLE IF NOT EXISTS public.brief_voice_clips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('vo', 'seedance')),
  row_index integer NOT NULL CHECK (row_index >= 0),
  video_id uuid NULL REFERENCES public.brief_shot_videos (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brief_voice_clips_plan
  ON public.brief_voice_clips USING btree (social_media_plan_id, created_at DESC);

ALTER TABLE public.brief_voice_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org brief voice clips" ON public.brief_voice_clips;
CREATE POLICY "Users can view own org brief voice clips"
  ON public.brief_voice_clips FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

REVOKE ALL ON TABLE public.brief_voice_clips FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.brief_voice_clips TO authenticated;
GRANT ALL ON TABLE public.brief_voice_clips TO service_role;

COMMENT ON TABLE public.brief_voice_clips IS 'ElevenLabs narration files. vo clips belong to a storyboard row. seedance clips replace playback of one existing video without changing its file.';
