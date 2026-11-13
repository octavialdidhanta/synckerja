-- ai_employee_briefs is closed to service_role (20261103108000). Edge functions read it
-- directly, so required notes, the company logo and sub categories never reached Canva.
-- This keeps the table closed and gives the server only the fields it needs.
CREATE OR REPLACE FUNCTION public.ai_employee_canva_brief(p_employee_id uuid, p_organization_id uuid)
RETURNS TABLE (
  required_notes text,
  forbidden_notes text,
  company_logo_id uuid,
  service_ids uuid[],
  sub_service_ids uuid[],
  sub_service_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT brief.required_notes,
         brief.forbidden_notes,
         brief.company_logo_id,
         brief.service_ids,
         brief.sub_service_ids,
         brief.sub_service_id
  FROM public.ai_employee_briefs brief
  JOIN public.employees employee
    ON employee.id = brief.employee_id
   AND employee.organization_id = brief.organization_id
   AND COALESCE(employee.is_ai, false)
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = p_organization_id
$fn$;

REVOKE ALL ON FUNCTION public.ai_employee_canva_brief(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_canva_brief(uuid, uuid) TO service_role;
