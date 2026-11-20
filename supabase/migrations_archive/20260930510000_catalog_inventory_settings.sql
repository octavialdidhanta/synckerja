-- Inventory settings: PO/Transfer workflow mode (simple|advanced) + feature role matrix.

CREATE TABLE IF NOT EXISTS public.catalog_inventory_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  po_mode text NOT NULL DEFAULT 'simple',
  transfer_mode text NOT NULL DEFAULT 'simple',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_inventory_settings_pkey PRIMARY KEY (organization_id),
  CONSTRAINT catalog_inventory_settings_po_mode_check CHECK (po_mode IN ('simple', 'advanced')),
  CONSTRAINT catalog_inventory_settings_transfer_mode_check CHECK (transfer_mode IN ('simple', 'advanced'))
);

CREATE TABLE IF NOT EXISTS public.catalog_inventory_feature_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  allowed_roles text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_inventory_feature_access_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_inventory_feature_access_org_feature_unique UNIQUE (organization_id, feature_key),
  CONSTRAINT catalog_inventory_feature_access_key_check CHECK (
    feature_key IN (
      'po_request',
      'po_approval',
      'po_fulfillment',
      'transfer_request',
      'transfer_approval',
      'transfer_shipment',
      'transfer_fulfillment'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_inventory_feature_access_org
  ON public.catalog_inventory_feature_access (organization_id);

ALTER TABLE public.catalog_inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_inventory_feature_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_inventory_settings_select" ON public.catalog_inventory_settings;
CREATE POLICY "catalog_inventory_settings_select"
  ON public.catalog_inventory_settings FOR SELECT TO authenticated
  USING (public.user_is_org_owner_or_admin(organization_id));

DROP POLICY IF EXISTS "catalog_inventory_feature_access_select" ON public.catalog_inventory_feature_access;
CREATE POLICY "catalog_inventory_feature_access_select"
  ON public.catalog_inventory_feature_access FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_inventory_settings_updated_at ON public.catalog_inventory_settings;
CREATE TRIGGER update_catalog_inventory_settings_updated_at
  BEFORE UPDATE ON public.catalog_inventory_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_catalog_inventory_feature_access_updated_at ON public.catalog_inventory_feature_access;
CREATE TRIGGER update_catalog_inventory_feature_access_updated_at
  BEFORE UPDATE ON public.catalog_inventory_feature_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role_in_org(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role::text
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.organization_id = p_organization_id
  ORDER BY CASE ur.role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'hr' THEN 3
    ELSE 4
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_role_in_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role_in_org(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_inventory_feature_access(
  p_organization_id uuid,
  p_feature_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_allowed text[];
BEGIN
  IF p_organization_id IS NULL OR p_feature_key IS NULL THEN
    RETURN false;
  END IF;

  v_role := public.get_user_role_in_org(p_organization_id);
  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT fa.allowed_roles
    INTO v_allowed
  FROM public.catalog_inventory_feature_access fa
  WHERE fa.organization_id = p_organization_id
    AND fa.feature_key = p_feature_key;

  IF v_allowed IS NULL OR COALESCE(array_length(v_allowed, 1), 0) = 0 THEN
    RETURN false;
  END IF;

  RETURN v_role = ANY (v_allowed);
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_inventory_feature_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_inventory_feature_access(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_catalog_inventory_settings(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.catalog_inventory_settings;
  v_access jsonb;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_settings
  FROM public.catalog_inventory_settings s
  WHERE s.organization_id = p_organization_id;

  IF NOT FOUND THEN
    INSERT INTO public.catalog_inventory_settings (organization_id)
    VALUES (p_organization_id)
    RETURNING * INTO v_settings;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'feature_key', fa.feature_key,
        'allowed_roles', fa.allowed_roles
      )
      ORDER BY fa.feature_key
    ),
    '[]'::jsonb
  )
    INTO v_access
  FROM public.catalog_inventory_feature_access fa
  WHERE fa.organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'organization_id', v_settings.organization_id,
    'po_mode', v_settings.po_mode,
    'transfer_mode', v_settings.transfer_mode,
    'feature_access', v_access
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_catalog_inventory_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_catalog_inventory_settings(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_catalog_inventory_settings(
  p_organization_id uuid,
  p_po_mode text,
  p_transfer_mode text,
  p_feature_access jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_key text;
  v_roles text[];
  v_po_keys text[] := ARRAY['po_request', 'po_approval', 'po_fulfillment'];
  v_transfer_keys text[] := ARRAY[
    'transfer_request', 'transfer_approval', 'transfer_shipment', 'transfer_fulfillment'
  ];
  v_required text[];
  v_present text[] := '{}'::text[];
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_po_mode NOT IN ('simple', 'advanced') OR p_transfer_mode NOT IN ('simple', 'advanced') THEN
    RAISE EXCEPTION 'catalog_inventory_mode_invalid';
  END IF;

  v_required := ARRAY[]::text[];
  IF p_po_mode = 'advanced' THEN
    v_required := v_required || v_po_keys;
  END IF;
  IF p_transfer_mode = 'advanced' THEN
    v_required := v_required || v_transfer_keys;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_feature_access, '[]'::jsonb))
  LOOP
    v_key := NULLIF(btrim(v_item ->> 'feature_key'), '');
    IF v_key IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(DISTINCT r ORDER BY r), '{}'::text[])
      INTO v_roles
    FROM unnest(
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(v_item -> 'allowed_roles')),
        '{}'::text[]
      )
    ) AS r
    WHERE r IN ('owner', 'admin', 'hr', 'employee');

    IF v_key = ANY (v_required) AND COALESCE(array_length(v_roles, 1), 0) = 0 THEN
      RAISE EXCEPTION 'catalog_inventory_access_roles_required';
    END IF;

    v_present := array_append(v_present, v_key);

    INSERT INTO public.catalog_inventory_feature_access (
      organization_id,
      feature_key,
      allowed_roles
    ) VALUES (
      p_organization_id,
      v_key,
      v_roles
    )
    ON CONFLICT (organization_id, feature_key) DO UPDATE SET
      allowed_roles = EXCLUDED.allowed_roles,
      updated_at = now();
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM unnest(v_required) AS req(key)
    WHERE NOT (req.key = ANY (v_present))
  ) THEN
    RAISE EXCEPTION 'catalog_inventory_access_roles_required';
  END IF;

  INSERT INTO public.catalog_inventory_settings (
    organization_id,
    po_mode,
    transfer_mode
  ) VALUES (
    p_organization_id,
    p_po_mode,
    p_transfer_mode
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    po_mode = EXCLUDED.po_mode,
    transfer_mode = EXCLUDED.transfer_mode,
    updated_at = now();

  RETURN public.get_or_create_catalog_inventory_settings(p_organization_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_catalog_inventory_settings(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_inventory_settings(uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_catalog_inventory_org_roles(
  p_organization_id uuid
)
RETURNS TABLE(role text, employee_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ur.role::text,
    COUNT(DISTINCT e.id)::bigint
  FROM public.user_roles ur
  LEFT JOIN public.employees e
    ON e.user_id = ur.user_id
   AND e.organization_id = ur.organization_id
  WHERE ur.organization_id = p_organization_id
    AND ur.role IN ('owner', 'admin', 'hr', 'employee')
  GROUP BY ur.role
  ORDER BY CASE ur.role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'hr' THEN 3
    ELSE 4
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.list_catalog_inventory_org_roles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_catalog_inventory_org_roles(uuid) TO authenticated;

-- Lightweight read for operational modules (any org member)
CREATE OR REPLACE FUNCTION public.get_catalog_inventory_workflow_modes(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_mode text := 'simple';
  v_transfer_mode text := 'simple';
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT s.po_mode, s.transfer_mode
    INTO v_po_mode, v_transfer_mode
  FROM public.catalog_inventory_settings s
  WHERE s.organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'po_mode', COALESCE(v_po_mode, 'simple'),
    'transfer_mode', COALESCE(v_transfer_mode, 'simple')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_catalog_inventory_workflow_modes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_catalog_inventory_workflow_modes(uuid) TO authenticated;

-- Page permission: owner + admin only
INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES (
  '/operations/settings/inventory',
  'Operations — Settings — Inventory',
  true,
  ARRAY['owner', 'admin']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/operations/settings/inventory'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
