ALTER TABLE public.organization_voice_ai_config
  ADD COLUMN IF NOT EXISTS auto_tag boolean NOT NULL DEFAULT true;

GRANT SELECT (auto_tag) ON public.organization_voice_ai_config TO authenticated;
GRANT INSERT (auto_tag) ON public.organization_voice_ai_config TO authenticated;
GRANT UPDATE (auto_tag) ON public.organization_voice_ai_config TO authenticated;

COMMENT ON COLUMN public.organization_voice_ai_config.auto_tag IS 'When true, Generate VO asks Script AI to add an ElevenLabs emotion tag before speaking. The brief cell stays unchanged; the tagged line is stored on the clip and shown in the VO column.';
