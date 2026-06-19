-- Meta organic content: granted scopes on IG accounts + FB-only pages table.

ALTER TABLE public.organization_instagram_accounts
  ADD COLUMN IF NOT EXISTS facebook_page_name TEXT,
  ADD COLUMN IF NOT EXISTS granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS has_instagram BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.organization_instagram_accounts.granted_scopes IS
  'OAuth scopes granted at last connect (from debug_token or /me/permissions).';

CREATE TABLE IF NOT EXISTS public.organization_facebook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facebook_page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT,
  granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_facebook_page UNIQUE (organization_id, facebook_page_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_facebook_pages_org
  ON public.organization_facebook_pages(organization_id);

ALTER TABLE public.organization_facebook_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org facebook pages"
  ON public.organization_facebook_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_facebook_pages.organization_id
    )
  );

CREATE POLICY "Users can insert own org facebook pages"
  ON public.organization_facebook_pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "Users can update own org facebook pages"
  ON public.organization_facebook_pages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_facebook_pages.organization_id
    )
  );

CREATE POLICY "Users can delete own org facebook pages"
  ON public.organization_facebook_pages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_facebook_pages.organization_id
    )
  );

CREATE OR REPLACE FUNCTION update_organization_facebook_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_organization_facebook_pages_updated_at ON public.organization_facebook_pages;
CREATE TRIGGER trigger_organization_facebook_pages_updated_at
  BEFORE UPDATE ON public.organization_facebook_pages
  FOR EACH ROW EXECUTE FUNCTION update_organization_facebook_pages_updated_at();

-- Meta manage comments inbox state (org-level, mirror YouTube pattern).

CREATE TABLE IF NOT EXISTS public.meta_manage_comments_post_inbox_state (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  account_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  last_known_comment_count INTEGER NOT NULL DEFAULT 0,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  thread_comments_seeded BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, platform, account_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_manage_comments_post_inbox_account
  ON public.meta_manage_comments_post_inbox_state (organization_id, platform, account_id);

CREATE TABLE IF NOT EXISTS public.meta_manage_comments_inbound_comments (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  account_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, platform, account_id, media_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_manage_comments_inbound_account
  ON public.meta_manage_comments_inbound_comments (organization_id, platform, account_id);

CREATE TABLE IF NOT EXISTS public.meta_manage_comments_comment_engagements (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  account_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('read')),
  engaged_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  engaged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, platform, account_id, media_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_manage_comments_engagements_account
  ON public.meta_manage_comments_comment_engagements (organization_id, platform, account_id);

ALTER TABLE public.meta_manage_comments_post_inbox_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_manage_comments_inbound_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_manage_comments_comment_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY meta_manage_comments_post_inbox_deny
  ON public.meta_manage_comments_post_inbox_state FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY meta_manage_comments_inbound_deny
  ON public.meta_manage_comments_inbound_comments FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY meta_manage_comments_engagements_deny
  ON public.meta_manage_comments_comment_engagements FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
