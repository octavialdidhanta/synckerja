-- Lead Magnet Campaign automation (ManyChat-style IG/FB comment → DM flow).

-- ---------------------------------------------------------------------------
-- 1) lead_magnet_campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_magnet_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL
    CONSTRAINT lead_magnet_campaigns_platform_chk CHECK (platform IN ('instagram', 'facebook')),
  account_id text NOT NULL,
  keyword text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT lead_magnet_campaigns_status_chk CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  comment_reply_text text NOT NULL,
  follow_gate_text text NOT NULL,
  follow_button_label text NOT NULL DEFAULT 'Sudah Follow',
  framework_offer_text text NOT NULL,
  framework_button_label text NOT NULL DEFAULT 'Dapetin Framework',
  delivery_text text NOT NULL,
  delivery_button_label text NOT NULL DEFAULT 'Free Framework',
  delivery_url text NOT NULL,
  skip_follow_gate_if_follower boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_campaigns_org_status
  ON public.lead_magnet_campaigns (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_campaigns_org_account_active
  ON public.lead_magnet_campaigns (organization_id, platform, account_id)
  WHERE status = 'active';

COMMENT ON TABLE public.lead_magnet_campaigns IS
  'ManyChat-style lead magnet campaigns: comment keyword trigger → DM follow gate → asset delivery.';

-- ---------------------------------------------------------------------------
-- 2) lead_magnet_campaign_posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_magnet_campaign_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lead_magnet_campaigns (id) ON DELETE CASCADE,
  media_id text NOT NULL,
  media_permalink text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lead_magnet_campaign_posts UNIQUE (campaign_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_campaign_posts_media
  ON public.lead_magnet_campaign_posts (media_id);

-- ---------------------------------------------------------------------------
-- 3) lead_magnet_enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_magnet_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.lead_magnet_campaigns (id) ON DELETE CASCADE,
  platform text NOT NULL
    CONSTRAINT lead_magnet_enrollments_platform_chk CHECK (platform IN ('instagram', 'facebook')),
  participant_scoped_id text NOT NULL,
  participant_username text NULL,
  comment_id text NULL,
  media_id text NULL,
  conversation_id uuid NULL,
  conversation_table text NULL
    CONSTRAINT lead_magnet_enrollments_conv_table_chk
    CHECK (conversation_table IS NULL OR conversation_table IN ('instagram_conversations', 'facebook_conversations')),
  lead_submission_id uuid NULL REFERENCES public.lead_submissions (id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'comment_matched'
    CONSTRAINT lead_magnet_enrollments_status_chk CHECK (
      status IN (
        'comment_matched',
        'comment_replied',
        'follow_checked',
        'follow_gate_sent',
        'follow_validated',
        'framework_offered',
        'delivered',
        'failed',
        'paused'
      )
    ),
  paused_reason text NULL
    CONSTRAINT lead_magnet_enrollments_paused_chk
    CHECK (paused_reason IS NULL OR paused_reason IN ('assignee_taken_over', 'manual')),
  is_follower_at_start boolean NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lead_magnet_enrollments_participant UNIQUE (campaign_id, participant_scoped_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_enrollments_org_campaign
  ON public.lead_magnet_enrollments (organization_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_enrollments_conversation
  ON public.lead_magnet_enrollments (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) lead_magnet_funnel_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_magnet_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.lead_magnet_enrollments (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.lead_magnet_campaigns (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  event_type text NOT NULL
    CONSTRAINT lead_magnet_funnel_events_type_chk CHECK (
      event_type IN (
        'comment_matched',
        'comment_replied',
        'follow_checked',
        'follow_gate_sent',
        'follow_retry',
        'follow_validated',
        'framework_offered',
        'delivered',
        'dm_failed',
        'follow_check_failed'
      )
    ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_funnel_events_campaign_type
  ON public.lead_magnet_funnel_events (campaign_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_funnel_events_org_created
  ON public.lead_magnet_funnel_events (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Extend lead_submissions
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS lead_magnet_enrollment_id uuid NULL
    REFERENCES public.lead_magnet_enrollments (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_magnet_campaign_id uuid NULL
    REFERENCES public.lead_magnet_campaigns (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_submissions_lead_magnet_campaign
  ON public.lead_submissions (lead_magnet_campaign_id)
  WHERE lead_magnet_campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6) updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_magnet_campaigns_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_magnet_campaigns_updated ON public.lead_magnet_campaigns;
CREATE TRIGGER trg_lead_magnet_campaigns_updated
  BEFORE UPDATE ON public.lead_magnet_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.lead_magnet_campaigns_set_updated_at();

CREATE OR REPLACE FUNCTION public.lead_magnet_enrollments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_magnet_enrollments_updated ON public.lead_magnet_enrollments;
CREATE TRIGGER trg_lead_magnet_enrollments_updated
  BEFORE UPDATE ON public.lead_magnet_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.lead_magnet_enrollments_set_updated_at();

-- ---------------------------------------------------------------------------
-- 7) Pause enrollments when assignee is set (IG + FB livechat)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pause_lead_magnet_enrollments_on_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND (OLD.assignee_id IS NULL OR TRIM(COALESCE(OLD.assignee_id::text, '')) = '')
    AND NEW.assignee_id IS NOT NULL
    AND TRIM(NEW.assignee_id::text) <> ''
  THEN
    UPDATE public.lead_magnet_enrollments e
    SET
      status = 'paused',
      paused_reason = 'assignee_taken_over',
      updated_at = now()
    WHERE e.conversation_id = NEW.id
      AND e.conversation_table = TG_ARGV[0]
      AND e.status NOT IN ('delivered', 'failed', 'paused');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pause_lead_magnet_enrollments_ig ON public.instagram_conversations;
CREATE TRIGGER trg_pause_lead_magnet_enrollments_ig
  AFTER UPDATE OF assignee_id ON public.instagram_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.pause_lead_magnet_enrollments_on_assignee('instagram_conversations');

DROP TRIGGER IF EXISTS trg_pause_lead_magnet_enrollments_fb ON public.facebook_conversations;
CREATE TRIGGER trg_pause_lead_magnet_enrollments_fb
  AFTER UPDATE OF assignee_id ON public.facebook_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.pause_lead_magnet_enrollments_on_assignee('facebook_conversations');

-- ---------------------------------------------------------------------------
-- 8) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_magnet_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_magnet_campaign_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_magnet_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_magnet_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_magnet_campaigns_select_org ON public.lead_magnet_campaigns;
CREATE POLICY lead_magnet_campaigns_select_org
  ON public.lead_magnet_campaigns FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS lead_magnet_campaigns_insert_org ON public.lead_magnet_campaigns;
CREATE POLICY lead_magnet_campaigns_insert_org
  ON public.lead_magnet_campaigns FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS lead_magnet_campaigns_update_org ON public.lead_magnet_campaigns;
CREATE POLICY lead_magnet_campaigns_update_org
  ON public.lead_magnet_campaigns FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS lead_magnet_campaigns_delete_org ON public.lead_magnet_campaigns;
CREATE POLICY lead_magnet_campaigns_delete_org
  ON public.lead_magnet_campaigns FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS lead_magnet_campaign_posts_select_org ON public.lead_magnet_campaign_posts;
CREATE POLICY lead_magnet_campaign_posts_select_org
  ON public.lead_magnet_campaign_posts FOR SELECT TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.lead_magnet_campaigns
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS lead_magnet_campaign_posts_mutate_org ON public.lead_magnet_campaign_posts;
CREATE POLICY lead_magnet_campaign_posts_mutate_org
  ON public.lead_magnet_campaign_posts FOR ALL TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.lead_magnet_campaigns
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.lead_magnet_campaigns
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS lead_magnet_enrollments_select_org ON public.lead_magnet_enrollments;
CREATE POLICY lead_magnet_enrollments_select_org
  ON public.lead_magnet_enrollments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS lead_magnet_funnel_events_select_org ON public.lead_magnet_funnel_events;
CREATE POLICY lead_magnet_funnel_events_select_org
  ON public.lead_magnet_funnel_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Page access
INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES
  (
    '/digital-marketing/lead-magnet',
    'Digital Marketing — Lead Magnet',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/omnichannel/settings/lead-magnet',
    'Omnichannel — Lead Magnet',
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
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path IN ('/digital-marketing/lead-magnet', '/omnichannel/settings/lead-magnet')
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
