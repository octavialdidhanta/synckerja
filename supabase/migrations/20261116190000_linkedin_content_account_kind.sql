-- LinkedIn Content: account_kind for organization pages vs personal member profiles.
-- Subject key remains page_id (org numeric id OR person id). Token PK unchanged.

ALTER TABLE public.organization_linkedin_content_accounts
  ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'organization';

ALTER TABLE public.organization_linkedin_content_accounts
  DROP CONSTRAINT IF EXISTS organization_linkedin_content_accounts_account_kind_check;

ALTER TABLE public.organization_linkedin_content_accounts
  ADD CONSTRAINT organization_linkedin_content_accounts_account_kind_check
  CHECK (account_kind IN ('organization', 'person'));

COMMENT ON COLUMN public.organization_linkedin_content_accounts.account_kind IS
  'organization = LinkedIn Company Page (page_id = org numeric id); person = member profile (page_id = person id).';

COMMENT ON TABLE public.organization_linkedin_content_accounts IS
  'LinkedIn pages and personal profiles connected via OAuth per org. Distinguish with account_kind.';

-- One default per account_kind per org (page default + person default allowed).
DROP INDEX IF EXISTS public.idx_organization_linkedin_content_accounts_one_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_linkedin_content_accounts_one_default_per_kind
  ON public.organization_linkedin_content_accounts (organization_id, account_kind)
  WHERE is_default = true AND is_active = true;
