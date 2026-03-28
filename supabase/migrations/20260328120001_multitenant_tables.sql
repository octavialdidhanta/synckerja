-- Core multi-tenant tables for onboarding (run on fresh project; skip objects you already created manually)

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL REFERENCES auth.users (id),
  company_name text NOT NULL,
  industry text NOT NULL,
  address text NULL,
  phone_number text NULL,
  website text NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tax_id text NULL,
  email text NULL,
  logo_url text NULL,
  employee_count text NULL,
  created_by uuid NULL REFERENCES auth.users (id),
  has_active_subscription boolean NULL DEFAULT false,
  terms_accepted boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamptz NULL,
  mission text NULL,
  vision text NULL,
  about_us text NULL,
  established text NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_user_id ON public.organizations (user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations (created_by);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NULL,
  name text NOT NULL,
  description text NULL,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_active boolean NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id),
  is_default boolean NULL DEFAULT false,
  CONSTRAINT departments_name_organization_id_key UNIQUE (name, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS departments_code_key ON public.departments (code) WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_departments_is_default ON public.departments (is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_departments_created_by ON public.departments (created_by);

DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_active boolean NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_organizations_user_org_key UNIQUE (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NULL
);

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_subscriptions_updated_at ON public.organization_subscriptions;
CREATE TRIGGER update_organization_subscriptions_updated_at
  BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: tighten per your security model; permissive for authenticated CRUD on own org data
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_authenticated_all" ON public.organizations;
DROP POLICY IF EXISTS "dept_authenticated_all" ON public.departments;
DROP POLICY IF EXISTS "uo_authenticated_all" ON public.user_organizations;
DROP POLICY IF EXISTS "ur_authenticated_all" ON public.user_roles;
DROP POLICY IF EXISTS "emp_authenticated_all" ON public.employees;
DROP POLICY IF EXISTS "os_authenticated_all" ON public.organization_subscriptions;

CREATE POLICY "org_authenticated_all" ON public.organizations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "dept_authenticated_all" ON public.departments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "uo_authenticated_all" ON public.user_organizations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ur_authenticated_all" ON public.user_roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "emp_authenticated_all" ON public.employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "os_authenticated_all" ON public.organization_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- If you use AFTER INSERT triggers on organizations (e.g. setup_new_organization),
-- audit those functions in the Supabase SQL editor: they must NOT insert into
-- organization_subscriptions until the /create-plan step, and must not conflict
-- with client inserts into departments / user_organizations / user_roles / employees.
