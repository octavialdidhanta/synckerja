-- Company module (2-8): company_assets, company_files, asset_assignments, company_values,
-- storage buckets, page access defaults, digital_asset_company_logos (reference-aligned).
-- RLS: org-scoped via public.user_organization_ids().
-- Note: purchase_request_id / expense_id are uuid without FK (procurement tables may not exist).

-- ---------------------------------------------------------------------------
-- company_assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  asset_tag text,
  brand text,
  model text,
  serial_number text,
  condition text,
  purchase_date date,
  purchase_price numeric,
  notes text,
  image_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  purchase_request_id uuid,
  expense_id uuid,
  receipt_confirmed_at timestamptz,
  receipt_confirmed_by uuid,
  assigned_to_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  assigned_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_company_assets_organization_id ON public.company_assets (organization_id);
CREATE INDEX IF NOT EXISTS idx_company_assets_purchase_request_id
  ON public.company_assets (purchase_request_id) WHERE purchase_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_assets_receipt_pending
  ON public.company_assets (receipt_confirmed_at) WHERE receipt_confirmed_at IS NULL AND purchase_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_assets_assigned_to_employee
  ON public.company_assets (assigned_to_employee_id) WHERE assigned_to_employee_id IS NOT NULL;

ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_assets_org_select" ON public.company_assets;
CREATE POLICY "company_assets_org_select"
  ON public.company_assets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_assets_org_insert" ON public.company_assets;
CREATE POLICY "company_assets_org_insert"
  ON public.company_assets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_assets_org_update" ON public.company_assets;
CREATE POLICY "company_assets_org_update"
  ON public.company_assets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_assets_org_delete" ON public.company_assets;
CREATE POLICY "company_assets_org_delete"
  ON public.company_assets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- company_files
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  original_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_category text NOT NULL DEFAULT 'lainnya',
  description text,
  visibility text NOT NULL DEFAULT 'internal',
  owner_id uuid NOT NULL,
  owner_name text NOT NULL,
  employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  expires_at timestamptz,
  source_type varchar(20) DEFAULT 'upload' CHECK (source_type IN ('upload', 'link')),
  link_title text,
  link_description text,
  link_modified_at timestamptz,
  link_owner text,
  link_thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_files_organization_id ON public.company_files (organization_id);
CREATE INDEX IF NOT EXISTS idx_company_files_employee_id ON public.company_files (employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_files_visibility_employee_org
  ON public.company_files (visibility, employee_id, organization_id) WHERE visibility = 'privat';
CREATE INDEX IF NOT EXISTS idx_company_files_visibility_owner_org
  ON public.company_files (visibility, owner_id, organization_id) WHERE visibility = 'privat';
CREATE INDEX IF NOT EXISTS idx_company_files_visibility_internal
  ON public.company_files (organization_id) WHERE visibility = 'internal';
CREATE INDEX IF NOT EXISTS idx_company_files_source_type ON public.company_files (source_type, organization_id);
CREATE INDEX IF NOT EXISTS idx_company_files_link_metadata
  ON public.company_files (source_type, link_title) WHERE source_type = 'link';

ALTER TABLE public.company_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_files_org_select" ON public.company_files;
CREATE POLICY "company_files_org_select"
  ON public.company_files FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_files_org_insert" ON public.company_files;
CREATE POLICY "company_files_org_insert"
  ON public.company_files FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_files_org_update" ON public.company_files;
CREATE POLICY "company_files_org_update"
  ON public.company_files FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_files_org_delete" ON public.company_files;
CREATE POLICY "company_files_org_delete"
  ON public.company_files FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- asset_assignments (document_path nullable for optional return document)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.company_assets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL,
  ended_at timestamptz,
  assigned_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document_path text,
  handover_type text NOT NULL CHECK (handover_type IN ('initial_assignment', 'transfer', 'resignation', 'return')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset_id ON public.asset_assignments (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_organization_id ON public.asset_assignments (organization_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_employee_id ON public.asset_assignments (employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_assignments_ended_at ON public.asset_assignments (ended_at) WHERE ended_at IS NULL;

ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_assignments_org_select" ON public.asset_assignments;
CREATE POLICY "asset_assignments_org_select"
  ON public.asset_assignments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "asset_assignments_org_insert" ON public.asset_assignments;
CREATE POLICY "asset_assignments_org_insert"
  ON public.asset_assignments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "asset_assignments_org_update" ON public.asset_assignments;
CREATE POLICY "asset_assignments_org_update"
  ON public.asset_assignments FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "asset_assignments_org_delete" ON public.asset_assignments;
CREATE POLICY "asset_assignments_org_delete"
  ON public.asset_assignments FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- company_values (dashboard)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  value_text text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_values_organization_id ON public.company_values (organization_id);

ALTER TABLE public.company_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_values_org_select" ON public.company_values;
CREATE POLICY "company_values_org_select"
  ON public.company_values FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_values_org_insert" ON public.company_values;
CREATE POLICY "company_values_org_insert"
  ON public.company_values FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_values_org_update" ON public.company_values;
CREATE POLICY "company_values_org_update"
  ON public.company_values FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "company_values_org_delete" ON public.company_values;
CREATE POLICY "company_values_org_delete"
  ON public.company_values FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Storage: company-files (private; first path segment = organization_id)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-files', 'company-files', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "company_files_storage_select" ON storage.objects;
CREATE POLICY "company_files_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-files'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "company_files_storage_insert" ON storage.objects;
CREATE POLICY "company_files_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-files'
    AND (storage.foldername(name))[1] = (
      SELECT p.active_organization_id::text
      FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "company_files_storage_update" ON storage.objects;
CREATE POLICY "company_files_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-files'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'company-files'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "company_files_storage_delete" ON storage.objects;
CREATE POLICY "company_files_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-files'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: employee-documents (used by company asset images + handover docs; org-scoped path)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "employee_documents_authenticated_all" ON storage.objects;
CREATE POLICY "employee_documents_authenticated_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'employee-documents')
  WITH CHECK (bucket_id = 'employee-documents');

-- ---------------------------------------------------------------------------
-- digital_asset_company_logos + bucket (reference)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digital_asset_company_logos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  brand_name text,
  logo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_asset_company_logos_organization_id
  ON public.digital_asset_company_logos (organization_id);

ALTER TABLE public.digital_asset_company_logos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digital_asset_company_logos_select" ON public.digital_asset_company_logos;
CREATE POLICY "digital_asset_company_logos_select"
  ON public.digital_asset_company_logos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = digital_asset_company_logos.organization_id
    )
  );

DROP POLICY IF EXISTS "digital_asset_company_logos_insert" ON public.digital_asset_company_logos;
CREATE POLICY "digital_asset_company_logos_insert"
  ON public.digital_asset_company_logos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "digital_asset_company_logos_update" ON public.digital_asset_company_logos;
CREATE POLICY "digital_asset_company_logos_update"
  ON public.digital_asset_company_logos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = digital_asset_company_logos.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "digital_asset_company_logos_delete" ON public.digital_asset_company_logos;
CREATE POLICY "digital_asset_company_logos_delete"
  ON public.digital_asset_company_logos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = digital_asset_company_logos.organization_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_digital_asset_company_logos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_digital_asset_company_logos_updated_at ON public.digital_asset_company_logos;
CREATE TRIGGER trigger_digital_asset_company_logos_updated_at
  BEFORE UPDATE ON public.digital_asset_company_logos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_digital_asset_company_logos_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-asset-company-logos', 'digital-asset-company-logos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "digital_asset_company_logos_storage_insert" ON storage.objects;
CREATE POLICY "digital_asset_company_logos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'digital-asset-company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "digital_asset_company_logos_storage_select" ON storage.objects;
CREATE POLICY "digital_asset_company_logos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'digital-asset-company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "digital_asset_company_logos_storage_delete" ON storage.objects;
CREATE POLICY "digital_asset_company_logos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'digital-asset-company-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

-- ---------------------------------------------------------------------------
-- Page access defaults (system-wide)
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
) VALUES
  ('550e8400-e29b-41d4-a716-446655440010', NULL, '/company/dashboard', 'Company Dashboard', TRUE,
   ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('550e8400-e29b-41d4-a716-446655440011', NULL, '/company/company-assets', 'Company Assets', TRUE,
   ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('550e8400-e29b-41d4-a716-446655440012', NULL, '/company/files', 'Company Files', TRUE,
   ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('550e8400-e29b-41d4-a716-446655440013', NULL, '/company/organization', 'Company Organization', TRUE,
   ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;
