-- Audit trail for soft-revoked omnichannel API tokens.

ALTER TABLE public.organization_omnichannel_api_tokens
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS revoked_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organization_omnichannel_api_tokens.revoked_at IS
  'UTC timestamp when token was revoked (is_active set to false).';
COMMENT ON COLUMN public.organization_omnichannel_api_tokens.revoked_by IS
  'User who revoked the token (org owner/admin via omnichannel-api-manage).';
