-- First migration shipped through the automated pipeline (task step 7 smoke test).
-- Metadata only: adds a description to the function behind the MCP tool tasks.steps.complete.
-- No behavior, permission or data change.

COMMENT ON FUNCTION public.mcp_set_task_step_completed(uuid, uuid, uuid, boolean) IS
  'MCP tool tasks.steps.complete: mark one daily-task step completed or reopen it. '
  'Refuses with substeps_incomplete, substeps_managed or content_plan_locked. '
  'Callable only by service_role (the MCP server).';
