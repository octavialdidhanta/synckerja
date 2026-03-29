-- Align master tables with synckerja-reference / Employment CRUD hooks (is_active, nullable org, etc.)
-- Create job_openings, recruitment_links, increment RPCs, and RLS for recruitment flows.

-- ---------------------------------------------------------------------------
-- job_positions: reference expects nullable organization_id, department_id, is_active
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_positions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS department_id uuid NULL REFERENCES public.departments (id) ON DELETE SET NULL;

ALTER TABLE public.job_positions
  ALTER COLUMN organization_id DROP NOT NULL;

DROP POLICY IF EXISTS "job_positions_org_insert" ON public.job_positions;
CREATE POLICY "job_positions_org_insert"
  ON public.job_positions FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_positions_org_update" ON public.job_positions;
CREATE POLICY "job_positions_org_update"
  ON public.job_positions FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_positions_org_delete" ON public.job_positions;
CREATE POLICY "job_positions_org_delete"
  ON public.job_positions FOR DELETE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- job_levels: is_active, level_order, nullable organization_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_levels
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS level_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.job_levels
  ALTER COLUMN organization_id DROP NOT NULL;

DROP POLICY IF EXISTS "job_levels_org_insert" ON public.job_levels;
CREATE POLICY "job_levels_org_insert"
  ON public.job_levels FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_levels_org_update" ON public.job_levels;
CREATE POLICY "job_levels_org_update"
  ON public.job_levels FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_levels_org_delete" ON public.job_levels;
CREATE POLICY "job_levels_org_delete"
  ON public.job_levels FOR DELETE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- employee_statuses: organization_id + is_active (per synckerja-reference CRUD hooks)
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_statuses
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.employee_statuses
  DROP CONSTRAINT IF EXISTS employee_statuses_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS employee_statuses_name_unique_global
  ON public.employee_statuses (lower(name))
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_statuses_name_unique_per_org
  ON public.employee_statuses (organization_id, lower(name))
  WHERE organization_id IS NOT NULL;

DROP POLICY IF EXISTS "employee_statuses_insert_authenticated" ON public.employee_statuses;
CREATE POLICY "employee_statuses_insert_authenticated"
  ON public.employee_statuses FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "employee_statuses_update_authenticated" ON public.employee_statuses;
CREATE POLICY "employee_statuses_update_authenticated"
  ON public.employee_statuses FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "employee_statuses_delete_authenticated" ON public.employee_statuses;
CREATE POLICY "employee_statuses_delete_authenticated"
  ON public.employee_statuses FOR DELETE TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- job_openings (recruitment module)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_openings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id uuid NULL REFERENCES public.departments (id) ON DELETE SET NULL,
  job_position_id uuid NULL REFERENCES public.job_positions (id) ON DELETE SET NULL,
  job_level_id uuid NULL REFERENCES public.job_levels (id) ON DELETE SET NULL,
  employment_status_id uuid NULL REFERENCES public.employee_statuses (id) ON DELETE SET NULL,
  job_title text NOT NULL,
  location text NULL,
  salary_min numeric NULL,
  salary_max numeric NULL,
  job_description text NULL,
  requirements text NULL,
  responsibilities text NULL,
  benefits text NULL,
  status text NOT NULL DEFAULT 'draft',
  posted_date timestamptz NULL,
  closing_date timestamptz NULL,
  clicks integer NOT NULL DEFAULT 0,
  submissions integer NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_openings_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'inactive'::text, 'draft'::text, 'closed'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_job_openings_organization_id ON public.job_openings (organization_id);
CREATE INDEX IF NOT EXISTS idx_job_openings_created_at ON public.job_openings (created_at DESC);

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_openings_org_select" ON public.job_openings;
CREATE POLICY "job_openings_org_select"
  ON public.job_openings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_openings_org_insert" ON public.job_openings;
CREATE POLICY "job_openings_org_insert"
  ON public.job_openings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_openings_org_update" ON public.job_openings;
CREATE POLICY "job_openings_org_update"
  ON public.job_openings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "job_openings_org_delete" ON public.job_openings;
CREATE POLICY "job_openings_org_delete"
  ON public.job_openings FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_job_openings_updated_at ON public.job_openings;
CREATE TRIGGER update_job_openings_updated_at
  BEFORE UPDATE ON public.job_openings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- recruitment_links (job_openings must exist first for FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruitment_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_opening_id uuid NOT NULL REFERENCES public.job_openings (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  department_id uuid NULL REFERENCES public.departments (id) ON DELETE SET NULL,
  preview_link text NULL,
  clicks integer NOT NULL DEFAULT 0,
  submissions integer NOT NULL DEFAULT 0,
  CONSTRAINT recruitment_links_token_unique UNIQUE (token),
  CONSTRAINT recruitment_links_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]))
);

CREATE INDEX IF NOT EXISTS idx_recruitment_links_job_opening_id ON public.recruitment_links (job_opening_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_links_organization_id ON public.recruitment_links (organization_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_links_token ON public.recruitment_links (token);

ALTER TABLE public.recruitment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_openings_public_read_via_link" ON public.job_openings;
DROP POLICY IF EXISTS "recruitment_links_org_all" ON public.recruitment_links;

CREATE POLICY "recruitment_links_org_select" ON public.recruitment_links
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "recruitment_links_org_insert" ON public.recruitment_links
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "recruitment_links_org_update" ON public.recruitment_links
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "recruitment_links_org_delete" ON public.recruitment_links
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "recruitment_links_public_read_active" ON public.recruitment_links
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE POLICY "job_openings_public_read_via_link" ON public.job_openings
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.recruitment_links rl
      WHERE rl.job_opening_id = job_openings.id
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  );

DROP TRIGGER IF EXISTS update_recruitment_links_updated_at ON public.recruitment_links;
CREATE TRIGGER update_recruitment_links_updated_at
  BEFORE UPDATE ON public.recruitment_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RPCs used by recruitment UI (SECURITY DEFINER so anon can bump counters on public apply flow)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_job_clicks(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_openings
  SET clicks = clicks + 1
  WHERE id = job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_job_submissions(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_openings
  SET submissions = submissions + 1
  WHERE id = job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_recruitment_link_clicks(link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recruitment_links
  SET clicks = clicks + 1
  WHERE id = link_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_recruitment_link_submissions(link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recruitment_links
  SET submissions = submissions + 1
  WHERE id = link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_job_clicks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_job_submissions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_recruitment_link_clicks(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_recruitment_link_submissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_job_clicks(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_job_submissions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_recruitment_link_clicks(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_recruitment_link_submissions(uuid) TO anon, authenticated;
