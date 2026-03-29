-- Align leave_requests + RPC with synckerja-reference (types + useEmployeeLeaveBalance).

-- ---------------------------------------------------------------------------
-- employees.leave_balance (optional; RPC default 12 when null)
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS leave_balance integer NULL;

-- ---------------------------------------------------------------------------
-- leave_requests: columns from reference Row (minimal defaults for existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS work_handover text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- RPC: calculate_employee_leave_balance (reference Args + Returns Json)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_employee_leave_balance(
  employee_id_param uuid,
  as_of_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_allocated numeric;
  v_used numeric;
  v_effective_date date;
BEGIN
  v_effective_date := COALESCE(as_of_date, (timezone('utc', now()))::date);

  SELECT e.organization_id, COALESCE(e.leave_balance::numeric, 12)
  INTO v_org, v_allocated
  FROM public.employees e
  WHERE e.id = employee_id_param;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Employee not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (v_org IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(COALESCE(lr.total_days, 0)), 0)
  INTO v_used
  FROM public.leave_requests lr
  WHERE lr.employee_id = employee_id_param
    AND lr.organization_id = v_org
    AND lr.status = 'approved'
    AND lr.start_date IS NOT NULL
    AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM v_effective_date);

  SELECT COALESCE(e.leave_balance::numeric, 12)
  INTO v_allocated
  FROM public.employees e
  WHERE e.id = employee_id_param;

  RETURN jsonb_build_object(
    'total_allocated', v_allocated,
    'total_used', v_used,
    'remaining_balance', GREATEST(0, v_allocated - v_used),
    'expired_days', 0,
    'calculation_date', to_char(v_effective_date, 'YYYY-MM-DD')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_employee_leave_balance(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_employee_leave_balance(uuid, date) TO authenticated;
