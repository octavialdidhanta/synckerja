-- Lead Magnet: target market on campaigns + snapshot on submissions for Contact export.

ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS target_market text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.lead_magnet_campaigns.target_market IS
  'Free-text target market label (e.g. Funnel Marketing). Required at publish via API.';

ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS lead_magnet_target_market text,
  ADD COLUMN IF NOT EXISTS lead_magnet_campaign_name text;

COMMENT ON COLUMN public.lead_submissions.lead_magnet_target_market IS
  'Snapshot of campaign target_market when contact (phone/email) was captured via Lead Magnet.';
COMMENT ON COLUMN public.lead_submissions.lead_magnet_campaign_name IS
  'Snapshot of campaign name when contact was captured via Lead Magnet.';

CREATE INDEX IF NOT EXISTS idx_lead_submissions_org_lm_target_market
  ON public.lead_submissions (organization_id, lead_magnet_target_market)
  WHERE phone_number IS NOT NULL AND lead_magnet_target_market IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_submissions_org_lm_campaign_phone
  ON public.lead_submissions (organization_id, lead_magnet_campaign_id)
  WHERE phone_number IS NOT NULL AND lead_magnet_campaign_id IS NOT NULL;

-- Omnichannel Contact page permission (same pattern as recipient lists).
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
    '/omnichannel/contact',
    'Omnichannel Contact',
    true,
    ARRAY['owner']::text[],
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
WHERE d.page_path = '/omnichannel/contact'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
