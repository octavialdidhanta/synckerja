-- Recruitment: storage bucket for candidate uploads + optional permission_configurations (Page Access)

INSERT INTO storage.buckets (id, name, public)
VALUES ('recruitment-files', 'recruitment-files', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Authenticated users can manage objects in recruitment-files for their org flows (tighten in a follow-up migration if needed)
DROP POLICY IF EXISTS "recruitment_files_authenticated_all" ON storage.objects;
CREATE POLICY "recruitment_files_authenticated_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'recruitment-files')
  WITH CHECK (bucket_id = 'recruitment-files');

-- Page access defaults (from synckerja-reference create_permission_configurations.sql)
CREATE TABLE IF NOT EXISTS public.permission_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    page_path TEXT NOT NULL,
    page_title TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    roles_allowed TEXT[] DEFAULT ARRAY[]::TEXT[],
    job_levels_allowed TEXT[] DEFAULT ARRAY[]::TEXT[],
    exceptions TEXT[] DEFAULT ARRAY[]::TEXT[],
    exception_paths TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_configurations_organization_id ON public.permission_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_permission_configurations_page_path ON public.permission_configurations(page_path);
CREATE INDEX IF NOT EXISTS idx_permission_configurations_is_active ON public.permission_configurations(is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_configurations_unique_page_org
ON public.permission_configurations(organization_id, page_path)
WHERE organization_id IS NOT NULL AND is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_configurations_unique_page_system
ON public.permission_configurations(page_path)
WHERE organization_id IS NULL AND is_active = TRUE;

CREATE OR REPLACE FUNCTION public.update_permission_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_permission_configurations_updated_at ON public.permission_configurations;
CREATE TRIGGER update_permission_configurations_updated_at
  BEFORE UPDATE ON public.permission_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_permission_configurations_updated_at();

INSERT INTO public.permission_configurations (
  id, organization_id, page_path, page_title, is_active, roles_allowed, exceptions, exception_paths
) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', NULL, '/dashboard', 'Dashboard', TRUE, ARRAY['owner', 'admin', 'employee']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  ('550e8400-e29b-41d4-a716-446655440002', NULL, '/employee-management', 'Employee Management', TRUE, ARRAY['owner', 'admin']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  ('550e8400-e29b-41d4-a716-446655440003', NULL, '/recruitment', 'Recruitment', TRUE, ARRAY['owner', 'admin']::TEXT[], ARRAY[]::TEXT[], ARRAY['/recruitment/interviewees']::TEXT[]),
  ('550e8400-e29b-41d4-a716-446655440004', NULL, '/access-permissions', 'Access Permissions', TRUE, ARRAY['owner']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  ('550e8400-e29b-41d4-a716-446655440005', NULL, '/subscription', 'Subscription Management', TRUE, ARRAY['owner']::TEXT[], ARRAY[]::TEXT[], ARRAY[]::TEXT[])
ON CONFLICT (id) DO NOTHING;
