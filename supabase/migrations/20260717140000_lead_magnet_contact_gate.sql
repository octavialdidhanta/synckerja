-- Lead Magnet Contact Gate: canonical participant profiles, campaign delivery channels, enrollment/funnel extensions.

-- ---------------------------------------------------------------------------
-- 1) Canonical progressive profile per org + platform + PSID
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_magnet_participant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  platform text NOT NULL
    CONSTRAINT lead_magnet_participant_profiles_platform_chk CHECK (platform IN ('instagram', 'facebook')),
  participant_scoped_id text NOT NULL,
  phone_number text NULL,
  email text NULL,
  canonical_lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,
  canonical_submission_id uuid NULL REFERENCES public.lead_submissions (id) ON DELETE SET NULL,
  last_delivery_channel text NULL
    CONSTRAINT lead_magnet_participant_profiles_delivery_channel_chk
    CHECK (last_delivery_channel IS NULL OR last_delivery_channel IN ('instagram', 'whatsapp', 'email')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lead_magnet_participant_profiles UNIQUE (organization_id, platform, participant_scoped_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_participant_profiles_org
  ON public.lead_magnet_participant_profiles (organization_id);

ALTER TABLE public.lead_magnet_participant_profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2) Campaign contact gate + omnichannel delivery columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS contact_gate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_prompt_text text NULL,
  ADD COLUMN IF NOT EXISTS contact_invalid_text text NULL,
  ADD COLUMN IF NOT EXISTS contact_ack_text text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid NULL
    REFERENCES public.organization_whatsapp_accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_template_name text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_template_language text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_template_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_subject text NULL,
  ADD COLUMN IF NOT EXISTS email_html_body text NULL,
  ADD COLUMN IF NOT EXISTS email_from_name text NULL;

-- ---------------------------------------------------------------------------
-- 3) Org-level Resend from address (optional override)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS lead_magnet_email_from text NULL,
  ADD COLUMN IF NOT EXISTS lead_magnet_email_from_name text NULL;

-- ---------------------------------------------------------------------------
-- 4) Enrollment statuses for contact gate flow
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_magnet_enrollments
  DROP CONSTRAINT IF EXISTS lead_magnet_enrollments_status_chk;

ALTER TABLE public.lead_magnet_enrollments
  ADD CONSTRAINT lead_magnet_enrollments_status_chk CHECK (
    status IN (
      'comment_matched',
      'comment_replied',
      'follow_checked',
      'follow_gate_sent',
      'follow_validated',
      'framework_offered',
      'material_offer_skipped',
      'awaiting_contact',
      'contact_collected',
      'delivered',
      'delivered_whatsapp',
      'delivered_email',
      'delivered_instagram',
      'failed',
      'paused'
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Funnel events for contact gate + delivery channels
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_magnet_funnel_events
  DROP CONSTRAINT IF EXISTS lead_magnet_funnel_events_type_chk;

ALTER TABLE public.lead_magnet_funnel_events
  ADD CONSTRAINT lead_magnet_funnel_events_type_chk CHECK (
    event_type IN (
      'comment_matched',
      'comment_replied',
      'comment_reply_sent',
      'private_reply_sent',
      'private_reply_failed',
      'follow_checked',
      'follow_gate_sent',
      'follow_retry',
      'follow_validated',
      'follow_rechecked_after_opener',
      'follow_gate_skipped_follower',
      'framework_offered',
      'material_offer_skipped',
      'contact_prompt_sent',
      'contact_collected',
      'contact_invalid',
      'contact_window_expired',
      'delivery_whatsapp_sent',
      'delivery_whatsapp_failed',
      'delivery_email_sent',
      'delivery_email_failed',
      'delivery_instagram_sent',
      'delivered',
      'dm_failed',
      'follow_check_failed'
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Backfill participant profiles from existing enrollments + submissions
-- ---------------------------------------------------------------------------
INSERT INTO public.lead_magnet_participant_profiles (
  organization_id,
  platform,
  participant_scoped_id,
  phone_number,
  email,
  canonical_lead_id,
  canonical_submission_id,
  created_at,
  updated_at
)
SELECT DISTINCT ON (e.organization_id, e.platform, e.participant_scoped_id)
  e.organization_id,
  e.platform,
  e.participant_scoped_id,
  NULLIF(TRIM(ls.phone_number), ''),
  NULLIF(TRIM(LOWER(ls.email)), ''),
  e.lead_id,
  e.lead_submission_id,
  e.created_at,
  e.updated_at
FROM public.lead_magnet_enrollments e
LEFT JOIN public.lead_submissions ls ON ls.id = e.lead_submission_id
WHERE e.participant_scoped_id IS NOT NULL
  AND TRIM(e.participant_scoped_id) <> ''
ORDER BY e.organization_id, e.platform, e.participant_scoped_id, e.updated_at DESC
ON CONFLICT (organization_id, platform, participant_scoped_id) DO NOTHING;
