

CREATE TABLE IF NOT EXISTS public.allowed_ip_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cidr text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_validations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_record_id uuid NOT NULL REFERENCES public.attendance_records (id) ON DELETE CASCADE,
  validation_type text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RPC: department objectives bundle (from reference)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_department_objectives_organization_id
  ON public.department_objectives (organization_id);

CREATE INDEX IF NOT EXISTS idx_department_objectives_organization_cycle_created
  ON public.department_objectives (organization_id, cycle_id, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_key_results_department_objective_id
  ON public.key_results (department_objective_id)
  WHERE company_objective_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_department_objectives_with_key_results(
  p_organization_id uuid,
  p_cycle_ids uuid[] DEFAULT NULL,
  p_include_individual boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;