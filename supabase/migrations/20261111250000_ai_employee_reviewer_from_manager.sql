-- Reviewer karyawan AI mengikuti Direct Manager.
-- Atasan harus karyawan manusia di organisasi yang sama dan punya akun login.
-- Kosong atau karyawan AI membuat reviewer kosong. Pergantian atasan ikut tersalin.

CREATE OR REPLACE FUNCTION public.ai_employee_sync_reviewer_from_manager(
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_manager uuid;
  v_is_ai boolean;
  v_reviewer uuid;
BEGIN
  SELECT e.organization_id, e.manager_id, COALESCE(e.is_ai, false)
  INTO v_org, v_manager, v_is_ai
  FROM public.employees e
  WHERE e.id = p_employee_id;

  IF v_org IS NULL OR v_is_ai IS NOT TRUE THEN
    RETURN;
  END IF;

  v_reviewer := NULL;
  IF v_manager IS NOT NULL THEN
    SELECT m.id
    INTO v_reviewer
    FROM public.employees m
    WHERE m.id = v_manager
      AND m.organization_id = v_org
      AND COALESCE(m.is_ai, false) IS NOT TRUE
      AND m.user_id IS NOT NULL;
  END IF;

  UPDATE public.ai_employee_profiles
  SET reviewer_employee_id = v_reviewer,
      updated_at = now()
  WHERE employee_id = p_employee_id
    AND organization_id = v_org
    AND reviewer_employee_id IS DISTINCT FROM v_reviewer;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_sync_reviewer_from_manager(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_sync_reviewer_from_manager(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.employees_sync_ai_reviewer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  IF COALESCE(NEW.is_ai, false) THEN
    PERFORM public.ai_employee_sync_reviewer_from_manager(NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.is_ai IS DISTINCT FROM OLD.is_ai
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
  ) THEN
    FOR r IN
      SELECT e.id
      FROM public.employees e
      WHERE e.manager_id = NEW.id
        AND e.is_ai IS TRUE
        AND e.id <> NEW.id
    LOOP
      PERFORM public.ai_employee_sync_reviewer_from_manager(r.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_sync_ai_reviewer ON public.employees;
CREATE TRIGGER employees_sync_ai_reviewer
  AFTER INSERT OR UPDATE OF manager_id, user_id, is_ai, organization_id
  ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.employees_sync_ai_reviewer();

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
  PERFORM public.ai_employee_sync_reviewer_from_manager(NEW.id);
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT e.id
    FROM public.employees e
    WHERE e.is_ai IS TRUE
  LOOP
    PERFORM public.ai_employee_sync_reviewer_from_manager(r.id);
  END LOOP;
END $$;
