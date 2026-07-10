-- Sales-managed tenants: hide /subscription self-service UI in synckerja office when false.
-- Additive only: does not change RLS on organizations.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_self_service_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizations.subscription_self_service_enabled IS
  'When false, synckerja office hides /subscription UI (sales-managed tenant).';
