-- LinkedIn: granted scopes + manage-comments inbox state
-- Threads: profile columns on IG accounts + manage-comments inbox state

ALTER TABLE public.organization_linkedin_content_accounts
  ADD COLUMN IF NOT EXISTS granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.organization_linkedin_content_accounts.granted_scopes IS
  'OAuth scopes granted at last connect (requested scope list from LinkedIn authorization).';

CREATE TABLE IF NOT EXISTS public.linkedin_manage_comments_post_inbox_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  last_known_comment_count INTEGER NOT NULL DEFAULT 0,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_linkedin_mc_post_inbox UNIQUE (organization_id, page_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_mc_post_inbox_account
  ON public.linkedin_manage_comments_post_inbox_state (organization_id, page_id);

CREATE TABLE IF NOT EXISTS public.linkedin_manage_comments_inbound_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_linkedin_mc_inbound UNIQUE (organization_id, page_id, post_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_mc_inbound_account
  ON public.linkedin_manage_comments_inbound_comments (organization_id, page_id);

CREATE TABLE IF NOT EXISTS public.linkedin_manage_comments_comment_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  engaged_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  engaged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_linkedin_mc_engagement UNIQUE (organization_id, page_id, post_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_mc_engagements_account
  ON public.linkedin_manage_comments_comment_engagements (organization_id, page_id);

ALTER TABLE public.linkedin_manage_comments_post_inbox_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_manage_comments_inbound_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_manage_comments_comment_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY linkedin_manage_comments_post_inbox_deny
  ON public.linkedin_manage_comments_post_inbox_state FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY linkedin_manage_comments_inbound_deny
  ON public.linkedin_manage_comments_inbound_comments FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY linkedin_manage_comments_engagements_deny
  ON public.linkedin_manage_comments_comment_engagements FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- Threads profile linked to Instagram Business account row
ALTER TABLE public.organization_instagram_accounts
  ADD COLUMN IF NOT EXISTS threads_user_id TEXT,
  ADD COLUMN IF NOT EXISTS threads_username TEXT,
  ADD COLUMN IF NOT EXISTS threads_profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS has_threads BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS threads_access_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS threads_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organization_instagram_accounts.has_threads IS
  'True when Threads OAuth scopes granted and threads_user_id stored.';

CREATE TABLE IF NOT EXISTS public.threads_manage_comments_post_inbox_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  last_known_comment_count INTEGER NOT NULL DEFAULT 0,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_threads_mc_post_inbox UNIQUE (organization_id, threads_user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_mc_post_inbox_account
  ON public.threads_manage_comments_post_inbox_state (organization_id, threads_user_id);

CREATE TABLE IF NOT EXISTS public.threads_manage_comments_inbound_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_threads_mc_inbound UNIQUE (organization_id, threads_user_id, media_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_mc_inbound_account
  ON public.threads_manage_comments_inbound_comments (organization_id, threads_user_id);

CREATE TABLE IF NOT EXISTS public.threads_manage_comments_comment_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  engaged_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  engaged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_threads_mc_engagement UNIQUE (organization_id, threads_user_id, media_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_mc_engagements_account
  ON public.threads_manage_comments_comment_engagements (organization_id, threads_user_id);

ALTER TABLE public.threads_manage_comments_post_inbox_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_manage_comments_inbound_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_manage_comments_comment_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY threads_manage_comments_post_inbox_deny
  ON public.threads_manage_comments_post_inbox_state FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY threads_manage_comments_inbound_deny
  ON public.threads_manage_comments_inbound_comments FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY threads_manage_comments_engagements_deny
  ON public.threads_manage_comments_comment_engagements FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

INSERT INTO public.permission_configuration_defaults (
  page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
VALUES
  (
    '/digital-marketing/social-media-performance/threads',
    'Digital Marketing — Threads Content Performance',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/digital-marketing/social-media-performance/manage-comments/linkedin',
    'Digital Marketing — LinkedIn Manage Comments',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/digital-marketing/social-media-performance/manage-comments/threads',
    'Digital Marketing — Threads Manage Comments',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  )
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id, page_path, page_title, is_active,
  roles_allowed, job_levels_allowed, exceptions, exception_paths
)
SELECT o.id, d.page_path, d.page_title, d.is_active,
  d.roles_allowed, d.job_levels_allowed, d.exceptions, d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path IN (
  '/digital-marketing/social-media-performance/threads',
  '/digital-marketing/social-media-performance/manage-comments/linkedin',
  '/digital-marketing/social-media-performance/manage-comments/threads'
)
AND NOT EXISTS (
  SELECT 1 FROM public.permission_configurations p
  WHERE p.organization_id = o.id AND p.page_path = d.page_path
);
