-- Mobile / HR hooks insert work_schedule_id; align table with app payloads.
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS work_schedule_id uuid NULL
  REFERENCES public.work_schedule_settings (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_work_schedule_id
  ON public.attendance_records (work_schedule_id)
  WHERE work_schedule_id IS NOT NULL;
