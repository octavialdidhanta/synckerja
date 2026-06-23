-- Org-level default post time for Content Scheduling (WIB).

CREATE TABLE IF NOT EXISTS public.organization_social_media_scheduling_settings (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  default_post_time_wib time NOT NULL DEFAULT '18:00:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_social_media_scheduling_settings IS
  'Per-org social media scheduling defaults (Content Scheduling settings page).';

ALTER TABLE public.organization_social_media_scheduling_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_social_media_scheduling_settings_select_org
  ON public.organization_social_media_scheduling_settings;
CREATE POLICY organization_social_media_scheduling_settings_select_org
  ON public.organization_social_media_scheduling_settings
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS organization_social_media_scheduling_settings_admin_write
  ON public.organization_social_media_scheduling_settings;
CREATE POLICY organization_social_media_scheduling_settings_admin_write
  ON public.organization_social_media_scheduling_settings
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));
