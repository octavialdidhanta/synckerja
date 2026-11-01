-- Attach one image file to a step without changing its description or completion.

CREATE OR REPLACE FUNCTION public.mcp_attach_task_step_image(
  p_user_id uuid,
  p_organization_id uuid,
  p_step_id uuid,
  p_filename text,
  p_file_url text,
  p_file_size bigint
)
RETURNS TABLE (
  id uuid,
  step_id uuid,
  filename text,
  file_url text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_filename text;
  v_file_url text;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_step_id IS NULL OR p_file_size IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_filename := btrim(COALESCE(p_filename, ''));
  v_file_url := btrim(COALESCE(p_file_url, ''));
  IF char_length(v_filename) < 1
    OR char_length(v_filename) > 80
    OR position('/' in v_filename) > 0
    OR position(chr(92) in v_filename) > 0
    OR char_length(v_file_url) < 8
    OR char_length(v_file_url) > 2000
    OR left(v_file_url, 8) <> 'https://'
    OR p_file_size < 1
    OR p_file_size > 5242880
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.task_steps step
    JOIN public.daily_tasks task ON task.id = step.task_id
    WHERE step.id = p_step_id
      AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.task_files (task_steps_id, filename, file_url, file_size)
  VALUES (p_step_id, v_filename, v_file_url, p_file_size)
  RETURNING task_files.id INTO v_id;

  id := v_id;
  step_id := p_step_id;
  filename := v_filename;
  file_url := v_file_url;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_attach_task_step_image(uuid, uuid, uuid, text, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_attach_task_step_image(uuid, uuid, uuid, text, text, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_attach_task_step_image(uuid, uuid, uuid, text, text, bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
