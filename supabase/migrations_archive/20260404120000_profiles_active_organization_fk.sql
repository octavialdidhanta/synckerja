-- Link profiles.active_organization_id to organizations (idempotent)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_active_organization_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_active_organization_id_fkey
      FOREIGN KEY (active_organization_id)
      REFERENCES public.organizations (id)
      ON DELETE SET NULL;
  END IF;
END $$;
