-- Align employee_face_registrations + allowed_ip_addresses with synckerja-reference types.ts
-- (hooks: useSimpleAttendance, useEnhancedFaceRegistration).

ALTER TABLE public.employee_face_registrations
  ADD COLUMN IF NOT EXISTS face_encoding text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS face_image_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS confidence_threshold double precision DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_face_registrations_created_by_fkey'
  ) THEN
    ALTER TABLE public.employee_face_registrations
      ADD CONSTRAINT employee_face_registrations_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS employee_face_registrations_updated_at ON public.employee_face_registrations;
CREATE TRIGGER employee_face_registrations_updated_at
  BEFORE UPDATE ON public.employee_face_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- allowed_ip_addresses: reference Row uses ip_address, name, is_active, etc.
-- Legacy stub used "cidr" only; useSimpleAttendance selects ip_address, name, is_active.
-- ---------------------------------------------------------------------------
ALTER TABLE public.allowed_ip_addresses
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Allowed network',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.allowed_ip_addresses
SET ip_address = cidr
WHERE ip_address IS NULL AND cidr IS NOT NULL;

UPDATE public.allowed_ip_addresses
SET ip_address = '0.0.0.0/32'
WHERE ip_address IS NULL OR btrim(ip_address) = '';

ALTER TABLE public.allowed_ip_addresses ALTER COLUMN ip_address SET NOT NULL;

ALTER TABLE public.allowed_ip_addresses ALTER COLUMN cidr DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allowed_ip_addresses_created_by_fkey'
  ) THEN
    ALTER TABLE public.allowed_ip_addresses
      ADD CONSTRAINT allowed_ip_addresses_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS allowed_ip_addresses_updated_at ON public.allowed_ip_addresses;
CREATE TRIGGER allowed_ip_addresses_updated_at
  BEFORE UPDATE ON public.allowed_ip_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC update for is_active on face rows: 20260430430000_validate_attendance_comprehensive_face_is_active.sql
