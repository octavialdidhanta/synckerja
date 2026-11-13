-- The focused carousel queue sent only Master Thought, Angle and Idea to the AI.
-- Add Big Thought and Territory so a focused run reads the whole Thinking Lab chain,
-- like an open run already does. ai_employee_context returns to_jsonb(row), so the
-- new columns reach the prompt (thinkingLine) without further changes.
DO $migrate$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.ai_employee_carousel_paths(uuid)'::regprocedure);
  IF position('big_thought_statement' in v_def) > 0 THEN
    RETURN;
  END IF;

  v_new := replace(v_def,
    'angle_statement text, master_statement text)',
    'angle_statement text, master_statement text, territory_statement text, big_thought_statement text)');
  v_new := replace(v_new,
    'master.statement AS master_statement, pillar.id AS content_pillar_id',
    'master.statement AS master_statement, territory.statement AS territory_statement, thought.statement AS big_thought_statement, pillar.id AS content_pillar_id');
  v_new := replace(v_new,
    'left(btrim(queued.master_statement), 240) AS master_statement FROM queued',
    'left(btrim(queued.master_statement), 240) AS master_statement, left(btrim(COALESCE(queued.territory_statement, '''')), 240) AS territory_statement, left(btrim(COALESCE(queued.big_thought_statement, '''')), 240) AS big_thought_statement FROM queued');

  IF v_new = v_def
    OR position('thought.statement AS big_thought_statement' in v_new) = 0
    OR position('AS big_thought_statement FROM queued' in v_new) = 0
    OR position('big_thought_statement text)' in v_new) = 0 THEN
    RAISE EXCEPTION 'carousel_paths_patch_failed';
  END IF;

  -- A changed RETURNS TABLE needs drop and create.
  DROP FUNCTION public.ai_employee_carousel_paths(uuid);
  EXECUTE v_new;
  REVOKE ALL ON FUNCTION public.ai_employee_carousel_paths(uuid) FROM PUBLIC, anon, authenticated, service_role;
END;
$migrate$;
