-- Late reason modal (useSimpleAttendance.saveLateReason) persists to attendance_records.notes
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS notes text NULL;

COMMENT ON COLUMN public.attendance_records.notes IS 'Optional employee note, e.g. late check-in reason';
