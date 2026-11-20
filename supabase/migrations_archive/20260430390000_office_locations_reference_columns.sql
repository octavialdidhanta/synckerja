-- Align public.office_locations with synckerja-reference (types.ts office_locations Row/Insert)
-- and EnhancedAddOfficeLocationModal insert payload (address, formatted_address, google_place_id,
-- map_preferences, planned times, created_by, FKs to location_types / clients / employees).

ALTER TABLE public.office_locations
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS formatted_address text,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS is_client_location boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_verified timestamptz,
  ADD COLUMN IF NOT EXISTS location_type_id uuid,
  ADD COLUMN IF NOT EXISTS map_preferences jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS planned_start_time time without time zone NOT NULL DEFAULT '09:00:00',
  ADD COLUMN IF NOT EXISTS planned_end_time time without time zone NOT NULL DEFAULT '17:00:00',
  ADD COLUMN IF NOT EXISTS sales_person_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.office_locations ol
SET address = COALESCE(NULLIF(btrim(ol.address), ''), ol.name)
WHERE ol.address IS NULL OR btrim(ol.address) = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_office_locations_client') THEN
    ALTER TABLE public.office_locations
      ADD CONSTRAINT fk_office_locations_client
      FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_office_locations_location_type') THEN
    ALTER TABLE public.office_locations
      ADD CONSTRAINT fk_office_locations_location_type
      FOREIGN KEY (location_type_id) REFERENCES public.location_types (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_office_locations_sales_person') THEN
    ALTER TABLE public.office_locations
      ADD CONSTRAINT fk_office_locations_sales_person
      FOREIGN KEY (sales_person_id) REFERENCES public.employees (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'office_locations_created_by_fkey') THEN
    ALTER TABLE public.office_locations
      ADD CONSTRAINT office_locations_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS office_locations_updated_at ON public.office_locations;
CREATE TRIGGER office_locations_updated_at
  BEFORE UPDATE ON public.office_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
