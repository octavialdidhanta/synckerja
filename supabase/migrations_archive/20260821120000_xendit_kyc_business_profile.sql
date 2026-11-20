-- Business address and proof-of-business for Xendit KYC (phase 2).

ALTER TABLE public.organization_kyc_documents
  ADD COLUMN IF NOT EXISTS business_address jsonb NULL,
  ADD COLUMN IF NOT EXISTS business_website text NULL,
  ADD COLUMN IF NOT EXISTS proof_of_business_storage_path text NULL;
