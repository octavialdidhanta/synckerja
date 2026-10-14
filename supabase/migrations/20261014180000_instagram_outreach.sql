-- Instagram outreach: org-owned campaigns, manual/comment audiences, and DM materials.
-- Audiences are never stored in a shared pool. Each organization keeps its own rows.
-- RLS matches WhatsApp campaigns: active organization + organization owner.

CREATE OR REPLACE FUNCTION public.touch_instagram_outreach_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.instagram_outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  instagram_business_account_id text NOT NULL,
  name text NOT NULL,
  competitor_username text NOT NULL,
  last_synced_at timestamptz NULL,
  last_sync_error text NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instagram_outreach_campaigns_name_len CHECK (
    char_length(trim(name)) > 0 AND char_length(name) <= 120
  ),
  CONSTRAINT instagram_outreach_campaigns_competitor_username CHECK (
    competitor_username ~ '^[a-z0-9._]{2,30}$'
  ),
  CONSTRAINT instagram_outreach_campaigns_ig_id_len CHECK (
    char_length(trim(instagram_business_account_id)) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_instagram_outreach_campaigns_org_created
  ON public.instagram_outreach_campaigns (organization_id, created_at DESC);

COMMENT ON TABLE public.instagram_outreach_campaigns IS
  'Per-organization Instagram outreach campaign. competitor_username is typed by that tenant; pulls use that org''s connected Instagram account.';

DROP TRIGGER IF EXISTS trg_instagram_outreach_campaigns_updated_at ON public.instagram_outreach_campaigns;
CREATE TRIGGER trg_instagram_outreach_campaigns_updated_at
  BEFORE UPDATE ON public.instagram_outreach_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_instagram_outreach_updated_at();

CREATE TABLE IF NOT EXISTS public.instagram_outreach_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.instagram_outreach_campaigns (id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL,
  attachment_kind text NULL CHECK (attachment_kind IS NULL OR attachment_kind IN ('image', 'video')),
  storage_path text NULL,
  mime text NULL,
  file_name text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instagram_outreach_materials_name_len CHECK (
    char_length(trim(name)) > 0 AND char_length(name) <= 80
  ),
  CONSTRAINT instagram_outreach_materials_body_len CHECK (
    char_length(trim(body)) > 0 AND char_length(body) <= 1000
  ),
  CONSTRAINT instagram_outreach_materials_attachment_pair CHECK (
    (
      attachment_kind IS NULL
      AND storage_path IS NULL
      AND mime IS NULL
    )
    OR (
      attachment_kind IS NOT NULL
      AND storage_path IS NOT NULL
      AND mime IS NOT NULL
    )
  ),
  CONSTRAINT instagram_outreach_materials_path_org CHECK (
    storage_path IS NULL
    OR storage_path LIKE (organization_id::text || '/' || campaign_id::text || '/%')
  )
);

CREATE INDEX IF NOT EXISTS idx_instagram_outreach_materials_campaign_sort
  ON public.instagram_outreach_materials (campaign_id, sort_order, created_at);

COMMENT ON TABLE public.instagram_outreach_materials IS
  'Outreach copy plus one optional image or video. At most five rows per campaign, enforced in the app.';

DROP TRIGGER IF EXISTS trg_instagram_outreach_materials_updated_at ON public.instagram_outreach_materials;
CREATE TRIGGER trg_instagram_outreach_materials_updated_at
  BEFORE UPDATE ON public.instagram_outreach_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_instagram_outreach_updated_at();

CREATE TABLE IF NOT EXISTS public.instagram_outreach_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.instagram_outreach_campaigns (id) ON DELETE CASCADE,
  username text NOT NULL,
  source text NOT NULL CHECK (source IN ('comment', 'manual')),
  manual_kind text NULL,
  comment_text text NULL,
  comment_id text NULL,
  media_permalink text NULL,
  status text NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'copied', 'sent', 'replied', 'converted', 'skipped')
  ),
  copied_at timestamptz NULL,
  sent_at timestamptz NULL,
  replied_at timestamptz NULL,
  converted_at timestamptz NULL,
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instagram_outreach_targets_username CHECK (
    username ~ '^[a-z0-9._]{2,30}$'
  ),
  CONSTRAINT instagram_outreach_targets_manual_kind_chk CHECK (
    (
      source = 'manual'
      AND manual_kind IN ('like', 'repost', 'other')
    )
    OR (
      source = 'comment'
      AND (manual_kind IS NULL OR manual_kind IN ('like', 'repost', 'other'))
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_instagram_outreach_targets_campaign_username
  ON public.instagram_outreach_targets (campaign_id, username);

CREATE INDEX IF NOT EXISTS idx_instagram_outreach_targets_campaign_status
  ON public.instagram_outreach_targets (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_instagram_outreach_targets_org_copied
  ON public.instagram_outreach_targets (organization_id, copied_at)
  WHERE copied_at IS NOT NULL;

COMMENT ON TABLE public.instagram_outreach_targets IS
  'Outreach audience for one campaign. Unique per campaign username. Not shared across organizations.';

DROP TRIGGER IF EXISTS trg_instagram_outreach_targets_updated_at ON public.instagram_outreach_targets;
CREATE TRIGGER trg_instagram_outreach_targets_updated_at
  BEFORE UPDATE ON public.instagram_outreach_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_instagram_outreach_updated_at();

ALTER TABLE public.instagram_outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_outreach_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_outreach_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_outreach_campaigns_select ON public.instagram_outreach_campaigns;
CREATE POLICY instagram_outreach_campaigns_select
  ON public.instagram_outreach_campaigns FOR SELECT
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_campaigns.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_campaigns_insert ON public.instagram_outreach_campaigns;
CREATE POLICY instagram_outreach_campaigns_insert
  ON public.instagram_outreach_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_campaigns.organization_id
    )
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS instagram_outreach_campaigns_update ON public.instagram_outreach_campaigns;
CREATE POLICY instagram_outreach_campaigns_update
  ON public.instagram_outreach_campaigns FOR UPDATE
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_campaigns.organization_id
    )
  )
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_campaigns.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_campaigns_delete ON public.instagram_outreach_campaigns;
CREATE POLICY instagram_outreach_campaigns_delete
  ON public.instagram_outreach_campaigns FOR DELETE
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_campaigns.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_materials_select ON public.instagram_outreach_materials;
CREATE POLICY instagram_outreach_materials_select
  ON public.instagram_outreach_materials FOR SELECT
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_materials.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_materials_insert ON public.instagram_outreach_materials;
CREATE POLICY instagram_outreach_materials_insert
  ON public.instagram_outreach_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_materials.organization_id
    )
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.instagram_outreach_campaigns c
      WHERE c.id = campaign_id
        AND c.organization_id = instagram_outreach_materials.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_materials_update ON public.instagram_outreach_materials;
CREATE POLICY instagram_outreach_materials_update
  ON public.instagram_outreach_materials FOR UPDATE
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_materials.organization_id
    )
  )
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_materials.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM public.instagram_outreach_campaigns c
      WHERE c.id = campaign_id
        AND c.organization_id = instagram_outreach_materials.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_materials_delete ON public.instagram_outreach_materials;
CREATE POLICY instagram_outreach_materials_delete
  ON public.instagram_outreach_materials FOR DELETE
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_materials.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_targets_select ON public.instagram_outreach_targets;
CREATE POLICY instagram_outreach_targets_select
  ON public.instagram_outreach_targets FOR SELECT
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_targets.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_targets_insert ON public.instagram_outreach_targets;
CREATE POLICY instagram_outreach_targets_insert
  ON public.instagram_outreach_targets FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_targets.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM public.instagram_outreach_campaigns c
      WHERE c.id = campaign_id
        AND c.organization_id = instagram_outreach_targets.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_targets_update ON public.instagram_outreach_targets;
CREATE POLICY instagram_outreach_targets_update
  ON public.instagram_outreach_targets FOR UPDATE
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_targets.organization_id
    )
  )
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_targets.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM public.instagram_outreach_campaigns c
      WHERE c.id = campaign_id
        AND c.organization_id = instagram_outreach_targets.organization_id
    )
  );

DROP POLICY IF EXISTS instagram_outreach_targets_delete ON public.instagram_outreach_targets;
CREATE POLICY instagram_outreach_targets_delete
  ON public.instagram_outreach_targets FOR DELETE
  TO authenticated
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = instagram_outreach_targets.organization_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_outreach_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_outreach_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_outreach_targets TO authenticated;
GRANT ALL ON public.instagram_outreach_campaigns TO service_role;
GRANT ALL ON public.instagram_outreach_materials TO service_role;
GRANT ALL ON public.instagram_outreach_targets TO service_role;

-- Private media. Path: {organizationId}/{campaignId}/{materialId}_{file}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instagram-outreach-media',
  'instagram-outreach-media',
  false,
  16777216,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.instagram_outreach_storage_object_allowed(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (storage.foldername(object_name))[1] = (
        SELECT p.active_organization_id::text
        FROM public.profiles p
        WHERE p.user_id = (SELECT auth.uid())
          AND p.active_organization_id IS NOT NULL
        LIMIT 1
      )
    THEN public.user_is_org_owner(((storage.foldername(object_name))[1])::uuid)
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.instagram_outreach_storage_object_allowed(text) IS
  'True when the object''s first folder is the caller''s active organization and the caller owns that organization.';

GRANT EXECUTE ON FUNCTION public.instagram_outreach_storage_object_allowed(text) TO authenticated;

DROP POLICY IF EXISTS instagram_outreach_media_storage_insert ON storage.objects;
CREATE POLICY instagram_outreach_media_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'instagram-outreach-media'
    AND public.instagram_outreach_storage_object_allowed(name)
  );

DROP POLICY IF EXISTS instagram_outreach_media_storage_select ON storage.objects;
CREATE POLICY instagram_outreach_media_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'instagram-outreach-media'
    AND public.instagram_outreach_storage_object_allowed(name)
  );

DROP POLICY IF EXISTS instagram_outreach_media_storage_update ON storage.objects;
CREATE POLICY instagram_outreach_media_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'instagram-outreach-media'
    AND public.instagram_outreach_storage_object_allowed(name)
  )
  WITH CHECK (
    bucket_id = 'instagram-outreach-media'
    AND public.instagram_outreach_storage_object_allowed(name)
  );

DROP POLICY IF EXISTS instagram_outreach_media_storage_delete ON storage.objects;
CREATE POLICY instagram_outreach_media_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'instagram-outreach-media'
    AND public.instagram_outreach_storage_object_allowed(name)
  );

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
    '/omnichannel/campaign/instagram',
    'Instagram Outreach',
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
WHERE d.page_path = '/omnichannel/campaign/instagram'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
