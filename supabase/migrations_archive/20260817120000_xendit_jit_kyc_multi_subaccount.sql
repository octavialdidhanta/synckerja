-- JIT KYC + multi xenPlatform sub-accounts per organization.

-- ---------------------------------------------------------------------------
-- organization_xendit_settings (org-level opt-in)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_xendit_settings (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_xendit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_xendit_settings_org_select ON public.organization_xendit_settings;
CREATE POLICY organization_xendit_settings_org_select
  ON public.organization_xendit_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- organization_kyc_documents (one active row per org)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_kyc_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  business_type text NOT NULL,
  legal_name text NOT NULL,
  identity_number text NULL,
  npwp text NULL,
  nib text NULL,
  ktp_storage_path text NULL,
  legal_doc_storage_path text NULL,
  status text NOT NULL DEFAULT 'PENDING',
  submitted_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_kyc_documents_business_type_check CHECK (
    business_type = ANY (ARRAY['individual', 'company']::text[])
  ),
  CONSTRAINT organization_kyc_documents_status_check CHECK (
    status = ANY (ARRAY['PENDING', 'APPROVED', 'REJECTED']::text[])
  )
);

CREATE INDEX IF NOT EXISTS idx_organization_kyc_documents_org
  ON public.organization_kyc_documents (organization_id);

ALTER TABLE public.organization_kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_kyc_documents_org_select ON public.organization_kyc_documents;
CREATE POLICY organization_kyc_documents_org_select
  ON public.organization_kyc_documents FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- xendit_sub_accounts (one-to-many per org)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xendit_sub_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  xendit_sub_account_id text NULL,
  business_name text NOT NULL,
  email text NOT NULL,
  account_type text NOT NULL DEFAULT 'MANAGED',
  status text NOT NULL DEFAULT 'pending',
  kyc_status text NULL,
  document_upload_status text NOT NULL DEFAULT 'not_required',
  document_upload_error text NULL,
  is_primary boolean NOT NULL DEFAULT false,
  linked_bank_account_id uuid NULL REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xendit_sub_accounts_status_check CHECK (
    status = ANY (ARRAY['pending', 'active', 'suspended', 'failed']::text[])
  ),
  CONSTRAINT xendit_sub_accounts_account_type_check CHECK (
    account_type = ANY (ARRAY['OWNED', 'MANAGED']::text[])
  ),
  CONSTRAINT xendit_sub_accounts_document_upload_status_check CHECK (
    document_upload_status = ANY (
      ARRAY['pending', 'completed', 'failed', 'not_required']::text[]
    )
  ),
  CONSTRAINT xendit_sub_accounts_org_email_key UNIQUE (organization_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_sub_accounts_xendit_id
  ON public.xendit_sub_accounts (xendit_sub_account_id)
  WHERE xendit_sub_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_xendit_sub_accounts_one_primary_per_org
  ON public.xendit_sub_accounts (organization_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_xendit_sub_accounts_org
  ON public.xendit_sub_accounts (organization_id);

ALTER TABLE public.xendit_sub_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xendit_sub_accounts_org_select ON public.xendit_sub_accounts;
CREATE POLICY xendit_sub_accounts_org_select
  ON public.xendit_sub_accounts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Backfill from organization_xendit_accounts
-- ---------------------------------------------------------------------------
INSERT INTO public.organization_xendit_settings (organization_id, is_enabled, enabled_at, created_at, updated_at)
SELECT
  oxa.organization_id,
  oxa.is_enabled,
  oxa.enabled_at,
  oxa.created_at,
  oxa.updated_at
FROM public.organization_xendit_accounts oxa
ON CONFLICT (organization_id) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  enabled_at = EXCLUDED.enabled_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.xendit_sub_accounts (
  organization_id,
  xendit_sub_account_id,
  business_name,
  email,
  account_type,
  status,
  kyc_status,
  document_upload_status,
  is_primary,
  linked_bank_account_id,
  metadata,
  created_at,
  updated_at
)
SELECT
  oxa.organization_id,
  oxa.xendit_sub_account_id,
  oxa.business_name,
  oxa.email,
  oxa.account_type,
  oxa.status,
  oxa.kyc_status,
  'not_required',
  true,
  oxa.linked_bank_account_id,
  oxa.metadata,
  oxa.created_at,
  oxa.updated_at
FROM public.organization_xendit_accounts oxa
WHERE oxa.xendit_sub_account_id IS NOT NULL
ON CONFLICT (organization_id, email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Replace legacy table with compat view (read-only shape for ad-hoc SQL)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.organization_xendit_accounts CASCADE;

CREATE OR REPLACE VIEW public.organization_xendit_accounts AS
SELECT
  s.organization_id,
  x.xendit_sub_account_id,
  COALESCE(x.business_name, 'Organization') AS business_name,
  COALESCE(x.email, '') AS email,
  COALESCE(x.account_type, 'MANAGED') AS account_type,
  s.is_enabled,
  COALESCE(x.status, 'pending') AS status,
  x.kyc_status,
  x.metadata,
  s.enabled_at,
  s.created_at,
  x.updated_at,
  x.linked_bank_account_id
FROM public.organization_xendit_settings s
LEFT JOIN public.xendit_sub_accounts x
  ON x.organization_id = s.organization_id AND x.is_primary = true;

-- ---------------------------------------------------------------------------
-- Storage: xendit-kyc-documents (private, org-scoped paths)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'xendit-kyc-documents',
  'xendit-kyc-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "xendit_kyc_documents_storage_select" ON storage.objects;
CREATE POLICY "xendit_kyc_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'xendit-kyc-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "xendit_kyc_documents_storage_insert" ON storage.objects;
CREATE POLICY "xendit_kyc_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'xendit-kyc-documents'
    AND (storage.foldername (name))[1] = (
      SELECT p.active_organization_id::text
      FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "xendit_kyc_documents_storage_update" ON storage.objects;
CREATE POLICY "xendit_kyc_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'xendit-kyc-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'xendit-kyc-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "xendit_kyc_documents_storage_delete" ON storage.objects;
CREATE POLICY "xendit_kyc_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'xendit-kyc-documents'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );
