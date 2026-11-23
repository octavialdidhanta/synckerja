-- Reclaim abandoned render jobs sooner so a crashed Agent does not block the queue for 15 minutes.
CREATE OR REPLACE FUNCTION public.agent_job_stale_after()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '3 minutes' $$;

COMMENT ON FUNCTION public.agent_job_stale_after() IS
  'A running agent_jobs row without heartbeat for this long may be claimed again.';
