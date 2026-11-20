-- Repair databases created before mcp_oauth_codes.code_challenge existed.
ALTER TABLE public.mcp_oauth_codes
  ADD COLUMN IF NOT EXISTS code_challenge text;

UPDATE public.mcp_oauth_codes
SET code_challenge = ''
WHERE code_challenge IS NULL;

ALTER TABLE public.mcp_oauth_codes
  ALTER COLUMN code_challenge SET NOT NULL;

NOTIFY pgrst, 'reload schema';
