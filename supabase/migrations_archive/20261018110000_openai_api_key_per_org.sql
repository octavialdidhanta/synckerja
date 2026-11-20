-- Store each organization's OpenAI key on its own Script AI row.
ALTER TABLE public.organization_script_ai_config
  ADD COLUMN IF NOT EXISTS openai_api_key text NULL,
  ADD COLUMN IF NOT EXISTS openai_api_key_configured boolean NULL DEFAULT false;

COMMENT ON COLUMN public.organization_script_ai_config.openai_api_key IS 'OpenAI API key for this organization. Used for text requests when text_ai_provider is openai.';
COMMENT ON COLUMN public.organization_script_ai_config.openai_api_key_configured IS 'True after an OpenAI API key has been saved for this organization.';
