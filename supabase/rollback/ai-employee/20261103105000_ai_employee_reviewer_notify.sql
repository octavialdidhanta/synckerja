-- Rollback 20261103105000_ai_employee_reviewer_notify.sql
-- Hapus baris event AI sebelum CHECK lama dipasang kembali.

DELETE FROM public.daily_task_completion_push_queue
WHERE event_type IN ('run_failed', 'run_late', 'run_deferred', 'revision_returned')
   OR entity_type = 'ai_run';

ALTER TABLE public.daily_task_completion_push_queue
  DROP CONSTRAINT IF EXISTS daily_task_completion_push_queue_event_type_check;

ALTER TABLE public.daily_task_completion_push_queue
  DROP CONSTRAINT IF EXISTS daily_task_completion_push_queue_entity_type_check;

ALTER TABLE public.daily_task_completion_push_queue
  ADD CONSTRAINT daily_task_completion_push_queue_event_type_check
  CHECK (event_type IN ('completed', 'rejected'));

ALTER TABLE public.daily_task_completion_push_queue
  ADD CONSTRAINT daily_task_completion_push_queue_entity_type_check
  CHECK (entity_type IN ('task', 'step', 'substep'));
