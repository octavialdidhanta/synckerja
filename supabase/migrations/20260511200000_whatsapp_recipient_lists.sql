-- WhatsApp campaign recipient lists + members (CRM-linked; ready for future file upload columns).
-- RLS: organization owner only (organizations.user_id / created_by OR user_roles.role = 'owner').

CREATE OR REPLACE FUNCTION public.user_is_org_owner(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_org_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = p_org_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = p_org_id
          AND lower(trim(ur.role::text)) = 'owner'
      )
    );
$$;

COMMENT ON FUNCTION public.user_is_org_owner(uuid) IS 'True if auth user is org owner via organizations row or user_roles.owner.';

CREATE OR REPLACE FUNCTION public.api_current_user_is_active_org_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_is_org_owner(
    (SELECT p.active_organization_id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()) LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.api_current_user_is_active_org_owner() IS 'True if auth user owns the organization in profiles.active_organization_id.';

GRANT EXECUTE ON FUNCTION public.api_current_user_is_active_org_owner() TO authenticated;

CREATE TABLE IF NOT EXISTS public.whatsapp_recipient_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  creation_source text NOT NULL DEFAULT 'crm_select'
    CHECK (creation_source IN ('crm_select', 'file_upload')),
  upload_status text NOT NULL DEFAULT 'completed'
    CHECK (upload_status IN ('draft', 'processing', 'completed', 'failed')),
  original_file_name text NULL,
  storage_object_path text NULL,
  row_count_expected integer NULL,
  row_count_imported integer NULL,
  error_summary jsonb NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_recipient_lists_name_len CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 120)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_recipient_lists_org_created
  ON public.whatsapp_recipient_lists (organization_id, created_at DESC);

COMMENT ON TABLE public.whatsapp_recipient_lists IS 'Named recipient lists for WhatsApp template campaigns; members in whatsapp_recipient_list_members.';

CREATE OR REPLACE FUNCTION public.update_whatsapp_recipient_lists_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_recipient_lists_updated_at ON public.whatsapp_recipient_lists;
CREATE TRIGGER trg_whatsapp_recipient_lists_updated_at
  BEFORE UPDATE ON public.whatsapp_recipient_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_recipient_lists_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_recipient_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.whatsapp_recipient_lists (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  phone_normalized text NOT NULL,
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,
  conversation_id uuid NULL REFERENCES public.whatsapp_conversations (id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'lead'
    CHECK (origin IN ('lead', 'livechat', 'file')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_recipient_list_members_link_check CHECK (
    origin = 'file'
    OR lead_id IS NOT NULL
    OR conversation_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_recipient_list_members_list_phone
  ON public.whatsapp_recipient_list_members (list_id, phone_normalized);

CREATE INDEX IF NOT EXISTS idx_whatsapp_recipient_list_members_org
  ON public.whatsapp_recipient_list_members (organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_recipient_list_members_lead
  ON public.whatsapp_recipient_list_members (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_recipient_list_members_conv
  ON public.whatsapp_recipient_list_members (conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON TABLE public.whatsapp_recipient_list_members IS 'Recipients: phone_normalized for dedup; lead_id/conversation_id for live CRM name/phone resolution.';

ALTER TABLE public.whatsapp_recipient_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_recipient_list_members ENABLE ROW LEVEL SECURITY;

-- Lists: owner of row.organization_id + active org match
DROP POLICY IF EXISTS whatsapp_recipient_lists_select ON public.whatsapp_recipient_lists;
CREATE POLICY whatsapp_recipient_lists_select
  ON public.whatsapp_recipient_lists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_lists.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_lists.organization_id)
  );

DROP POLICY IF EXISTS whatsapp_recipient_lists_insert ON public.whatsapp_recipient_lists;
CREATE POLICY whatsapp_recipient_lists_insert
  ON public.whatsapp_recipient_lists FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_lists.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_lists.organization_id)
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS whatsapp_recipient_lists_update ON public.whatsapp_recipient_lists;
CREATE POLICY whatsapp_recipient_lists_update
  ON public.whatsapp_recipient_lists FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_lists.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_lists.organization_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_lists.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_lists.organization_id)
  );

DROP POLICY IF EXISTS whatsapp_recipient_lists_delete ON public.whatsapp_recipient_lists;
CREATE POLICY whatsapp_recipient_lists_delete
  ON public.whatsapp_recipient_lists FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_lists.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_lists.organization_id)
  );

-- Members: same org owner gate; list must belong to same org
DROP POLICY IF EXISTS whatsapp_recipient_list_members_select ON public.whatsapp_recipient_list_members;
CREATE POLICY whatsapp_recipient_list_members_select
  ON public.whatsapp_recipient_list_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_list_members.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_list_members.organization_id)
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_recipient_lists rl
      WHERE rl.id = whatsapp_recipient_list_members.list_id
        AND rl.organization_id = whatsapp_recipient_list_members.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_recipient_list_members_insert ON public.whatsapp_recipient_list_members;
CREATE POLICY whatsapp_recipient_list_members_insert
  ON public.whatsapp_recipient_list_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_list_members.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_list_members.organization_id)
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_recipient_lists rl
      WHERE rl.id = whatsapp_recipient_list_members.list_id
        AND rl.organization_id = whatsapp_recipient_list_members.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_recipient_list_members_update ON public.whatsapp_recipient_list_members;
CREATE POLICY whatsapp_recipient_list_members_update
  ON public.whatsapp_recipient_list_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_list_members.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_list_members.organization_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_list_members.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_list_members.organization_id)
  );

DROP POLICY IF EXISTS whatsapp_recipient_list_members_delete ON public.whatsapp_recipient_list_members;
CREATE POLICY whatsapp_recipient_list_members_delete
  ON public.whatsapp_recipient_list_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_recipient_list_members.organization_id
    )
    AND public.user_is_org_owner(whatsapp_recipient_list_members.organization_id)
  );

-- Page access: template in permission_configuration_defaults + per-org rows in permission_configurations
-- (organization_id is NOT NULL after 20260509103000; no system-wide NULL rows.)

-- Defaults catalog (new orgs / seed sync) + per-org copy when missing
DO $$
BEGIN
  IF to_regclass('public.permission_configuration_defaults') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.permission_configuration_defaults (
    page_path,
    page_title,
    is_active,
    roles_allowed,
    job_levels_allowed,
    exceptions,
    exception_paths
  )
  VALUES (
    '/operations/campaign/recipient-lists',
    'WhatsApp Recipient Lists',
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

  IF to_regclass('public.permission_configurations') IS NULL THEN
    RETURN;
  END IF;

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
  WHERE d.page_path = '/operations/campaign/recipient-lists'
    AND NOT EXISTS (
      SELECT 1
      FROM public.permission_configurations p
      WHERE p.organization_id = o.id
        AND p.page_path = d.page_path
    );
END $$;
