-- Lint 0029: save_blocker_resolution only inserts into task_step_history_blocker_resolved when the
-- caller’s org matches (same checks as RLS on that table). SECURITY INVOKER keeps behavior while
-- removing DEFINER exposure for signed-in users.
-- Runs before 20260513240000_security_definer_revoke_authenticated_internal.sql.

CREATE OR REPLACE FUNCTION public.save_blocker_resolution(
  p_task_step_history_id uuid,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'description required';
  END IF;

  v_org := public._task_step_history_org_id(p_task_step_history_id);
  IF v_org IS NULL OR NOT (v_org IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.task_step_history_blocker_resolved (task_step_history_id, description, created_by)
  VALUES (p_task_step_history_id, btrim(p_description), (SELECT auth.uid()));
END;
$$;

REVOKE ALL ON FUNCTION public.save_blocker_resolution(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_blocker_resolution(uuid, text) TO authenticated;
