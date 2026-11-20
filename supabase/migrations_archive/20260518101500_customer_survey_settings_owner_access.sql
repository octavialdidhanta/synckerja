-- Allow organization owners (user_roles.role = owner) to manage customer survey settings,
-- same elevation as other omnichannel owner/admin surfaces.

CREATE OR REPLACE FUNCTION public.is_omnichannel_survey_settings_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_organization_id
      AND ur.role = 'owner'::text
  )
  OR EXISTS (
    SELECT 1
    FROM public.organization_omnichannel_staff s
    INNER JOIN public.employees e ON e.id = s.employee_id AND e.user_id = auth.uid()
    WHERE s.organization_id = p_organization_id
      AND s.role = 'admin'::text
  );
$$;

COMMENT ON FUNCTION public.is_omnichannel_survey_settings_admin(uuid) IS
  'True if auth.uid() may edit organization_customer_survey_settings: org owner (user_roles) or omnichannel roster admin.';
