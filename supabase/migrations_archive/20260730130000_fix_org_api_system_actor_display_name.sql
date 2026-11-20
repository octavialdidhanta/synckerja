-- Fix: PL/pgSQL SELECT INTO clears variables when no row; display_name must stay defaulted.

CREATE OR REPLACE FUNCTION public.get_or_create_org_api_system_actor(p_organization_id uuid)
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_name text := 'Synckerja API';
BEGIN
  SELECT a.user_id, COALESCE(NULLIF(btrim(a.display_name), ''), 'Synckerja API')
    INTO v_user_id, v_name
  FROM public.organization_api_system_actors a
  WHERE a.organization_id = p_organization_id;

  IF v_user_id IS NOT NULL THEN
    RETURN QUERY SELECT v_user_id, v_name;
    RETURN;
  END IF;

  v_name := 'Synckerja API';

  SELECT ur.user_id INTO v_user_id
  FROM public.user_roles ur
  WHERE ur.organization_id = p_organization_id
    AND ur.role IN ('owner', 'admin')
  ORDER BY CASE ur.role WHEN 'owner' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No owner/admin found for organization %', p_organization_id;
  END IF;

  INSERT INTO public.organization_api_system_actors (organization_id, user_id, display_name)
  VALUES (p_organization_id, v_user_id, v_name)
  ON CONFLICT (organization_id) DO UPDATE
    SET updated_at = now(),
        display_name = COALESCE(NULLIF(organization_api_system_actors.display_name, ''), EXCLUDED.display_name)
  RETURNING organization_api_system_actors.user_id, organization_api_system_actors.display_name
  INTO v_user_id, v_name;

  RETURN QUERY SELECT v_user_id, v_name;
END;
$$;
