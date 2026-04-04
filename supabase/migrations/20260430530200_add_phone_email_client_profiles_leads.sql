-- From synckerja-reference: phone_number + email on client profile tables and leads.
-- Skips any table that does not exist yet (e.g. CRM bundle migration not applied).
-- Idempotent ADD COLUMN.

-- whatsapp_conversation_client_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_conversation_client_profiles'
  ) THEN
    ALTER TABLE public.whatsapp_conversation_client_profiles
      ADD COLUMN IF NOT EXISTS phone_number TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT;
    COMMENT ON COLUMN public.whatsapp_conversation_client_profiles.phone_number IS 'Client phone number (Nomor Telepon)';
    COMMENT ON COLUMN public.whatsapp_conversation_client_profiles.email IS 'Client email';
  END IF;
END $$;

-- lead_client_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_client_profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lead_client_profiles' AND column_name = 'phone_number'
    ) THEN
      ALTER TABLE public.lead_client_profiles ADD COLUMN phone_number TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lead_client_profiles' AND column_name = 'email'
    ) THEN
      ALTER TABLE public.lead_client_profiles ADD COLUMN email TEXT;
    END IF;
    COMMENT ON COLUMN public.lead_client_profiles.phone_number IS 'Client phone number (Nomor Telepon)';
    COMMENT ON COLUMN public.lead_client_profiles.email IS 'Client email';
  END IF;
END $$;

-- leads
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leads'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'phone_number'
    ) THEN
      ALTER TABLE public.leads ADD COLUMN phone_number TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'email'
    ) THEN
      ALTER TABLE public.leads ADD COLUMN email TEXT;
    END IF;
    COMMENT ON COLUMN public.leads.phone_number IS 'Lead/client phone number (Nomor Telepon)';
    COMMENT ON COLUMN public.leads.email IS 'Lead/client email';
  END IF;
END $$;
