-- Service Agreement document path for Xendit account_verification (required by xenPlatform KYC API).

ALTER TABLE public.organization_kyc_documents
  ADD COLUMN IF NOT EXISTS service_agreement_storage_path text NULL;
