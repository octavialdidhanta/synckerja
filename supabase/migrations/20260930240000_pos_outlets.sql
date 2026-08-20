-- POS outlets (physical store locations). Extra cabang quota is a later add-on phase.

CREATE TABLE IF NOT EXISTS public.pos_outlets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  province text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_outlets_pkey PRIMARY KEY (id),
  CONSTRAINT pos_outlets_name_check CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_outlets_org_name
  ON public.pos_outlets (organization_id, lower(btrim(name)))
  WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_outlets_org_default
  ON public.pos_outlets (organization_id)
  WHERE is_default = true AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_pos_outlets_org
  ON public.pos_outlets (organization_id, sort_order, name)
  WHERE is_deleted = false;

ALTER TABLE public.pos_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_outlets_org_select" ON public.pos_outlets;
CREATE POLICY "pos_outlets_org_select"
  ON public.pos_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlets_org_insert" ON public.pos_outlets;
CREATE POLICY "pos_outlets_org_insert"
  ON public.pos_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlets_org_update" ON public.pos_outlets;
CREATE POLICY "pos_outlets_org_update"
  ON public.pos_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlets_org_delete" ON public.pos_outlets;
CREATE POLICY "pos_outlets_org_delete"
  ON public.pos_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_outlets_updated_at ON public.pos_outlets;
CREATE TRIGGER update_pos_outlets_updated_at
  BEFORE UPDATE ON public.pos_outlets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.pos_outlets IS
  'Physical POS store locations. Extra outlets beyond HQ are sold as a subscription add-on.';

CREATE OR REPLACE FUNCTION public.seed_default_pos_outlet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.pos_outlets p
    WHERE p.organization_id = NEW.id
      AND p.is_deleted = false
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pos_outlets (
    organization_id,
    name,
    address,
    phone,
    is_active,
    is_default,
    is_deleted,
    sort_order
  )
  VALUES (
    NEW.id,
    'Outlet 1',
    NULLIF(btrim(COALESCE(NEW.address, '')), ''),
    NULLIF(btrim(COALESCE(NEW.phone_number, '')), ''),
    true,
    true,
    false,
    1
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_default_pos_outlet_on_org ON public.organizations;
CREATE TRIGGER seed_default_pos_outlet_on_org
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_pos_outlet();

INSERT INTO public.pos_outlets (
  organization_id,
  name,
  address,
  phone,
  is_active,
  is_default,
  is_deleted,
  sort_order
)
SELECT
  o.id,
  'Outlet 1',
  NULLIF(btrim(COALESCE(o.address, '')), ''),
  NULLIF(btrim(COALESCE(o.phone_number, '')), ''),
  true,
  true,
  false,
  1
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pos_outlets p
  WHERE p.organization_id = o.id
    AND p.is_deleted = false
);

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
  '/operations/settings/outlets-list',
  'Operations — Settings — Outlets',
  true,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[],
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
  p.organization_id,
  d.page_path,
  d.page_title,
  p.is_active,
  p.roles_allowed,
  p.job_levels_allowed,
  p.exceptions,
  p.exception_paths
FROM public.permission_configurations p
CROSS JOIN public.permission_configuration_defaults d
WHERE p.page_path = '/operations/library/product-list'
  AND d.page_path = '/operations/settings/outlets-list'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations existing
    WHERE existing.organization_id = p.organization_id
      AND existing.page_path = d.page_path
  );

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
WHERE d.page_path = '/operations/settings/outlets-list'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
