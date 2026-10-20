-- Eleven v4 is the organization default. Narration language is stored once per organization.

ALTER TABLE public.organization_voice_ai_config
  ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT 'id';

ALTER TABLE public.organization_voice_ai_config
  DROP CONSTRAINT IF EXISTS organization_voice_ai_config_language_code_format;

ALTER TABLE public.organization_voice_ai_config
  ADD CONSTRAINT organization_voice_ai_config_language_code_format
  CHECK (language_code ~ '^[a-z]{2}$');

ALTER TABLE public.organization_voice_ai_config
  ALTER COLUMN tts_model SET DEFAULT 'eleven_v4';

UPDATE public.organization_voice_ai_config
SET tts_model = 'eleven_flash_v2_5'
WHERE tts_model = 'eleven_turbo_v2_5';

UPDATE public.organization_voice_ai_config
SET tts_model = 'eleven_v4'
WHERE tts_model = 'eleven_multilingual_v2';

GRANT SELECT (language_code) ON public.organization_voice_ai_config TO authenticated;
GRANT INSERT (language_code) ON public.organization_voice_ai_config TO authenticated;
GRANT UPDATE (language_code) ON public.organization_voice_ai_config TO authenticated;

COMMENT ON COLUMN public.organization_voice_ai_config.language_code IS 'ISO 639-1 language sent with text-to-speech models that accept language_code. Multilingual v2 ignores it.';
