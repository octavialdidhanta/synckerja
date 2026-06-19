-- Separate NIB and NPWP document storage paths for company KYC.

ALTER TABLE public.organization_kyc_documents
  ADD COLUMN IF NOT EXISTS nib_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS npwp_storage_path text NULL;

-- Backfill legacy single legal_doc into nib path when npwp path empty.
UPDATE public.organization_kyc_documents
SET nib_storage_path = legal_doc_storage_path
WHERE business_type = 'company'
  AND legal_doc_storage_path IS NOT NULL
  AND nib_storage_path IS NULL;
