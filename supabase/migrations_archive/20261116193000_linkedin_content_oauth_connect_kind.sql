-- LinkedIn Content: distinguish page vs personal OAuth connect on oauth state rows.

ALTER TABLE public.linkedin_content_oauth_states
  ADD COLUMN IF NOT EXISTS connect_kind text NOT NULL DEFAULT 'organization';

ALTER TABLE public.linkedin_content_oauth_states
  DROP CONSTRAINT IF EXISTS linkedin_content_oauth_states_connect_kind_check;

ALTER TABLE public.linkedin_content_oauth_states
  ADD CONSTRAINT linkedin_content_oauth_states_connect_kind_check
  CHECK (connect_kind IN ('organization', 'person'));

COMMENT ON COLUMN public.linkedin_content_oauth_states.connect_kind IS
  'organization = Company Page OAuth (org scopes + ACL picker); person = member profile OAuth (w_member_social).';
