-- Nama katalog yang menjadi tanggung jawab tiap karyawan AI di satu organisasi.
-- Brief tidak bisa dibaca klien langsung. Halaman kantor memakai fungsi ini.

CREATE OR REPLACE FUNCTION public.ai_employee_office_catalogs(
  p_organization_id uuid
)
RETURNS TABLE (
  employee_id uuid,
  catalog_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_organization_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = p_organization_id
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    employee.id,
    (
      SELECT service.name
      FROM unnest(brief.service_ids) WITH ORDINALITY AS picked(service_id, ordinal)
      JOIN public.services service
        ON service.id = picked.service_id
       AND service.organization_id = employee.organization_id
      ORDER BY picked.ordinal
      LIMIT 1
    )
  FROM public.employees employee
  LEFT JOIN public.ai_employee_briefs brief
    ON brief.employee_id = employee.id
   AND brief.organization_id = employee.organization_id
  WHERE employee.organization_id = p_organization_id
    AND COALESCE(employee.is_ai, false);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_office_catalogs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_office_catalogs(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.ai_employee_office_catalogs(uuid) IS
  'Satu nama katalog per karyawan AI untuk papan nama di halaman kantor. Owner dan admin organisasi itu.';
