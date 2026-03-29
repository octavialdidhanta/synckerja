

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
BEGIN
  WITH depts AS (
    SELECT
      dbo.id,
      dbo.organization_id,
      dbo.cycle_id,
      dbo.company_objective_id,
      dbo.department_id,
      dbo.title,
      dbo.description,
      dbo.status,
      dbo.progress_percentage,
      dbo.weight,
      dbo.start_date,
      dbo.end_date,
      dbo.owner_id,
      dbo.created_by,
      dbo.created_at,
      dbo.updated_at,
      d.name AS dept_name,
      co.title AS co_title,
      oc.name AS oc_name,
      oc.year AS oc_year,
      oc.quarter AS oc_quarter
    FROM department_objectives dbo
    INNER JOIN departments d ON d.id = dbo.department_id
    INNER JOIN company_objectives co ON co.id = dbo.company_objective_id
    INNER JOIN okr_cycles oc ON oc.id = dbo.cycle_id
    WHERE dbo.organization_id = p_organization_id
      AND (
        p_cycle_ids IS NULL
        OR cardinality(p_cycle_ids) = 0
        OR dbo.cycle_id = ANY (p_cycle_ids)
      )
    ORDER BY dbo.created_at DESC
  ),
  krs AS (
    SELECT
      kr.department_objective_id,
      jsonb_agg(
        jsonb_build_object(
          'id', kr.id,
          'title', kr.title,
          'target_value', kr.target_value,
          'current_value', kr.current_value,
          'unit', kr.unit,
          'metric_type', kr.metric_type,
          'progress_percentage', kr.progress_percentage,
          'weight', kr.weight,
          'department_objective_id', kr.department_objective_id,
          'company_objective_id', kr.company_objective_id
        )
      ) FILTER (WHERE kr.id IS NOT NULL) AS key_results_json
    FROM key_results kr
    INNER JOIN depts dbo ON dbo.id = kr.department_objective_id
    WHERE kr.company_objective_id IS NULL
      AND trim(lower(COALESCE(kr.title, ''))) IS DISTINCT FROM trim(lower(COALESCE(dbo.title, '')))
    GROUP BY kr.department_objective_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'organization_id', d.organization_id,
      'cycle_id', d.cycle_id,
      'company_objective_id', d.company_objective_id,
      'department_id', d.department_id,
      'title', d.title,
      'description', d.description,
      'status', d.status,
      'progress_percentage', d.progress_percentage,
      'weight', d.weight,
      'start_date', d.start_date,
      'end_date', d.end_date,
      'owner_id', d.owner_id,
      'created_by', d.created_by,
      'created_at', d.created_at,
      'updated_at', d.updated_at,
      'departments', jsonb_build_object('name', d.dept_name),
      'company_objectives', jsonb_build_object('title', d.co_title),
      'okr_cycles', jsonb_build_object('name', d.oc_name, 'year', d.oc_year, 'quarter', d.oc_quarter),
      'key_results', (
        SELECT COALESCE(k.key_results_json, '[]'::jsonb)
        FROM krs k
        WHERE k.department_objective_id = d.id
      )
    )
  )
  INTO result
  FROM depts d;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_department_objectives_with_key_results(uuid, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_department_objectives_with_key_results(uuid, uuid[], boolean) TO authenticated;