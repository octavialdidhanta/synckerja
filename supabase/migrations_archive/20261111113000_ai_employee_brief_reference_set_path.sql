-- substring() with a capture group returned "png" without the dot, so a valid path never matched.
-- The check is the full path: organization, employee, slot, and extension.

CREATE OR REPLACE FUNCTION public.ai_employee_brief_reference_set(
  p_employee_id uuid,
  p_position smallint,
  p_storage_path text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $set$
DECLARE
  v_org uuid;
  v_old text;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  IF p_position IS NULL OR p_position < 1 OR p_position > 5 OR p_storage_path IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_storage_path !~ (
    '^' || v_org::text || '/' || p_employee_id::text || '/' || p_position::text || '\.(png|jpe?g|webp)$'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects object
    WHERE object.bucket_id = 'ai-employee-references'
      AND object.name = p_storage_path
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT ref.storage_path
  INTO v_old
  FROM public.ai_employee_brief_references ref
  WHERE ref.employee_id = p_employee_id
    AND ref.position = p_position;

  INSERT INTO public.ai_employee_brief_references (employee_id, organization_id, position, storage_path, updated_at)
  VALUES (p_employee_id, v_org, p_position, p_storage_path, now())
  ON CONFLICT (employee_id, position) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      storage_path = EXCLUDED.storage_path,
      updated_at = now();

  IF v_old IS NOT NULL AND v_old IS DISTINCT FROM p_storage_path THEN
    DELETE FROM storage.objects object
    WHERE object.bucket_id = 'ai-employee-references'
      AND object.name = v_old;
  END IF;
END;
$set$;

REVOKE ALL ON FUNCTION public.ai_employee_brief_reference_set(uuid, smallint, text) FROM PUBLIC, anon, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_brief_reference_set(uuid, smallint, text) TO authenticated;
