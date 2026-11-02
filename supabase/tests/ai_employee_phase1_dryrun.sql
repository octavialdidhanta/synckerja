BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
-- AI Employee fase 1: penanda karyawan AI dan kuota karyawan manusia.
-- Tidak membuat baris Naya atau data lain.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.is_ai IS
  'True untuk karyawan AI. Tidak dihitung di kuota langganan karyawan manusia.';

ALTER TABLE public.employees
  ADD CONSTRAINT employees_id_organization_id_key UNIQUE (id, organization_id);

ALTER TABLE public.departments
  ADD CONSTRAINT departments_id_organization_id_key UNIQUE (id, organization_id);

CREATE OR REPLACE FUNCTION public.count_active_employees_for_org(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.employees e
  LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
  WHERE e.organization_id = p_org_id
    AND COALESCE(e.pending_removal, false) = false
    AND COALESCE(e.is_ai, false) = false
    AND lower(trim(COALESCE(es.name, 'active'))) IN ('active', 'probation');
$$;

COMMENT ON FUNCTION public.count_active_employees_for_org(uuid) IS
  'Jumlah karyawan manusia aktif/probation. Karyawan is_ai tidak dihitung.';
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
-- AI Employee fase 1: log run, masukan reviewer, dan penghitung panggilan model.

CREATE TABLE public.ai_employee_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sop_code text,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  model_calls integer NOT NULL DEFAULT 0,
  plan_count integer NOT NULL DEFAULT 0,
  object_ids uuid[] NOT NULL DEFAULT '{}',
  note text,
  CONSTRAINT ai_employee_runs_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'deferred', 'late', 'failed', 'returned'))
);

CREATE INDEX ai_employee_runs_employee_started_idx
  ON public.ai_employee_runs (employee_id, started_at DESC);

CREATE TABLE public.ai_employee_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  object_type text NOT NULL,
  object_id uuid,
  reason text NOT NULL,
  reviewer_employee_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '8 weeks'),
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_feedback_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_feedback_reviewer_org_fkey
    FOREIGN KEY (reviewer_employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
);

CREATE INDEX ai_employee_feedback_employee_idx
  ON public.ai_employee_feedback (employee_id, created_at DESC);

CREATE TABLE public.ai_employee_model_calls (
  employee_id uuid NOT NULL,
  usage_date date NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, usage_date),
  CONSTRAINT ai_employee_model_calls_employee_fkey
    FOREIGN KEY (employee_id)
    REFERENCES public.employees (id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_model_calls_count_check
    CHECK (call_count >= 0)
);

ALTER TABLE public.ai_employee_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_model_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_employee_runs_select ON public.ai_employee_runs
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_feedback_select ON public.ai_employee_feedback
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_feedback_insert ON public.ai_employee_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.employees reviewer
      WHERE reviewer.id = reviewer_employee_id
        AND reviewer.user_id = auth.uid()
        AND reviewer.organization_id = ai_employee_feedback.organization_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.ai_employee_profiles p
      WHERE p.employee_id = ai_employee_feedback.employee_id
        AND p.organization_id = ai_employee_feedback.organization_id
        AND p.reviewer_employee_id = ai_employee_feedback.reviewer_employee_id
    )
  );

CREATE POLICY ai_employee_model_calls_select ON public.ai_employee_model_calls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = ai_employee_model_calls.employee_id
        AND e.organization_id IN (SELECT public.user_organization_ids())
    )
  );

REVOKE ALL ON TABLE public.ai_employee_runs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_feedback FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_model_calls FROM PUBLIC, anon;

GRANT SELECT ON public.ai_employee_runs TO authenticated;
GRANT SELECT, INSERT ON public.ai_employee_feedback TO authenticated;
GRANT SELECT ON public.ai_employee_model_calls TO authenticated;
-- AI Employee fase 1: jejak penulis plan, pemohon tugas, dan kode KR.
-- ON DELETE SET NULL hanya pada kolom karyawan (PostgreSQL 15+).
-- organization_id tidak ikut dikosongkan.

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS author_employee_id uuid;

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS requested_ai_employee_id uuid;

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS ai_revision_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.key_results
  ADD COLUMN IF NOT EXISTS ai_kr_code text;

ALTER TABLE public.key_results
  DROP CONSTRAINT IF EXISTS key_results_ai_kr_code_check;

ALTER TABLE public.key_results
  ADD CONSTRAINT key_results_ai_kr_code_check
  CHECK (ai_kr_code IS NULL OR ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5'));

CREATE UNIQUE INDEX IF NOT EXISTS key_results_ai_kr_code_key
  ON public.key_results (individual_objective_id, ai_kr_code)
  WHERE ai_kr_code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'social_media_plans_author_org_fkey'
  ) THEN
    ALTER TABLE public.social_media_plans
      ADD CONSTRAINT social_media_plans_author_org_fkey
      FOREIGN KEY (author_employee_id, organization_id)
      REFERENCES public.employees (id, organization_id)
      ON DELETE SET NULL (author_employee_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_tasks_requested_ai_org_fkey'
  ) THEN
    ALTER TABLE public.daily_tasks
      ADD CONSTRAINT daily_tasks_requested_ai_org_fkey
      FOREIGN KEY (requested_ai_employee_id, organization_id)
      REFERENCES public.employees (id, organization_id)
      ON DELETE SET NULL (requested_ai_employee_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_media_plans_author_post_date_idx
  ON public.social_media_plans (organization_id, author_employee_id, post_date);

COMMENT ON COLUMN public.social_media_plans.author_employee_id IS
  'Karyawan AI yang menulis plan. Bukan pic_id.';
COMMENT ON COLUMN public.daily_tasks.requested_ai_employee_id IS
  'Karyawan AI yang diminta mengerjakan tugas ad-hoc.';
COMMENT ON COLUMN public.key_results.ai_kr_code IS
  'KR1 sampai KR5 untuk KPI karyawan AI. Tidak mengubah metric_type yang sudah ada.';
-- AI Employee fase 1: role runner dan fungsi pintu.
-- Role hanya menerima EXECUTE. Tidak ada SELECT tabel dan tidak BYPASSRLS.
-- service_role tidak menerima EXECUTE. Cadangan itu diputuskan di step 6.

-- CREATE ROLE boleh di dalam transaksi. Dokumentasi Postgres hanya melarang
-- perintah yang disebut eksplisit, misalnya CREATE DATABASE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_employee_runner') THEN
    CREATE ROLE ai_employee_runner NOLOGIN NOINHERIT;
  END IF;
END $$;

ALTER ROLE ai_employee_runner NOBYPASSRLS;
GRANT ai_employee_runner TO authenticator;
GRANT USAGE ON SCHEMA public TO ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_require_run(
  p_employee_id uuid,
  p_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_owner uuid;
  v_status text;
  v_is_ai boolean;
  v_active boolean;
  v_performance text;
BEGIN
  SELECT r.organization_id, r.employee_id, r.status, e.is_ai, p.is_active, p.performance_status
  INTO v_org, v_owner, v_status, v_is_ai, v_active, v_performance
  FROM public.ai_employee_runs r
  JOIN public.employees e
    ON e.id = r.employee_id
   AND e.organization_id IS NOT DISTINCT FROM r.organization_id
  LEFT JOIN public.ai_employee_profiles p ON p.employee_id = e.id
  WHERE r.id = p_run_id
  FOR UPDATE OF r;

  IF NOT FOUND OR v_owner IS DISTINCT FROM p_employee_id OR v_status IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_is_ai, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_ai_employee' USING ERRCODE = '42501';
  END IF;

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_assert_task(
  p_employee_id uuid,
  p_org uuid,
  p_task_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_tasks t
    WHERE t.id = p_task_id
      AND t.organization_id = p_org
      AND (
        t.requested_ai_employee_id = p_employee_id
        OR EXISTS (
          SELECT 1
          FROM public.daily_tasks_assigned a
          WHERE a.daily_task_id = t.id
            AND a.employee_id = p_employee_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_notify_reviewer(
  p_employee_id uuid,
  p_event_type text,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  SELECT p.organization_id, reviewer.user_id
  INTO v_org, v_user
  FROM public.ai_employee_profiles p
  LEFT JOIN public.employees reviewer ON reviewer.id = p.reviewer_employee_id
  WHERE p.employee_id = p_employee_id;

  IF v_org IS NULL OR v_user IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.daily_task_notifications (
    user_id, organization_id, title, body, daily_task_id, created_at
  ) VALUES (
    v_user, v_org, p_title, p_body, NULL, now()
  );

  INSERT INTO public.daily_task_completion_push_queue (
    organization_id, recipient_user_id, event_type, entity_type,
    daily_task_id, title, url
  ) VALUES (
    v_org, v_user, p_event_type, 'ai_run',
    NULL, p_title, '/tools/daily-task?view=jobdesc'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_run_start(
  p_employee_id uuid,
  p_sop_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_is_ai boolean;
  v_active boolean;
  v_performance text;
  v_run uuid;
BEGIN
  SELECT e.organization_id, e.is_ai, p.is_active, p.performance_status
  INTO v_org, v_is_ai, v_active, v_performance
  FROM public.employees e
  LEFT JOIN public.ai_employee_profiles p
    ON p.employee_id = e.id
   AND p.organization_id IS NOT DISTINCT FROM e.organization_id
  WHERE e.id = p_employee_id
  FOR UPDATE OF e;

  IF NOT FOUND OR v_org IS NULL OR COALESCE(v_is_ai, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_ai_employee' USING ERRCODE = '42501';
  END IF;

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status)
  VALUES (p_employee_id, v_org, NULLIF(btrim(COALESCE(p_sop_code, '')), ''), 'running')
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_run_finish(
  p_employee_id uuid,
  p_run_id uuid,
  p_status text,
  p_model_calls integer,
  p_plan_count integer,
  p_object_ids uuid[],
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_event text;
  v_title text;
  v_body text;
BEGIN
  IF p_status NOT IN ('succeeded', 'deferred', 'late', 'failed', 'returned') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);

  UPDATE public.ai_employee_runs
  SET status = p_status,
      finished_at = now(),
      model_calls = COALESCE(p_model_calls, model_calls),
      plan_count = COALESCE(p_plan_count, plan_count),
      object_ids = COALESCE(p_object_ids, object_ids),
      note = COALESCE(p_note, note)
  WHERE id = p_run_id
    AND employee_id = p_employee_id
    AND organization_id = v_org
    AND status = 'running';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = '42501';
  END IF;

  IF p_status = 'succeeded' THEN
    RETURN;
  END IF;

  v_event := CASE p_status
    WHEN 'failed' THEN 'run_failed'
    WHEN 'late' THEN 'run_late'
    WHEN 'deferred' THEN 'run_deferred'
    ELSE 'revision_returned'
  END;

  v_title := CASE p_status
    WHEN 'failed' THEN 'Rencana karyawan AI gagal'
    WHEN 'late' THEN 'Rencana karyawan AI melewati batas'
    WHEN 'deferred' THEN 'Rencana karyawan AI tertunda karena kuota'
    ELSE 'Revisi dikembalikan ke reviewer'
  END;

  v_body := v_title;
  PERFORM public.ai_employee_notify_reviewer(p_employee_id, v_event, v_title, v_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_reserve_model_call(
  p_employee_id uuid,
  p_run_id uuid,
  p_commit boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_jakarta date;
  v_utc date;
  v_cap integer;
  v_used integer;
  v_org_limit integer;
  v_org_used integer;
  v_allowed boolean;
BEGIN
  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);
  v_jakarta := (timezone('Asia/Jakarta', now()))::date;
  v_utc := (timezone('UTC', now()))::date;

  SELECT CASE WHEN performance_status = 'coaching' THEN 8 ELSE 15 END
  INTO v_cap
  FROM public.ai_employee_profiles
  WHERE employee_id = p_employee_id;

  INSERT INTO public.ai_employee_model_calls (employee_id, usage_date, call_count)
  VALUES (p_employee_id, v_jakarta, 0)
  ON CONFLICT (employee_id, usage_date) DO NOTHING;

  SELECT call_count INTO v_used
  FROM public.ai_employee_model_calls
  WHERE employee_id = p_employee_id
    AND usage_date = v_jakarta
  FOR UPDATE;

  SELECT COALESCE(daily_limit, 50)
  INTO v_org_limit
  FROM public.organization_script_ai_config
  WHERE organization_id = v_org;

  IF v_org_limit IS NULL OR v_org_limit < 1 THEN
    v_org_limit := 50;
  END IF;

  SELECT COALESCE(count, 0)
  INTO v_org_used
  FROM public.script_ai_daily_usage
  WHERE organization_id = v_org
    AND usage_date = v_utc;

  v_org_used := COALESCE(v_org_used, 0);
  v_allowed := v_used < v_cap AND v_org_used < v_org_limit;

  IF COALESCE(p_commit, false) AND NOT v_allowed THEN
    RAISE EXCEPTION 'quota_exceeded' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_commit, false) AND v_allowed THEN
    UPDATE public.ai_employee_model_calls
    SET call_count = call_count + 1,
        updated_at = now()
    WHERE employee_id = p_employee_id
      AND usage_date = v_jakarta;
    v_used := v_used + 1;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'used', v_used,
    'cap', v_cap,
    'usage_date', v_jakarta,
    'org_used', v_org_used,
    'org_limit', v_org_limit,
    'org_usage_date', v_utc
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_context(
  p_employee_id uuid,
  p_run_id uuid,
  p_scope text,
  p_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_from date;
  v_to date;
  v_rows jsonb;
BEGIN
  IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks') THEN
    RAISE EXCEPTION 'scope_forbidden' USING ERRCODE = '42501';
  END IF;

  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);
  v_from := COALESCE((NULLIF(p_params->>'from', ''))::date, (timezone('Asia/Jakarta', now()))::date);
  v_to := COALESCE((NULLIF(p_params->>'to', ''))::date, v_from + 7);

  IF p_scope IN ('plans', 'calendar') THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT p.id, p.title, p.brief, p.post_date, p.production_status,
             p.content_pillar_id, p.approved, p.production_approved
      FROM public.social_media_plans p
      WHERE p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
        AND (
          p_scope = 'plans'
          OR (timezone('Asia/Jakarta', p.post_date))::date BETWEEN v_from AND v_to
        )
      ORDER BY p.post_date DESC NULLS LAST
      LIMIT 100
    ) x;
  ELSIF p_scope = 'catalog' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT s.id, s.name
      FROM public.services s
      WHERE s.organization_id = v_org
        AND s.is_active
      ORDER BY s.name
      LIMIT 100
    ) x;
  ELSIF p_scope = 'pillars' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT c.id, c.name
      FROM public.content_pillars c
      WHERE c.is_active
        AND (c.organization_id = v_org OR c.is_default)
      ORDER BY c.name
      LIMIT 100
    ) x;
  ELSIF p_scope = 'thinking' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.statement
      FROM public.thinking_master_thoughts t
      WHERE t.organization_id = v_org
        AND t.status = 'locked'
      ORDER BY t.updated_at DESC
      LIMIT 100
    ) x;
  ELSIF p_scope = 'feedback' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT f.id, f.object_type, f.object_id, f.reason, f.expires_at
      FROM public.ai_employee_feedback f
      WHERE f.employee_id = p_employee_id
        AND f.organization_id = v_org
        AND f.dismissed_at IS NULL
        AND f.expires_at > now()
      ORDER BY f.created_at DESC
      LIMIT 10
    ) x;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.title, t.status, t.due_date, t.priority, t.ai_revision_count,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'title', s.title,
              'order', s."order",
              'is_completed', s.is_completed
            )
            ORDER BY s."order"
          )
          FROM public.task_steps s
          WHERE s.task_id = t.id
        ), '[]'::jsonb) AS steps
      FROM public.daily_tasks t
      WHERE t.organization_id = v_org
        AND (
          t.requested_ai_employee_id = p_employee_id
          OR EXISTS (
            SELECT 1 FROM public.daily_tasks_assigned a
            WHERE a.daily_task_id = t.id
              AND a.employee_id = p_employee_id
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 100
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'scope', p_scope,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_refresh_krs(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_closed integer;
  v_on_time integer;
  v_kr1 numeric;
  v_plan_count integer;
  v_pillar_count integer;
  v_missing_pillar integer;
  v_max_share numeric;
  v_kr3 numeric;
  v_kr3_metric text;
  v_kr3_unit text;
  v_approved integer;
  v_scheduled integer;
  v_kr5 numeric;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.employees
  WHERE id = p_employee_id
    AND COALESCE(is_ai, false);

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_ai_employee' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.key_results kr
    JOIN public.individual_objectives io ON io.id = kr.individual_objective_id
    WHERE io.employee_id = p_employee_id
      AND io.organization_id = v_org
      AND kr.ai_kr_code IN ('KR1', 'KR3', 'KR5')
  ) THEN
    RETURN;
  END IF;

  -- Penyebut sementara: run SOP1 yang sudah ditutup. Penyebut yang benar adalah
  -- minggu yang dijadwalkan. Itu diperbaiki di step 5 saat instance jadwal ada.
  SELECT
    COUNT(*) FILTER (
      WHERE status IN ('succeeded', 'late', 'failed', 'deferred', 'returned')
    ),
    COUNT(*) FILTER (
      WHERE status = 'succeeded'
        AND finished_at IS NOT NULL
        AND EXTRACT(ISODOW FROM timezone('Asia/Jakarta', started_at)) = 5
        AND timezone('Asia/Jakarta', finished_at)
            <= date_trunc('day', timezone('Asia/Jakarta', started_at)) + interval '17 hours'
    )
  INTO v_closed, v_on_time
  FROM public.ai_employee_runs
  WHERE employee_id = p_employee_id
    AND organization_id = v_org
    AND sop_code = 'SOP1';

  v_kr1 := CASE
    WHEN COALESCE(v_closed, 0) = 0 THEN 0
    ELSE ROUND((100.0 * v_on_time / v_closed)::numeric, 2)
  END;

  UPDATE public.key_results kr
  SET current_value = v_on_time,
      progress_percentage = v_kr1,
      metric_type = 'percentage',
      unit = '%',
      updated_at = now()
  FROM public.individual_objectives io
  WHERE kr.individual_objective_id = io.id
    AND io.employee_id = p_employee_id
    AND io.organization_id = v_org
    AND kr.ai_kr_code = 'KR1';

  SELECT COUNT(*)
  INTO v_plan_count
  FROM public.social_media_plans p
  WHERE p.organization_id = v_org
    AND p.author_employee_id = p_employee_id
    AND p.post_date >= now() - interval '28 days';

  SELECT COUNT(*)
  INTO v_pillar_count
  FROM public.content_pillars c
  WHERE c.is_active
    AND (c.organization_id = v_org OR c.is_default);

  IF v_plan_count < 5 OR v_pillar_count < 3 THEN
    v_kr3 := 0;
    v_kr3_metric := 'unrated';
    v_kr3_unit := 'belum dinilai';
  ELSE
    SELECT COUNT(*) FILTER (WHERE content_pillar_id IS NULL)
    INTO v_missing_pillar
    FROM public.social_media_plans p
    WHERE p.organization_id = v_org
      AND p.author_employee_id = p_employee_id
      AND p.post_date >= now() - interval '28 days';

    SELECT MAX(cnt)::numeric / NULLIF(v_plan_count, 0)
    INTO v_max_share
    FROM (
      SELECT COUNT(*) AS cnt
      FROM public.social_media_plans p
      WHERE p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
        AND p.post_date >= now() - interval '28 days'
      GROUP BY p.content_pillar_id
    ) shares;

    IF COALESCE(v_missing_pillar, 0) > 0 OR COALESCE(v_max_share, 0) = 0 THEN
      v_kr3 := 0;
    ELSE
      v_kr3 := LEAST(100, ROUND((100.0 * 0.40 / v_max_share)::numeric, 2));
    END IF;
    v_kr3_metric := 'percentage';
    v_kr3_unit := '%';
  END IF;

  UPDATE public.key_results kr
  SET current_value = CASE WHEN v_kr3_metric = 'unrated' THEN NULL ELSE v_kr3 END,
      progress_percentage = v_kr3,
      metric_type = v_kr3_metric,
      unit = v_kr3_unit,
      updated_at = now()
  FROM public.individual_objectives io
  WHERE kr.individual_objective_id = io.id
    AND io.employee_id = p_employee_id
    AND io.organization_id = v_org
    AND kr.ai_kr_code = 'KR3';

  SELECT COUNT(*)
  INTO v_approved
  FROM public.social_media_plans p
  WHERE p.organization_id = v_org
    AND p.author_employee_id = p_employee_id
    AND p.production_approved;

  SELECT COUNT(*)
  INTO v_scheduled
  FROM public.social_media_plans p
  WHERE p.organization_id = v_org
    AND p.author_employee_id = p_employee_id
    AND p.production_approved
    AND p.production_approved_date IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.social_media_scheduled_posts sp
      WHERE sp.social_media_plan_id = p.id
        AND sp.scheduled_at BETWEEN p.production_approved_date - interval '7 days'
                                AND p.production_approved_date + interval '7 days'
    );

  v_kr5 := CASE
    WHEN COALESCE(v_approved, 0) = 0 THEN 0
    ELSE ROUND((100.0 * v_scheduled / v_approved)::numeric, 2)
  END;

  UPDATE public.key_results kr
  SET current_value = v_scheduled,
      progress_percentage = v_kr5,
      metric_type = 'percentage',
      unit = '%',
      updated_at = now()
  FROM public.individual_objectives io
  WHERE kr.individual_objective_id = io.id
    AND io.employee_id = p_employee_id
    AND io.organization_id = v_org
    AND kr.ai_kr_code = 'KR5';

  UPDATE public.individual_objectives io
  SET progress_percentage = scored.score,
      updated_at = now()
  FROM (
    SELECT io2.id,
      COALESCE(
        ROUND(
          (
            SUM(COALESCE(kr.weight, 0) * COALESCE(kr.progress_percentage, 0))
            / NULLIF(SUM(COALESCE(kr.weight, 0)), 0)
          )::numeric,
          2
        ),
        0
      ) AS score
    FROM public.individual_objectives io2
    JOIN public.key_results kr ON kr.individual_objective_id = io2.id
    WHERE io2.employee_id = p_employee_id
      AND io2.organization_id = v_org
      AND COALESCE(kr.metric_type, '') NOT IN ('manual', 'unrated')
    GROUP BY io2.id
  ) scored
  WHERE io.id = scored.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_perform(
  p_employee_id uuid,
  p_run_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_payload_org uuid;
  v_id uuid;
  v_task uuid;
  v_parent uuid;
  v_assigner uuid;
  v_title text;
  v_brief text;
  v_pillar uuid;
  v_post timestamptz;
  v_order integer;
  v_entity text;
  v_brief_token text;
BEGIN
  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);

  IF p_action = ANY (ARRAY[
    'content.plans.schedule',
    'tasks.delete',
    'tasks.steps.delete',
    'tasks.substeps.delete',
    'session.switchOrg'
  ]) OR p_action LIKE 'finance.%'
    OR p_action LIKE 'payroll.%'
    OR p_action LIKE 'hr.%'
    OR p_action LIKE 'crm.%'
    OR p_action LIKE 'ads.%'
  THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT (p_action = ANY (ARRAY[
    'content.plans.create',
    'content.plans.update',
    'content.briefs.create',
    'thinking.plan.save',
    'thinking.plan.direct',
    'thinking.execution.check',
    'tasks.update',
    'tasks.steps.create',
    'tasks.steps.update',
    'tasks.substeps.create',
    'tasks.completion.request'
  ])) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_permissions perm
    WHERE perm.employee_id = p_employee_id
      AND perm.action_code = p_action
  ) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_payload->>'approved', '') IN ('true', 't', '1')
    OR COALESCE(v_payload->>'production_approved', '') IN ('true', 't', '1')
    OR lower(btrim(COALESCE(v_payload->>'production_status', ''))) = 'approved'
    OR (
      p_action = 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', 'pending'))) <> 'pending'
    )
    OR (
      p_action LIKE 'tasks.%'
      AND p_action <> 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', ''))) IN ('completed', 'cancelled', 'approved')
    )
  THEN
    RAISE EXCEPTION 'approval_forbidden' USING ERRCODE = '42501';
  END IF;

  IF jsonb_exists(v_payload, 'organization_id') THEN
    BEGIN
      v_payload_org := NULLIF(v_payload->>'organization_id', '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END;
    IF v_payload_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'thinking.execution.check' THEN
    RETURN jsonb_build_object('ok', true, 'accepted', true, 'model_call', true);
  END IF;

  IF p_action IN ('content.plans.create', 'thinking.plan.save', 'thinking.plan.direct') THEN
    v_title := NULLIF(btrim(COALESCE(v_payload->>'title', '')), '');
    v_brief := NULLIF(v_payload->>'brief', '');
    IF v_title IS NULL OR char_length(v_title) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF v_brief IS NOT NULL AND char_length(v_brief) > 200000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(v_payload->>'post_date', '') IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';

    IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL
      OR p_action LIKE 'thinking.%'
    THEN
      v_pillar := NULLIF(v_payload->>'content_pillar_id', '')::uuid;
      IF v_pillar IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.content_pillars c
        WHERE c.id = v_pillar
          AND c.is_active
          AND (c.organization_id = v_org OR c.is_default)
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id,
      author_employee_id, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar,
      p_employee_id, 'Need Review', false, false, 'draft'
    )
    RETURNING id INTO v_id;

    UPDATE public.ai_employee_runs
    SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END,
        plan_count = plan_count + 1
    WHERE id = p_run_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action IN ('content.plans.update', 'content.briefs.create') THEN
    v_id := NULLIF(v_payload->>'plan_id', '')::uuid;
    IF v_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.social_media_plans p
      WHERE p.id = v_id
        AND p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'content.briefs.create' THEN
      v_brief := NULLIF(v_payload->>'brief', '');
      IF v_brief IS NULL THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET brief = v_brief,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    ELSE
      IF jsonb_exists(v_payload, 'title') THEN
        v_title := NULLIF(btrim(v_payload->>'title'), '');
        IF v_title IS NULL OR char_length(v_title) > 200 THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NULLIF(v_payload->>'post_date', '') IS NOT NULL THEN
        v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';
      END IF;
      IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL THEN
        v_pillar := (v_payload->>'content_pillar_id')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.content_pillars c
          WHERE c.id = v_pillar
            AND c.is_active
            AND (c.organization_id = v_org OR c.is_default)
        ) THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET title = COALESCE(v_title, title),
          brief = CASE WHEN jsonb_exists(v_payload, 'brief') THEN v_payload->>'brief' ELSE brief END,
          post_date = COALESCE(v_post, post_date),
          content_pillar_id = COALESCE(v_pillar, content_pillar_id),
          author_employee_id = p_employee_id,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.update' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.daily_tasks
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        priority = COALESCE(NULLIF(v_payload->>'priority', ''), priority),
        due_date = CASE
          WHEN NULLIF(v_payload->>'due_date', '') IS NULL THEN due_date
          ELSE (v_payload->>'due_date')::timestamptz
        END,
        updated_at = now()
    WHERE id = v_task
      AND organization_id = v_org;
    RETURN jsonb_build_object('ok', true, 'id', v_task);
  END IF;

  IF p_action = 'tasks.steps.create' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_title := COALESCE(NULLIF(v_payload->>'title', ''), '');
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps (task_id, title, description, "order")
    VALUES (v_task, v_title, v_payload->>'description', v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_steps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.steps.update' THEN
    v_id := NULLIF(v_payload->>'step_id', '')::uuid;
    SELECT task_id INTO v_task FROM public.task_steps WHERE id = v_id;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.task_steps
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        "order" = COALESCE((NULLIF(v_payload->>'order', ''))::integer, "order"),
        is_completed = CASE
          WHEN jsonb_exists(v_payload, 'is_completed') THEN (v_payload->>'is_completed')::boolean
          ELSE is_completed
        END,
        updated_at = now()
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.substeps.create' THEN
    v_parent := NULLIF(v_payload->>'parent_step_id', '')::uuid;
    SELECT s.task_id INTO v_task
    FROM public.task_steps s
    JOIN public.daily_tasks t ON t.id = s.task_id
    WHERE s.id = v_parent
      AND t.organization_id = v_org;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps_to_steps (parent_step_id, organization_id, title, "order")
    VALUES (v_parent, v_org, COALESCE(NULLIF(v_payload->>'title', ''), ''), v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_substeps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  v_entity := COALESCE(NULLIF(v_payload->>'entity_type', ''), 'task');
  IF v_entity NOT IN ('task', 'step', 'substep') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_task := NULLIF(v_payload->>'task_id', '')::uuid;
  IF v_entity = 'step' THEN
    SELECT task_id INTO v_task
    FROM public.task_steps
    WHERE id = NULLIF(v_payload->>'step_id', '')::uuid;
  ELSIF v_entity = 'substep' THEN
    SELECT s.task_id INTO v_task
    FROM public.task_steps_to_steps sub
    JOIN public.task_steps s ON s.id = sub.parent_step_id
    WHERE sub.id = NULLIF(v_payload->>'substep_id', '')::uuid;
  END IF;

  PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);

  SELECT a.assigned_by INTO v_assigner
  FROM public.daily_tasks_assigned a
  WHERE a.daily_task_id = v_task
  ORDER BY a.assigned_at DESC
  LIMIT 1;

  IF v_assigner IS NULL THEN
    RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.completion_approvals (
    organization_id, entity_type, daily_task_id, task_step_id, task_steps_to_steps_id,
    assignee_employee_id, assigner_employee_id, status
  ) VALUES (
    v_org,
    v_entity,
    v_task,
    NULLIF(v_payload->>'step_id', '')::uuid,
    NULLIF(v_payload->>'substep_id', '')::uuid,
    p_employee_id,
    v_assigner,
    'pending'
  )
  RETURNING id INTO v_id;

  UPDATE public.ai_employee_runs
  SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END
  WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_require_run(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_assert_task(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_notify_reviewer(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.ai_employee_run_start(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_run_finish(uuid, uuid, text, integer, integer, uuid[], text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_reserve_model_call(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_refresh_krs(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.ai_employee_run_start(uuid, text) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_run_finish(uuid, uuid, text, integer, integer, uuid[], text) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_reserve_model_call(uuid, uuid, boolean) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_refresh_krs(uuid) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) TO ai_employee_runner;

REVOKE ALL ON FUNCTION public.ai_employee_set_performance_status(uuid, text) FROM ai_employee_runner;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ai_employee_runner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_employee_runner;
-- AI Employee fase 1: perluas antrean push yang sudah ada.
-- daily_task_id sudah boleh kosong, jadi kejadian run tidak butuh tugas.
-- Event completed dan rejected tetap sah.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.daily_task_completion_push_queue'::regclass
      AND con.contype = 'c'
      AND (
        pg_get_constraintdef(con.oid) ILIKE '%event_type%'
        OR pg_get_constraintdef(con.oid) ILIKE '%entity_type%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.daily_task_completion_push_queue DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.daily_task_completion_push_queue
  ADD CONSTRAINT daily_task_completion_push_queue_event_type_check
  CHECK (
    event_type IN (
      'completed',
      'rejected',
      'run_failed',
      'run_late',
      'run_deferred',
      'revision_returned'
    )
  );

ALTER TABLE public.daily_task_completion_push_queue
  ADD CONSTRAINT daily_task_completion_push_queue_entity_type_check
  CHECK (entity_type IN ('task', 'step', 'substep', 'ai_run'));

COMMENT ON CONSTRAINT daily_task_completion_push_queue_event_type_check
  ON public.daily_task_completion_push_queue IS
  'Event tugas lama tetap completed/rejected. Event AI Employee memakai run_failed, run_late, run_deferred, revision_returned.';
-- Tiket sekali pakai agar karyawan AI boleh mengubah brief tanpa mematikan trigger.
-- User manusia tetap hanya boleh mengubah brief bila ia PIC plan itu.

CREATE TABLE public.ai_employee_brief_tickets (
  plan_id uuid PRIMARY KEY REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.ai_employee_brief_tickets FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.ai_employee_brief_tickets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.guard_social_media_plan_brief_pic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NEW.brief IS NOT DISTINCT FROM OLD.brief THEN
    RETURN NEW;
  END IF;

  IF public.is_plan_pic(OLD.id) THEN
    RETURN NEW;
  END IF;

  v_token := current_setting('ai_employee.brief_write', true);
  IF v_token IS NOT NULL AND v_token <> '' THEN
    DELETE FROM public.ai_employee_brief_tickets
    WHERE plan_id = OLD.id
      AND token = v_token;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Only the PIC can edit brief content'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_social_media_plan_brief_pic() FROM PUBLIC, anon, authenticated, service_role;
-- Uji migration AI Employee fase 1 pada Supabase lokal.
-- Gagal dengan RAISE EXCEPTION. Transaksi di-rollback agar tidak menyisakan data.
--
-- psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/ai_employee_phase1.sql

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.insert_auth_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_names text[] := ARRAY[
    'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
    'email_confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
    'created_at', 'updated_at', 'confirmation_token', 'recovery_token',
    'email_change_token_new', 'email_change', 'is_sso_user', 'is_anonymous'
  ];
  v_name text;
  v_cols text[] := ARRAY[]::text[];
  v_vals text[] := ARRAY[]::text[];
  v_value text;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = v_name
        AND COALESCE(is_generated, 'NEVER') = 'NEVER'
    ) THEN
      v_value := CASE v_name
        WHEN 'instance_id' THEN quote_literal('00000000-0000-0000-0000-000000000000')
        WHEN 'id' THEN quote_literal(p_id::text)
        WHEN 'aud' THEN quote_literal('authenticated')
        WHEN 'role' THEN quote_literal('authenticated')
        WHEN 'email' THEN quote_literal(p_email)
        WHEN 'encrypted_password' THEN quote_literal('test-not-a-real-password')
        WHEN 'email_confirmed_at' THEN 'now()'
        WHEN 'raw_app_meta_data' THEN quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'
        WHEN 'raw_user_meta_data' THEN quote_literal('{}') || '::jsonb'
        WHEN 'created_at' THEN 'now()'
        WHEN 'updated_at' THEN 'now()'
        WHEN 'confirmation_token' THEN quote_literal('')
        WHEN 'recovery_token' THEN quote_literal('')
        WHEN 'email_change_token_new' THEN quote_literal('')
        WHEN 'email_change' THEN quote_literal('')
        WHEN 'is_sso_user' THEN 'false'
        WHEN 'is_anonymous' THEN 'false'
      END;
      v_cols := v_cols || quote_ident(v_name);
      v_vals := v_vals || v_value;
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO auth.users (%s) VALUES (%s)',
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', ')
  );

  IF to_regclass('auth.identities') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = p_id) THEN
    BEGIN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        p_id,
        jsonb_build_object('sub', p_id::text, 'email', p_email),
        'email',
        p_id::text,
        now(),
        now()
      );
    EXCEPTION
      WHEN undefined_column OR not_null_violation THEN
        NULL;
    END;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.assert_denied(p_sql text, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected % but the statement succeeded', p_message;
EXCEPTION
  WHEN insufficient_privilege THEN
    IF SQLERRM IS DISTINCT FROM p_message THEN
      RAISE EXCEPTION 'expected "%" but got "%"', p_message, SQLERRM;
    END IF;
END;
$fn$;

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_human uuid := gen_random_uuid();
  v_human_b uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_ai_b uuid := gen_random_uuid();
  v_other_ai uuid := gen_random_uuid();
  v_disposable uuid := gen_random_uuid();
  v_alt_reviewer uuid := gen_random_uuid();
  v_run uuid;
  v_other_run uuid;
  v_closed uuid;
  v_plan uuid;
  v_day text;
  v_friday date;
  v_start timestamptz;
  v_on_time timestamptz;
  v_late timestamptz;
  v_task uuid;
  v_cycle uuid;
  v_objective uuid;
  v_keep_org uuid;
  v_keep_author uuid;
  v_count integer;
  v_status text;
  v_context jsonb;
  v_rows integer;
  v_progress numeric;
  v_metric text;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_owner, 'ai-employee-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'ai-employee-member@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES
    (v_org, 'AI Employee Test Org', 'software', v_owner),
    (v_org_b, 'AI Employee Other Org', 'software', v_owner);

  INSERT INTO public.user_organizations (user_id, organization_id)
  VALUES (v_owner, v_org), (v_member, v_org), (v_owner, v_org_b);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_owner, v_org, 'owner'),
    (v_member, v_org, 'employee'),
    (v_owner, v_org_b, 'owner');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_human, v_org, 'Reviewer Uji', v_owner, false),
    (v_alt_reviewer, v_org, 'Reviewer Lain Org Sama', v_owner, false),
    (v_human_b, v_org_b, 'Reviewer Org Lain', v_owner, false),
    (v_ai, v_org, 'Karyawan AI Uji', NULL, true),
    (v_ai_b, v_org_b, 'Karyawan AI Org Lain', NULL, true),
    (v_other_ai, v_org, 'Karyawan AI Kedua', NULL, true),
    (v_disposable, v_org, 'Karyawan AI Hapus', NULL, true);

  BEGIN
    INSERT INTO public.ai_employee_profiles (employee_id, organization_id)
    VALUES (v_ai, v_org_b);
    RAISE EXCEPTION 'cross-org profile should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.ai_employee_profiles (employee_id, organization_id, reviewer_employee_id)
    VALUES (v_ai, v_org, v_human_b);
    RAISE EXCEPTION 'cross-org reviewer should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.social_media_plans (organization_id, title, author_employee_id)
    VALUES (v_org_b, 'Plan lintas org', v_ai);
    RAISE EXCEPTION 'cross-org plan should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.daily_tasks (organization_id, title, requested_ai_employee_id)
    VALUES (v_org_b, 'Tugas lintas org', v_ai);
    RAISE EXCEPTION 'cross-org task should fail';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, reviewer_employee_id, is_active, performance_status
  ) VALUES
    (v_ai, v_org, v_human, true, 'on_track'),
    (v_other_ai, v_org, v_human, true, 'on_track'),
    (v_disposable, v_org, v_human, true, 'on_track');

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    INSERT INTO public.ai_employee_feedback (
      employee_id, organization_id, object_type, reason, reviewer_employee_id
    ) VALUES (
      v_ai, v_org, 'plan', 'Reviewer bukan di profil', v_alt_reviewer
    );
    RAISE EXCEPTION 'feedback from a different reviewer should fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%row-level security%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.ai_employee_feedback (
    employee_id, organization_id, object_type, reason, reviewer_employee_id
  ) VALUES (
    v_ai, v_org, 'plan', 'Masukan reviewer profil', v_human
  );
  EXECUTE 'RESET ROLE';

  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_feedback
    WHERE employee_id = v_ai
      AND reviewer_employee_id = v_human
      AND reason = 'Masukan reviewer profil'
  ) THEN
    RAISE EXCEPTION 'profile reviewer feedback was not stored';
  END IF;

  INSERT INTO public.social_media_plans (organization_id, title, author_employee_id, production_status)
  VALUES (v_org, 'Plan yang org-nya harus tetap', v_disposable, 'Need Review')
  RETURNING id, organization_id, author_employee_id
  INTO v_plan, v_keep_org, v_keep_author;

  INSERT INTO public.daily_tasks (organization_id, title, requested_ai_employee_id)
  VALUES (v_org, 'Tugas yang org-nya harus tetap', v_disposable)
  RETURNING id INTO v_task;

  DELETE FROM public.employees WHERE id = v_disposable;

  SELECT organization_id, author_employee_id
  INTO v_keep_org, v_keep_author
  FROM public.social_media_plans
  WHERE id = v_plan;

  IF v_keep_org IS DISTINCT FROM v_org OR v_keep_author IS NOT NULL THEN
    RAISE EXCEPTION 'deleting AI employee nulled organization or kept author: org=% author=%', v_keep_org, v_keep_author;
  END IF;

  SELECT organization_id, requested_ai_employee_id
  INTO v_keep_org, v_keep_author
  FROM public.daily_tasks
  WHERE id = v_task;

  IF v_keep_org IS DISTINCT FROM v_org OR v_keep_author IS NOT NULL THEN
    RAISE EXCEPTION 'deleting AI employee nulled task organization or kept requester: org=% requester=%', v_keep_org, v_keep_author;
  END IF;

  v_count := public.count_active_employees_for_org(v_org);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'human employees should be counted and AI employees excluded, got %', v_count;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member)::text, true);
  PERFORM pg_temp.assert_denied(
    format('SELECT public.ai_employee_set_performance_status(%L, %L)', v_ai, 'attention'),
    'owner_required'
  );

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);
  PERFORM public.ai_employee_set_performance_status(v_ai, 'attention');

  SELECT performance_status INTO v_status
  FROM public.ai_employee_profiles
  WHERE employee_id = v_ai;
  IF v_status IS DISTINCT FROM 'attention' THEN
    RAISE EXCEPTION 'owner function did not set status, got %', v_status;
  END IF;

  PERFORM pg_temp.assert_denied(
    format('UPDATE public.ai_employee_profiles SET performance_status = %L WHERE employee_id = %L', 'coaching', v_ai),
    'performance_status_locked'
  );

  PERFORM set_config('ai_employee.status_write', 'forged-token', true);
  PERFORM pg_temp.assert_denied(
    format('UPDATE public.ai_employee_profiles SET performance_status = %L WHERE employee_id = %L', 'disabled', v_ai),
    'performance_status_locked'
  );

  SELECT performance_status INTO v_status
  FROM public.ai_employee_profiles
  WHERE employee_id = v_ai;
  IF v_status IS DISTINCT FROM 'attention' THEN
    RAISE EXCEPTION 'direct update changed performance_status to %', v_status;
  END IF;

  PERFORM public.ai_employee_set_performance_status(v_ai, 'on_track');

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  SELECT v_ai, v_org, action_code
  FROM unnest(ARRAY[
    'content.plans.create',
    'content.plans.update',
    'content.briefs.create',
    'thinking.plan.save',
    'thinking.plan.direct',
    'thinking.execution.check',
    'tasks.update',
    'tasks.steps.create',
    'tasks.steps.update',
    'tasks.substeps.create',
    'tasks.completion.request'
  ]) AS action_code;

  v_day := to_char((timezone('Asia/Jakarta', now()))::date, 'YYYY-MM-DD');
  v_run := public.ai_employee_run_start(v_ai, 'SOP2');
  v_other_run := public.ai_employee_run_start(v_other_ai, 'SOP2');

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_other_ai, v_run, 'content.plans.create',
      format('{"title":"Milik orang lain","post_date":"%s"}', v_day)
    ),
    'run_not_running'
  );

  v_closed := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_run_finish(v_ai, v_closed, 'succeeded', 0, 0, NULL, NULL);
  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_closed, 'content.plans.create',
      format('{"title":"Run selesai","post_date":"%s"}', v_day)
    ),
    'run_not_running'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.schedule', '{}'
    ),
    'action_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'finance.report.read', '{}'
    ),
    'action_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.create',
      format('{"title":"Jangan disetujui","post_date":"%s","approved":true}', v_day)
    ),
    'approval_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.create',
      format('{"title":"Jangan produksi","post_date":"%s","production_approved":true}', v_day)
    ),
    'approval_forbidden'
  );

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'content.plans.create',
      format('{"title":"Pindah org","post_date":"%s","organization_id":"%s"}', v_day, v_org_b)
    ),
    'organization_mismatch'
  );

  v_plan := (public.ai_employee_perform(
    v_ai, v_run, 'content.plans.create',
    jsonb_build_object('title', 'Rencana uji', 'post_date', v_day, 'brief', 'Uji pintu')
  )->>'id')::uuid;

  SELECT production_status, author_employee_id, organization_id
  INTO v_status, v_keep_author, v_keep_org
  FROM public.social_media_plans
  WHERE id = v_plan;

  IF v_status IS DISTINCT FROM 'Need Review'
    OR v_keep_author IS DISTINCT FROM v_ai
    OR v_keep_org IS DISTINCT FROM v_org
  THEN
    RAISE EXCEPTION 'plan door wrote the wrong attribution or status: %', v_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.social_media_plans
    WHERE id = v_plan AND (approved OR production_approved)
  ) THEN
    RAISE EXCEPTION 'plan door set an approval flag';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text,
    true
  );
  PERFORM pg_temp.assert_denied(
    format(
      'UPDATE public.social_media_plans SET brief = %L WHERE id = %L',
      'Brief curian', v_plan
    ),
    'Only the PIC can edit brief content'
  );

  INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
  VALUES (v_plan, 'tiket-asli');
  PERFORM set_config('ai_employee.brief_write', 'tiket-palsu', true);
  PERFORM pg_temp.assert_denied(
    format(
      'UPDATE public.social_media_plans SET brief = %L WHERE id = %L',
      'Brief tiket palsu', v_plan
    ),
    'Only the PIC can edit brief content'
  );
  PERFORM set_config('ai_employee.brief_write', '', true);
  DELETE FROM public.ai_employee_brief_tickets WHERE plan_id = v_plan;

  IF EXISTS (
    SELECT 1 FROM public.social_media_plans
    WHERE id = v_plan AND brief IS DISTINCT FROM 'Uji pintu'
  ) THEN
    RAISE EXCEPTION 'non-PIC or forged ticket changed the brief';
  END IF;

  PERFORM public.ai_employee_perform(
    v_ai, v_run, 'content.briefs.create',
    jsonb_build_object('plan_id', v_plan, 'brief', 'Brief uji')
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.social_media_plans
    WHERE id = v_plan
      AND brief = 'Brief uji'
      AND production_status = 'Need Review'
      AND author_employee_id = v_ai
  ) THEN
    RAISE EXCEPTION 'brief was not saved on the AI employee plan';
  END IF;

  INSERT INTO public.daily_tasks_assigned (
    organization_id, daily_task_id, employee_id, assigned_by
  )
  SELECT v_org, t.id, v_human, v_human
  FROM public.daily_tasks t
  WHERE t.id = (
    SELECT id FROM public.daily_tasks
    WHERE organization_id = v_org AND title = 'Tugas yang org-nya harus tetap'
  );

  INSERT INTO public.daily_tasks (id, organization_id, title, requested_ai_employee_id)
  VALUES (gen_random_uuid(), v_org, 'Tugas Naya', v_ai)
  RETURNING id INTO v_task;

  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_task, v_ai, v_human);

  PERFORM pg_temp.assert_denied(
    format(
      'SELECT public.ai_employee_perform(%L, %L, %L, %L::jsonb)',
      v_ai, v_run, 'tasks.completion.request',
      format('{"task_id":"%s","status":"approved"}', v_task)
    ),
    'approval_forbidden'
  );

  PERFORM public.ai_employee_perform(
    v_ai, v_run, 'tasks.completion.request',
    jsonb_build_object('task_id', v_task, 'entity_type', 'task')
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.completion_approvals
    WHERE daily_task_id = v_task
      AND status = 'pending'
      AND assignee_employee_id = v_ai
  ) THEN
    RAISE EXCEPTION 'completion request did not stay pending';
  END IF;

  PERFORM pg_temp.assert_denied(
    format('SELECT public.ai_employee_context(%L, %L, %L, %L::jsonb)', v_ai, v_run, 'finance', '{}'),
    'scope_forbidden'
  );

  IF NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.ai_employee_context(uuid,uuid,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('ai_employee_runner', 'public.ai_employee_set_performance_status(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.ai_employee_set_performance_status(uuid,text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'runner grants do not match the phase 1 rule';
  END IF;

  IF has_table_privilege('ai_employee_runner', 'public.employees', 'SELECT')
    OR has_table_privilege('ai_employee_runner', 'public.social_media_plans', 'INSERT')
    OR has_table_privilege('ai_employee_runner', 'public.ai_employee_runs', 'SELECT')
  THEN
    RAISE EXCEPTION 'ai_employee_runner has direct table privileges';
  END IF;

  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'ai_employee_runner') THEN
    RAISE EXCEPTION 'ai_employee_runner bypasses RLS';
  END IF;

  EXECUTE 'SET ROLE ai_employee_runner';
  BEGIN
    PERFORM 1 FROM public.employees LIMIT 1;
    RAISE EXCEPTION 'runner select should fail';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  v_context := public.ai_employee_context(v_ai, v_run, 'plans', '{}'::jsonb);
  EXECUTE 'RESET ROLE';

  IF v_context->>'organization_id' IS DISTINCT FROM v_org::text
    OR jsonb_array_length(v_context->'rows') < 1
  THEN
    RAISE EXCEPTION 'runner context did not return the owned plan: %', v_context;
  END IF;

  INSERT INTO public.daily_task_completion_push_queue (
    organization_id, recipient_user_id, event_type, entity_type, daily_task_id, title
  ) VALUES
    (v_org, v_owner, 'completed', 'task', NULL, 'Selesai lama'),
    (v_org, v_owner, 'rejected', 'task', NULL, 'Ditolak lama'),
    (v_org, v_owner, 'run_failed', 'ai_run', NULL, 'Gagal baru'),
    (v_org, v_owner, 'run_late', 'ai_run', NULL, 'Terlambat baru'),
    (v_org, v_owner, 'run_deferred', 'ai_run', NULL, 'Tertunda baru'),
    (v_org, v_owner, 'revision_returned', 'ai_run', NULL, 'Revisi baru');

  BEGIN
    INSERT INTO public.daily_task_completion_push_queue (
      organization_id, recipient_user_id, event_type, entity_type, title
    ) VALUES (v_org, v_owner, 'not-an-event', 'task', 'Tidak sah');
    RAISE EXCEPTION 'unknown event should fail';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  v_closed := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_run_finish(v_ai, v_closed, 'failed', 1, 0, NULL, 'uji gagal');

  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_task_completion_push_queue
    WHERE recipient_user_id = v_owner
      AND event_type = 'run_failed'
      AND entity_type = 'ai_run'
      AND daily_task_id IS NULL
  ) THEN
    RAISE EXCEPTION 'run_failed notification was not queued';
  END IF;

  INSERT INTO public.okr_cycles (id, organization_id, name, year)
  VALUES (gen_random_uuid(), v_org, 'Siklus uji', 2026)
  RETURNING id INTO v_cycle;

  INSERT INTO public.individual_objectives (
    id, organization_id, cycle_id, employee_id, title, created_by
  ) VALUES (
    gen_random_uuid(), v_org, v_cycle, v_ai, 'KPI uji', v_owner
  )
  RETURNING id INTO v_objective;

  INSERT INTO public.key_results (
    title, individual_objective_id, ai_kr_code, weight, metric_type, progress_percentage
  ) VALUES
    ('KR1', v_objective, 'KR1', 1, 'percentage', 0),
    ('KR3', v_objective, 'KR3', 1, 'percentage', 0);

  v_friday := (timezone('Asia/Jakarta', now()))::date
    - ((EXTRACT(ISODOW FROM timezone('Asia/Jakarta', now()))::int - 5 + 7) % 7);
  v_start := (v_friday::timestamp + time '15:00') AT TIME ZONE 'Asia/Jakarta';
  v_on_time := (v_friday::timestamp + time '16:00') AT TIME ZONE 'Asia/Jakarta';
  v_late := (v_friday::timestamp + time '18:00') AT TIME ZONE 'Asia/Jakarta';

  INSERT INTO public.ai_employee_runs (
    employee_id, organization_id, sop_code, status, started_at, finished_at
  ) VALUES
    (v_ai, v_org, 'SOP1', 'succeeded', v_start, v_on_time),
    (v_ai, v_org, 'SOP1', 'late', v_start, v_late);

  PERFORM public.ai_employee_refresh_krs(v_ai);

  SELECT progress_percentage INTO v_progress
  FROM public.key_results
  WHERE individual_objective_id = v_objective AND ai_kr_code = 'KR1';
  IF v_progress IS DISTINCT FROM 50 THEN
    RAISE EXCEPTION 'KR1 expected 50, got %', v_progress;
  END IF;

  SELECT metric_type, progress_percentage INTO v_metric, v_progress
  FROM public.key_results
  WHERE individual_objective_id = v_objective AND ai_kr_code = 'KR3';
  IF v_metric IS DISTINCT FROM 'unrated' OR v_progress IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'KR3 should stay unrated, got % %', v_metric, v_progress;
  END IF;

  SELECT progress_percentage INTO v_progress
  FROM public.individual_objectives
  WHERE id = v_objective;
  IF v_progress IS DISTINCT FROM 50 THEN
    RAISE EXCEPTION 'unrated KR3 should not lower the objective, got %', v_progress;
  END IF;

  RAISE NOTICE 'AI_EMPLOYEE_PHASE1_OK';
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
END;
$test$;

ROLLBACK;
ROLLBACK;
