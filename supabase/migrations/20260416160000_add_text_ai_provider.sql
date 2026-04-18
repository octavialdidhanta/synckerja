-- Add explicit Text AI provider enum column (Gemini / Groq / Fireworks).
-- Backfill from legacy boolean `is_active` which previously meant Groq vs Gemini.

ALTER TABLE public.organization_script_ai_config
  ADD COLUMN IF NOT EXISTS text_ai_provider text NOT NULL DEFAULT 'gemini';

-- Normalize any unexpected NULLs (defensive)
UPDATE public.organization_script_ai_config
SET text_ai_provider = 'gemini'
WHERE text_ai_provider IS NULL OR btrim(text_ai_provider) = '';

-- Backfill from legacy mapping:
-- - is_active = true  => groq
-- - is_active = false => gemini
UPDATE public.organization_script_ai_config
SET text_ai_provider = CASE WHEN is_active IS TRUE THEN 'groq' ELSE 'gemini' END;

ALTER TABLE public.organization_script_ai_config
  DROP CONSTRAINT IF EXISTS chk_organization_script_ai_config_text_ai_provider;

ALTER TABLE public.organization_script_ai_config
  ADD CONSTRAINT chk_organization_script_ai_config_text_ai_provider
  CHECK (text_ai_provider IN ('gemini', 'groq', 'fireworks'));

COMMENT ON COLUMN public.organization_script_ai_config.text_ai_provider IS 'Text AI provider for Script Generator / Product Knowledge: gemini | groq | fireworks.';
