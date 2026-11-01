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
  );

CREATE POLICY ai_employee_model_calls_select ON public.ai_employee_model_calls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_id
        AND e.organization_id IN (SELECT public.user_organization_ids())
    )
  );

REVOKE ALL ON TABLE public.ai_employee_runs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_feedback FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_model_calls FROM PUBLIC, anon;

GRANT SELECT ON public.ai_employee_runs TO authenticated;
GRANT SELECT, INSERT ON public.ai_employee_feedback TO authenticated;
GRANT SELECT ON public.ai_employee_model_calls TO authenticated;
