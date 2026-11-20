-- client_visits execution columns for mobile start/end visit flow.
-- Aligns with android-mobile/1-client-visit/pages/ClientVisit.tsx payload.

ALTER TABLE public.client_visits
  ADD COLUMN IF NOT EXISTS actual_start_time timestamptz,
  ADD COLUMN IF NOT EXISTS actual_end_time timestamptz,
  ADD COLUMN IF NOT EXISTS start_location jsonb,
  ADD COLUMN IF NOT EXISTS end_location jsonb,
  ADD COLUMN IF NOT EXISTS start_photo_path text,
  ADD COLUMN IF NOT EXISTS end_photo_path text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS location_validation_result jsonb,
  ADD COLUMN IF NOT EXISTS validation_accuracy_meters numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_visits_created_by_fkey'
  ) THEN
    ALTER TABLE public.client_visits
      ADD CONSTRAINT client_visits_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.client_visits.actual_start_time IS 'Actual visit start timestamp (mobile execution).';
COMMENT ON COLUMN public.client_visits.actual_end_time IS 'Actual visit end timestamp (mobile execution).';
