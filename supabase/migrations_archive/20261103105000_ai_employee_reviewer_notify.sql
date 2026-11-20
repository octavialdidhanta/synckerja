-- AI Employee fase 1: perluas antrean push yang sudah ada.
-- daily_task_id sudah boleh kosong, jadi kejadian run tidak butuh tugas.
-- Event completed dan rejected tetap sah.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.daily_task_completion_push_queue'::regclass
      AND con.contype = 'c'
      AND (
        pg_get_constraintdef(con.oid) ILIKE '%event_type%'
        OR pg_get_constraintdef(con.oid) ILIKE '%entity_type%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.daily_task_completion_push_queue DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.daily_task_completion_push_queue
  ADD CONSTRAINT daily_task_completion_push_queue_event_type_check
  CHECK (
    event_type IN (
      'completed',
      'rejected',
      'run_failed',
      'run_late',
      'run_deferred',
      'revision_returned'
    )
  );

ALTER TABLE public.daily_task_completion_push_queue
  ADD CONSTRAINT daily_task_completion_push_queue_entity_type_check
  CHECK (entity_type IN ('task', 'step', 'substep', 'ai_run'));

COMMENT ON CONSTRAINT daily_task_completion_push_queue_event_type_check
  ON public.daily_task_completion_push_queue IS
  'Event tugas lama tetap completed/rejected. Event AI Employee memakai run_failed, run_late, run_deferred, revision_returned.';
