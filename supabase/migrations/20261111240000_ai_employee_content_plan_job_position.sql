-- Job Position karyawan AI mengikuti job desc yang dipilih saat rekrut.
-- Saat ini hanya Content Plan.

CREATE OR REPLACE FUNCTION public.ai_employee_assign_content_plan_position(
  p_employee_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_position uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.organization_id = p_organization_id
      AND COALESCE(e.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'karyawan AI tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  SELECT jp.id
  INTO v_position
  FROM public.job_positions jp
  WHERE jp.organization_id = p_organization_id
    AND jp.department_id IS NULL
    AND lower(btrim(jp.name)) = 'content plan'
  ORDER BY jp.is_active DESC, jp.created_at
  LIMIT 1;

  IF v_position IS NULL THEN
    INSERT INTO public.job_positions (organization_id, name, department_id, is_active)
    VALUES (p_organization_id, 'Content Plan', NULL, true)
    RETURNING id INTO v_position;
  ELSE
    UPDATE public.job_positions
    SET is_active = true,
        updated_at = now()
    WHERE id = v_position
      AND is_active IS NOT TRUE;
  END IF;

  UPDATE public.employees
  SET job_position_id = v_position,
      updated_at = now()
  WHERE id = p_employee_id
    AND organization_id = p_organization_id
    AND job_position_id IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_assign_content_plan_position(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_assign_content_plan_position(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.install_ai_employee_built_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.is_ai, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_ai, false) IS TRUE THEN
    RETURN NEW;
  END IF;
  PERFORM public.ai_employee_install_content_plan(NEW.id, NEW.organization_id);
  PERFORM public.ai_employee_assign_content_plan_position(NEW.id, NEW.organization_id);
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT e.id, e.organization_id
    FROM public.employees e
    WHERE e.is_ai IS TRUE
      AND e.job_position_id IS NULL
  LOOP
    PERFORM public.ai_employee_assign_content_plan_position(r.id, r.organization_id);
  END LOOP;
END $$;
