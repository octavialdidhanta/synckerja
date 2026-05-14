-- Ensure phone_number / email on whatsapp_conversation_client_profiles (remote DBs may lack 20260430530200).

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
