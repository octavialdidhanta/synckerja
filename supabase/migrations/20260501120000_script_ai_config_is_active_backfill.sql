-- Receipt AI and other consumers expect organization_script_ai_config.is_active to reflect
-- "org has Script AI settings", not legacy "Groq-only" routing. Backfill existing rows.
UPDATE public.organization_script_ai_config
SET is_active = true
WHERE is_active IS DISTINCT FROM true;
