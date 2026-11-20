-- Penalty system: penalty_rules, payroll_periods (FK target), attendance_penalties + triggers + RLS.
-- Aligns with synckerja-reference / mobile types and app hooks (useAttendancePenalties, usePenaltyRules).

-- ---------------------------------------------------------------------------
-- payroll_periods (required FK from attendance_penalties.payroll_periods_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period_name text NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  pay_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  cut_off date,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  notes text,
  is_bonus_period boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_organization_id ON public.payroll_periods (organization_id);

-- ---------------------------------------------------------------------------
-- penalty_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.penalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  rule_type text NOT NULL CHECK (
    rule_type = ANY (
      ARRAY[
        'late_arrival'::text,
        'early_departure'::text,
        'no_checkout'::text,
        'invalid_location'::text
      ]
    )
  ),
  threshold_minutes integer NOT NULL DEFAULT 0,
  penalty_amount numeric(15, 2),
  penalty_type text NOT NULL DEFAULT 'deduction' CHECK (
    penalty_type = ANY (ARRAY['deduction'::text, 'warning'::text, 'points'::text])
  ),
  calculation_type text NOT NULL DEFAULT 'fixed' CHECK (
    calculation_type = ANY (ARRAY['fixed'::text, 'hourly'::text, 'salary_percentage'::text])
  ),
  hourly_rate numeric(15, 2),
  salary_percentage numeric(15, 2),
  max_penalty_per_month numeric(15, 2),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  applies_to_all boolean NOT NULL DEFAULT true,
  specific_departments uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS penalty_rules_organization_id_idx ON public.penalty_rules (organization_id);

-- ---------------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_penalty_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_attendance_penalty_payroll_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payroll_periods_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT pp.id
  INTO NEW.payroll_periods_id
  FROM public.payroll_periods pp
  WHERE pp.organization_id = NEW.organization_id
    AND NEW.applied_date >= pp.start_date
    AND NEW.applied_date <= pp.end_date
  ORDER BY pp.start_date DESC
  LIMIT 1;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- attendance_penalties (reference schema)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_penalties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attendance_record_id uuid NULL,
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  penalty_rule_id uuid NOT NULL,
  penalty_amount numeric(15, 2) NOT NULL,
  penalty_reason text NOT NULL,
  applied_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active'::text,
  waived_by uuid NULL,
  waived_at timestamptz NULL,
  waiver_reason text NULL,
  appeal_notes text NULL,
  payment_date date NULL,
  notes text NULL,
  violation_details jsonb NULL,
  auto_generated boolean NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payroll_periods_id uuid NULL,
  CONSTRAINT attendance_penalties_pkey PRIMARY KEY (id),
  CONSTRAINT unique_attendance_penalty UNIQUE (attendance_record_id, penalty_rule_id, applied_date),
  CONSTRAINT attendance_penalties_payroll_periods_id_fkey FOREIGN KEY (payroll_periods_id) REFERENCES payroll_periods (id),
  CONSTRAINT fk_attendance_penalties_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_penalties_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_penalties_attendance_record FOREIGN KEY (attendance_record_id) REFERENCES attendance_records (id) ON DELETE SET NULL,
  CONSTRAINT attendance_penalties_penalty_rule_id_fkey FOREIGN KEY (penalty_rule_id) REFERENCES penalty_rules (id) ON DELETE CASCADE,
  CONSTRAINT attendance_penalties_status_check CHECK (
    (
      status = ANY (
        ARRAY[
          'active'::text,
          'waived'::text,
          'appealed'::text,
          'paid'::text,
          'cancelled'::text
        ]
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_attendance_penalties_employee_date ON public.attendance_penalties USING btree (employee_id, applied_date);
CREATE INDEX IF NOT EXISTS idx_attendance_penalties_org_status ON public.attendance_penalties USING btree (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_penalties_attendance_record_id ON public.attendance_penalties USING btree (attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_attendance_penalties_lookup ON public.attendance_penalties USING btree (attendance_record_id, applied_date);
CREATE INDEX IF NOT EXISTS attendance_penalties_penalty_rule_id_idx ON public.attendance_penalties USING btree (penalty_rule_id);
CREATE INDEX IF NOT EXISTS idx_attendance_penalties_payroll_period ON public.attendance_penalties USING btree (payroll_periods_id);

DROP TRIGGER IF EXISTS set_payroll_period_on_attendance_penalty_insert ON public.attendance_penalties;
CREATE TRIGGER set_payroll_period_on_attendance_penalty_insert
  BEFORE INSERT ON public.attendance_penalties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_attendance_penalty_payroll_period();

DROP TRIGGER IF EXISTS update_attendance_penalties_updated_at ON public.attendance_penalties;
CREATE TRIGGER update_attendance_penalties_updated_at
  BEFORE UPDATE ON public.attendance_penalties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_penalty_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (same pattern as home reference migrations)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_penalties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_periods_org_all ON public.payroll_periods;
CREATE POLICY payroll_periods_org_all ON public.payroll_periods FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS penalty_rules_org_all ON public.penalty_rules;
CREATE POLICY penalty_rules_org_all ON public.penalty_rules FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS attendance_penalties_org_all ON public.attendance_penalties;
CREATE POLICY attendance_penalties_org_all ON public.attendance_penalties FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
