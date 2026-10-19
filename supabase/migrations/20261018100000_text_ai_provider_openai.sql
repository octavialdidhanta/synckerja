-- Allow OpenAI as a text provider. The API key is stored per organization.

ALTER TABLE public.organization_script_ai_config
  DROP CONSTRAINT IF EXISTS chk_organization_script_ai_config_text_ai_provider;

ALTER TABLE public.organization_script_ai_config
  ADD CONSTRAINT chk_organization_script_ai_config_text_ai_provider
  CHECK (text_ai_provider IN ('gemini', 'groq', 'fireworks', 'openai'));

COMMENT ON COLUMN public.organization_script_ai_config.text_ai_provider IS 'Text AI provider for Script Generator, Product Knowledge, and Thinking Lab: gemini | groq | fireworks | openai.';
