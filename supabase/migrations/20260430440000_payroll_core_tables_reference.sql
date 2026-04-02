-- Payroll tables required by src/2-4-payroll + MyInfo payroll hooks.
-- Depends on: organizations, employees, payroll_periods (20260430360000), update_updated_at_column (20260328120000).
-- RLS: user_organization_ids() pattern (same as payroll_periods).

-- ---------------------------------------------------------------------------
-- tax_configurations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text,
  description text,
  effective_date date,
  income_tax_rate numeric,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  ptkp_amount numeric NOT NULL DEFAULT 54000000,
  ptkp_status text NOT NULL DEFAULT 'TK/0',
  tax_bracket_1_limit numeric,
  tax_bracket_1_rate numeric,
  tax_bracket_2_limit numeric,
  tax_bracket_2_rate numeric,
  tax_bracket_3_limit numeric,
  tax_bracket_3_rate numeric,
  tax_bracket_4_rate numeric,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_type text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_configurations_organization_id ON public.tax_configurations (organization_id);

-- ---------------------------------------------------------------------------
-- employee_payroll_info (MyInfo: select * + upsert)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payroll_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  basic_salary numeric,
  beginning_netto numeric DEFAULT 0,
  bpjs_kesehatan_configuration text,
  bpjs_kesehatan_date date,
  bpjs_kesehatan_family_members integer DEFAULT 0,
  bpjs_kesehatan_number text,
  bpjs_ketenagakerjaan_date date,
  bpjs_ketenagakerjaan_number text,
  bank_account_holder text,
  bank_account_number text,
  bank_name text,
  count_national_holiday_as_working_day boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  currency text DEFAULT 'IDR',
  employee_tax_status text,
  jht_configuration text,
  npwp text,
  overtime_eligible boolean DEFAULT false,
  pph21_paid numeric DEFAULT 0,
  prorate_based_on text,
  ptkp_status text,
  salary_configuration text,
  salary_type text,
  tax_configuration_id uuid REFERENCES public.tax_configurations (id) ON DELETE SET NULL,
  tax_method text,
  taxable_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT employee_payroll_info_employee_id_unique UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_info_organization_id ON public.employee_payroll_info (organization_id);

-- ---------------------------------------------------------------------------
-- employee_payroll_components (MyInfo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payroll_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_payroll_info_id uuid NOT NULL REFERENCES public.employee_payroll_info (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  component_name text NOT NULL,
  component_type text NOT NULL,
  component_category text NOT NULL,
  amount numeric,
  is_active boolean DEFAULT true,
  is_percentage boolean DEFAULT false,
  is_recurring boolean DEFAULT true,
  is_taxable boolean DEFAULT false,
  payroll_period_id uuid REFERENCES public.payroll_periods (id) ON DELETE SET NULL,
  percentage_base text,
  tax_configuration_id uuid REFERENCES public.tax_configurations (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_components_info ON public.employee_payroll_components (employee_payroll_info_id);

-- ---------------------------------------------------------------------------
-- payroll_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  payroll_period_id uuid NOT NULL REFERENCES public.payroll_periods (id) ON DELETE CASCADE,
  tax_configuration_id uuid NOT NULL REFERENCES public.tax_configurations (id) ON DELETE RESTRICT,
  run_name text NOT NULL,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  calculation_method text,
  notes text,
  approved_at timestamptz,
  approved_by uuid,
  calculated_at timestamptz,
  calculated_by uuid,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  total_deductions numeric,
  total_employees integer,
  total_gross_pay numeric,
  total_net_pay numeric,
  total_penalties numeric,
  total_taxes numeric
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_organization_id ON public.payroll_runs (organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON public.payroll_runs (payroll_period_id);

-- ---------------------------------------------------------------------------
-- employee_payroll_calculations — kolom yang dipakai UI + FK untuk join/delete
-- (tanpa kolom analitik panjang; bisa ditambah migrasi terpisah jika RPC backend membutuhkan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payroll_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  employee_payroll_info_id uuid NOT NULL REFERENCES public.employee_payroll_info (id) ON DELETE CASCADE,
  payroll_period_id uuid NOT NULL REFERENCES public.payroll_periods (id),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs (id) ON DELETE CASCADE,
  tax_configuration_id uuid NOT NULL REFERENCES public.tax_configurations (id),
  basic_salary numeric,
  total_allowances numeric DEFAULT 0,
  total_deductions numeric DEFAULT 0,
  total_penalties numeric DEFAULT 0,
  total_tax_deductions numeric,
  gross_pay numeric,
  net_pay numeric,
  take_home_pay numeric,
  total_taxes text,
  calculation_status text DEFAULT 'calculated',
  calculation_date timestamptz DEFAULT now(),
  payment_status text DEFAULT 'pending',
  payment_date timestamptz,
  payment_method text DEFAULT 'bank_transfer',
  payment_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT unique_employee_payroll_info_run UNIQUE (employee_payroll_info_id, payroll_run_id),
  CONSTRAINT employee_payroll_calculations_payment_status_check CHECK (
    payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text])
  ),
  CONSTRAINT employee_payroll_calculations_calculation_status_check CHECK (
    calculation_status = ANY (
      ARRAY[
        'draft'::text,
        'calculated'::text,
        'approved'::text,
        'paid'::text,
        'cancelled'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_calculations_org ON public.employee_payroll_calculations (organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_calculations_run_id ON public.employee_payroll_calculations (payroll_run_id);

DROP TRIGGER IF EXISTS update_employee_payroll_calculations_updated_at ON public.employee_payroll_calculations;
CREATE TRIGGER update_employee_payroll_calculations_updated_at
  BEFORE UPDATE ON public.employee_payroll_calculations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column ();

-- ---------------------------------------------------------------------------
-- payroll_items — hanya yang dipakai UI (detail baris + hapus sebelum hapus kalkulasi)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  payroll_calculation_id uuid NOT NULL REFERENCES public.employee_payroll_calculations (id) ON DELETE CASCADE,
  component_id uuid REFERENCES public.employee_payroll_components (id) ON DELETE SET NULL,
  item_name text NOT NULL,
  item_type text NOT NULL,
  item_category text,
  item_description text,
  calculated_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_calculation ON public.payroll_items (payroll_calculation_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.tax_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_configurations_org_all ON public.tax_configurations;
CREATE POLICY tax_configurations_org_all ON public.tax_configurations FOR ALL TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS employee_payroll_info_org_all ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_org_all ON public.employee_payroll_info FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS employee_payroll_components_org_all ON public.employee_payroll_components;
CREATE POLICY employee_payroll_components_org_all ON public.employee_payroll_components FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS payroll_runs_org_all ON public.payroll_runs;
CREATE POLICY payroll_runs_org_all ON public.payroll_runs FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS employee_payroll_calculations_org_all ON public.employee_payroll_calculations;
CREATE POLICY employee_payroll_calculations_org_all ON public.employee_payroll_calculations FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS payroll_items_org_all ON public.payroll_items;
CREATE POLICY payroll_items_org_all ON public.payroll_items FOR ALL TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
    OR EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      WHERE c.id = payroll_items.payroll_calculation_id
        AND c.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
    OR EXISTS (
      SELECT 1
      FROM public.employee_payroll_calculations c
      WHERE c.id = payroll_items.payroll_calculation_id
        AND c.organization_id IN (SELECT public.user_organization_ids())
    )
  );
