-- Entity subtype + extended legal document paths for Xendit KYC.

ALTER TABLE public.organization_kyc_documents
  ADD COLUMN IF NOT EXISTS entity_subtype text NULL,
  ADD COLUMN IF NOT EXISTS director_npwp text NULL,
  ADD COLUMN IF NOT EXISTS director_npwp_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS akta_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS sk_menkeh_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS entity_extra_documents jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.organization_kyc_documents
  DROP CONSTRAINT IF EXISTS organization_kyc_documents_entity_subtype_check;

ALTER TABLE public.organization_kyc_documents
  ADD CONSTRAINT organization_kyc_documents_entity_subtype_check CHECK (
    entity_subtype IS NULL
    OR entity_subtype = ANY (
      ARRAY['corporation', 'sole_proprietor', 'foundation', 'cooperative']::text[]
    )
  );

UPDATE public.organization_kyc_documents
SET entity_subtype = 'corporation'
WHERE business_type = 'company'
  AND entity_subtype IS NULL;
