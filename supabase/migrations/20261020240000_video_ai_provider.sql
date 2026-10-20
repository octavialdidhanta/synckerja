ALTER TABLE public.organization_video_ai_config
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'byteplus';

ALTER TABLE public.organization_video_ai_config
  DROP CONSTRAINT IF EXISTS organization_video_ai_config_provider;

ALTER TABLE public.organization_video_ai_config
  ADD CONSTRAINT organization_video_ai_config_provider
  CHECK (provider IN ('byteplus', 'gemini'));

GRANT SELECT (provider) ON public.organization_video_ai_config TO authenticated;
GRANT INSERT (provider) ON public.organization_video_ai_config TO authenticated;
GRANT UPDATE (provider) ON public.organization_video_ai_config TO authenticated;

COMMENT ON COLUMN public.organization_video_ai_config.provider IS
  'Video provider for this organization: byteplus uses the BytePlus key, gemini uses the Script AI Gemini key.';
