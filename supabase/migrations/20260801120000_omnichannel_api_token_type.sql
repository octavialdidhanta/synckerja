-- Omnichannel API tokens: scope by token_type (sdk | server | legacy_full).

ALTER TABLE public.organization_omnichannel_api_tokens
  ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'legacy_full';

ALTER TABLE public.organization_omnichannel_api_tokens
  DROP CONSTRAINT IF EXISTS organization_omnichannel_api_tokens_token_type_check;

ALTER TABLE public.organization_omnichannel_api_tokens
  ADD CONSTRAINT organization_omnichannel_api_tokens_token_type_check
  CHECK (token_type IN ('sdk', 'server', 'legacy_full'));

COMMENT ON COLUMN public.organization_omnichannel_api_tokens.token_type IS
  'sdk=analytics+leads; server=invoice-trigger only; legacy_full=pre-scope tokens (grandfathered).';
