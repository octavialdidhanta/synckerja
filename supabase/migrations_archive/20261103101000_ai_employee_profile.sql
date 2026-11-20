-- AI Employee fase 1: profil, SOP, jadwal, izin, dan kunci status kinerja.
-- Status hanya berubah lewat ai_employee_set_performance_status.
-- Tiket sekali pakai mencegah klien mengatur GUC lalu UPDATE langsung.

CREATE TABLE public.ai_employee_profiles (
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  job_title text NOT NULL DEFAULT 'Content Planner',
  department_id uuid,
  reviewer_employee_id uuid,
  time_zone text NOT NULL DEFAULT 'Asia/Jakarta',
  is_active boolean NOT NULL DEFAULT true,
  performance_status text NOT NULL DEFAULT 'on_track',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id),
  CONSTRAINT ai_employee_profiles_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_profiles_department_org_fkey
    FOREIGN KEY (department_id, organization_id)
    REFERENCES public.departments (id, organization_id)
    ON DELETE SET NULL (department_id),
  CONSTRAINT ai_employee_profiles_reviewer_org_fkey
    FOREIGN KEY (reviewer_employee_id, organization_id)
    REFERENCES public.employees (id, organization_id),
  CONSTRAINT ai_employee_profiles_status_check
    CHECK (performance_status IN ('on_track', 'attention', 'coaching', 'disabled'))
);

CREATE INDEX ai_employee_profiles_org_idx
  ON public.ai_employee_profiles (organization_id);

CREATE TABLE public.ai_employee_sops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_sops_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_sops_code_version_key
    UNIQUE (employee_id, code, version)
);

CREATE UNIQUE INDEX ai_employee_sops_one_current
  ON public.ai_employee_sops (employee_id, code)
  WHERE is_current;

CREATE TABLE public.ai_employee_sop_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.ai_employee_sops (id) ON DELETE CASCADE,
  step_no integer NOT NULL,
  instruction text NOT NULL DEFAULT '',
  may_call_model boolean NOT NULL DEFAULT false,
  CONSTRAINT ai_employee_sop_steps_order_key UNIQUE (sop_id, step_no)
);

CREATE TABLE public.ai_employee_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sop_code text NOT NULL,
  weekday smallint NOT NULL,
  start_local time NOT NULL,
  due_local time NOT NULL,
  window_start_weekday smallint,
  window_end_weekday smallint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_schedules_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_schedules_weekday_check
    CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT ai_employee_schedules_window_check
    CHECK (
      (window_start_weekday IS NULL OR window_start_weekday BETWEEN 1 AND 7)
      AND (window_end_weekday IS NULL OR window_end_weekday BETWEEN 1 AND 7)
    )
);

CREATE TABLE public.ai_employee_permissions (
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  action_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, action_code),
  CONSTRAINT ai_employee_permissions_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE
);

CREATE TABLE public.ai_employee_status_tickets (
  employee_id uuid PRIMARY KEY REFERENCES public.ai_employee_profiles (employee_id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.ai_employee_status_tickets FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ai_employee_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NEW.performance_status IS NOT DISTINCT FROM OLD.performance_status THEN
    RETURN NEW;
  END IF;

  v_token := current_setting('ai_employee.status_write', true);
  IF v_token IS NULL OR v_token = '' THEN
    RAISE EXCEPTION 'performance_status_locked'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.ai_employee_status_tickets
  WHERE employee_id = NEW.employee_id
    AND token = v_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'performance_status_locked'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_employee_profiles_status_guard ON public.ai_employee_profiles;
CREATE TRIGGER ai_employee_profiles_status_guard
  BEFORE UPDATE ON public.ai_employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_status_guard();

CREATE OR REPLACE FUNCTION public.ai_employee_set_performance_status(
  p_employee_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_token text;
BEGIN
  IF p_status NOT IN ('on_track', 'attention', 'coaching', 'disabled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id INTO v_org
  FROM public.ai_employee_profiles
  WHERE employee_id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_org_role(v_org, ARRAY['owner']) THEN
    RAISE EXCEPTION 'owner_required' USING ERRCODE = '42501';
  END IF;

  v_token := gen_random_uuid()::text;
  INSERT INTO public.ai_employee_status_tickets (employee_id, token)
  VALUES (p_employee_id, v_token)
  ON CONFLICT (employee_id) DO UPDATE SET token = EXCLUDED.token, created_at = now();

  PERFORM set_config('ai_employee.status_write', v_token, true);

  UPDATE public.ai_employee_profiles
  SET performance_status = p_status,
      updated_at = now()
  WHERE employee_id = p_employee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_status_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_set_performance_status(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_set_performance_status(uuid, text) TO authenticated;

ALTER TABLE public.ai_employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_sop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_status_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_employee_profiles_select ON public.ai_employee_profiles
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_profiles_write ON public.ai_employee_profiles
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_profiles.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_profiles.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_sops_select ON public.ai_employee_sops
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_sops_write ON public.ai_employee_sops
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_sops.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_sops.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_sop_steps_select ON public.ai_employee_sop_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_employee_sops s
      WHERE s.id = sop_id
        AND s.organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY ai_employee_sop_steps_write ON public.ai_employee_sop_steps
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_employee_sops s
      JOIN public.user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = sop_id
        AND ur.user_id = auth.uid()
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_employee_sops s
      JOIN public.user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = sop_id
        AND ur.user_id = auth.uid()
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_schedules_select ON public.ai_employee_schedules
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_schedules_write ON public.ai_employee_schedules
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_schedules.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_schedules.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_permissions_select ON public.ai_employee_permissions
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_permissions_write ON public.ai_employee_permissions
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_permissions.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_permissions.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

REVOKE ALL ON TABLE public.ai_employee_profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_sops FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_sop_steps FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_schedules FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_permissions FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_sops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_sop_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_permissions TO authenticated;
