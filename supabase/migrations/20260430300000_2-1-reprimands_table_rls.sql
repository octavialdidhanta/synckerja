-- Reprimands (2-1-reprimand): canonical table + org-scoped RLS for owner/admin/hr.
-- Trigger uses public.update_updated_at_column() (see 20260328120000_0-auth_profiles_email_verification.sql).

CREATE TABLE IF NOT EXISTS public.reprimands (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  reprimand_type text NOT NULL,
  severity_level text NOT NULL DEFAULT 'medium'::text,
  violation_category text NOT NULL,
  incident_date date NOT NULL,
  incident_time time without time zone NULL,
  incident_location text NULL,
  violation_description text NOT NULL,
  evidence_details text NULL,
  witness_names text NULL,
  previous_warnings_count integer NULL DEFAULT 0,
  corrective_action_plan text NULL,
  improvement_deadline date NULL,
  follow_up_date date NULL,
  status text NOT NULL DEFAULT 'active'::text,
  appeal_notes text NULL,
  appeal_date date NULL,
  appeal_status text NULL,
  issued_by uuid NOT NULL,
  reviewed_by uuid NULL,
  hr_approved_by uuid NULL,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  reviewed_date date NULL,
  hr_approved_date date NULL,
  acknowledgment_required boolean NULL DEFAULT true,
  employee_acknowledged boolean NULL DEFAULT false,
  acknowledgment_date date NULL,
  acknowledgment_signature text NULL,
  document_path text NULL,
  is_formal boolean NULL DEFAULT true,
  impact_on_performance_review boolean NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  notes text NULL,
  CONSTRAINT reprimands_pkey PRIMARY KEY (id),
  CONSTRAINT reprimands_appeal_status_check CHECK (
    appeal_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])
  ),
  CONSTRAINT reprimands_reprimand_type_check CHECK (
    reprimand_type = ANY (
      ARRAY[
        'verbal_warning'::text,
        'written_warning'::text,
        'final_warning'::text,
        'suspension'::text,
        'termination'::text
      ]
    )
  ),
  CONSTRAINT reprimands_severity_level_check CHECK (
    severity_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])
  ),
  CONSTRAINT reprimands_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'resolved'::text, 'appealed'::text, 'cancelled'::text])
  ),
  CONSTRAINT reprimands_violation_category_check CHECK (
    violation_category = ANY (
      ARRAY[
        'attendance'::text,
        'performance'::text,
        'conduct'::text,
        'safety'::text,
        'policy_violation'::text,
        'insubordination'::text,
        'other'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_reprimands_employee_id ON public.reprimands USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_reprimands_organization_id ON public.reprimands USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_reprimands_incident_date ON public.reprimands USING btree (incident_date);

CREATE INDEX IF NOT EXISTS idx_reprimands_status ON public.reprimands USING btree (status);

CREATE INDEX IF NOT EXISTS idx_reprimands_reprimand_type ON public.reprimands USING btree (reprimand_type);

DROP TRIGGER IF EXISTS update_reprimands_updated_at ON public.reprimands;

CREATE TRIGGER update_reprimands_updated_at
  BEFORE UPDATE ON public.reprimands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column ();

ALTER TABLE public.reprimands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reprimands_hr_management_all ON public.reprimands;

CREATE POLICY reprimands_hr_management_all ON public.reprimands FOR ALL TO authenticated USING (
  organization_id IN (SELECT public.user_organization_ids ())
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid ())
      AND ur.organization_id = reprimands.organization_id
      AND ur.role IN ('owner', 'admin', 'hr')
  )
)
WITH CHECK (
  organization_id IN (SELECT public.user_organization_ids ())
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid ())
      AND ur.organization_id = reprimands.organization_id
      AND ur.role IN ('owner', 'admin', 'hr')
  )
);
