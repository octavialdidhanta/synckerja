-- Org-level shared inbox state for TikTok Manage Comments (highlights until like/reply).

CREATE TABLE IF NOT EXISTS public.tiktok_manage_comments_post_inbox_state (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  open_id text NOT NULL,
  video_id text NOT NULL,
  last_known_comment_count integer NOT NULL DEFAULT 0,
  is_highlighted boolean NOT NULL DEFAULT false,
  thread_comments_seeded boolean NOT NULL DEFAULT false,
  pinned_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, open_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_manage_comments_post_inbox_state_account
  ON public.tiktok_manage_comments_post_inbox_state (organization_id, open_id);

COMMENT ON TABLE public.tiktok_manage_comments_post_inbox_state IS
  'Per-video inbox state for TikTok Manage Comments (org-level highlight + comment count baseline).';

CREATE TABLE IF NOT EXISTS public.tiktok_manage_comments_inbound_comments (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  open_id text NOT NULL,
  video_id text NOT NULL,
  comment_id text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, open_id, video_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_manage_comments_inbound_comments_account
  ON public.tiktok_manage_comments_inbound_comments (organization_id, open_id);

COMMENT ON TABLE public.tiktok_manage_comments_inbound_comments IS
  'Inbound comment IDs detected on thread poll; cleared from highlight when engaged.';

CREATE TABLE IF NOT EXISTS public.tiktok_manage_comments_comment_engagements (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  open_id text NOT NULL,
  video_id text NOT NULL,
  comment_id text NOT NULL,
  engagement_type text NOT NULL CHECK (engagement_type IN ('like', 'reply')),
  engaged_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  engaged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, open_id, video_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_manage_comments_comment_engagements_account
  ON public.tiktok_manage_comments_comment_engagements (organization_id, open_id);

COMMENT ON TABLE public.tiktok_manage_comments_comment_engagements IS
  'Comments resolved via like or reply in Manage Comments (org-level).';

ALTER TABLE public.tiktok_manage_comments_post_inbox_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_manage_comments_inbound_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_manage_comments_comment_engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_manage_comments_post_inbox_state_deny
  ON public.tiktok_manage_comments_post_inbox_state;
CREATE POLICY tiktok_manage_comments_post_inbox_state_deny
  ON public.tiktok_manage_comments_post_inbox_state
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS tiktok_manage_comments_inbound_comments_deny
  ON public.tiktok_manage_comments_inbound_comments;
CREATE POLICY tiktok_manage_comments_inbound_comments_deny
  ON public.tiktok_manage_comments_inbound_comments
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS tiktok_manage_comments_comment_engagements_deny
  ON public.tiktok_manage_comments_comment_engagements;
CREATE POLICY tiktok_manage_comments_comment_engagements_deny
  ON public.tiktok_manage_comments_comment_engagements
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
