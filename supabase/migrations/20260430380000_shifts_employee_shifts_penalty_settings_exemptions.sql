-- shifts, employee_shifts, penalty_settings, penalty_exemptions
-- Aligned with synckerja-reference/src/mobile/integrations/supabase/types.ts

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_time text NOT NULL,
  end_time text NOT NULL,
  break_duration_minutes integer,
  late_tolerance_minutes integer,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_organization_id ON public.shifts (organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_org_active ON public.shifts (organization_id, is_active);

DROP TRIGGER IF EXISTS shifts_updated_at ON public.shifts;
CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shifts_org_all ON public.shifts;
CREATE POLICY shifts_org_all ON public.shifts FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- employee_shifts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts (id) ON DELETE CASCADE,
  effective_from_date date NOT NULL,
  effective_to_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_organization_id ON public.employee_shifts (organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON public.employee_shifts (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift_id ON public.employee_shifts (shift_id);

DROP TRIGGER IF EXISTS employee_shifts_updated_at ON public.employee_shifts;
CREATE TRIGGER employee_shifts_updated_at
  BEFORE UPDATE ON public.employee_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_shifts_org_all ON public.employee_shifts;
CREATE POLICY employee_shifts_org_all ON public.employee_shifts FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- penalty_settings (one row per organization)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.penalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  default_calculation_type text,
  default_hourly_rate numeric,
  default_salary_percentage numeric,
  enable_automatic_penalties boolean NOT NULL DEFAULT false,
  enable_salary_based_calculation boolean,
  grace_settings jsonb,
  holiday_penalty_rules jsonb,
  maximum_daily_penalty numeric,
  maximum_monthly_penalty numeric,
  minimum_penalty_amount numeric,
  notification_settings jsonb,
  penalty_calculation_timezone text,
  penalty_deduction_date integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT penalty_settings_organization_id_key UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_penalty_settings_organization_id ON public.penalty_settings (organization_id);

DROP TRIGGER IF EXISTS penalty_settings_updated_at ON public.penalty_settings;
CREATE TRIGGER penalty_settings_updated_at
  BEFORE UPDATE ON public.penalty_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.penalty_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS penalty_settings_org_all ON public.penalty_settings;
CREATE POLICY penalty_settings_org_all ON public.penalty_settings FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- penalty_exemptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.penalty_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  penalty_rule_id uuid REFERENCES public.penalty_rules (id) ON DELETE SET NULL,
  exemption_type text NOT NULL,
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  conditions jsonb,
  is_active boolean NOT NULL DEFAULT true,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalty_exemptions_organization_id ON public.penalty_exemptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_penalty_exemptions_employee_id ON public.penalty_exemptions (employee_id);
CREATE INDEX IF NOT EXISTS idx_penalty_exemptions_penalty_rule_id ON public.penalty_exemptions (penalty_rule_id);

DROP TRIGGER IF EXISTS penalty_exemptions_updated_at ON public.penalty_exemptions;
CREATE TRIGGER penalty_exemptions_updated_at
  BEFORE UPDATE ON public.penalty_exemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.penalty_exemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS penalty_exemptions_org_all ON public.penalty_exemptions;
CREATE POLICY penalty_exemptions_org_all ON public.penalty_exemptions FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
