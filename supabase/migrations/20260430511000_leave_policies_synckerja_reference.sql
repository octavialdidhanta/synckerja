-- public.leave_policies — synckerja-reference types (useLeavePolicy hook).
-- Fixes: PostgREST 404 / PGRST205 (table missing on deployed DB).

CREATE TABLE IF NOT EXISTS public.leave_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  policy_name text NOT NULL,
  policy_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  probation_months integer NULL,
  auto_grant_after_probation boolean NULL,
  annual_leave_days integer NULL,
  leave_grant_after_months integer NULL,
  effective_date date NULL,
  leave_strategy text NULL,
  carry_over_limit integer NULL,
  carry_over_expiry_months integer NULL,
  max_leave_balance integer NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_policies_organization_id ON public.leave_policies (organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_policies_org_enabled_created_at
  ON public.leave_policies (organization_id, created_at DESC)
  WHERE is_enabled = true;

COMMENT ON TABLE public.leave_policies IS
  'Leave policy per organization; aligns with synckerja-reference leave_policies.';

ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_policies_select" ON public.leave_policies;
CREATE POLICY "leave_policies_select"
  ON public.leave_policies FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "leave_policies_insert" ON public.leave_policies;
CREATE POLICY "leave_policies_insert"
  ON public.leave_policies FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "leave_policies_update" ON public.leave_policies;
CREATE POLICY "leave_policies_update"
  ON public.leave_policies FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "leave_policies_delete" ON public.leave_policies;
CREATE POLICY "leave_policies_delete"
  ON public.leave_policies FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS leave_policies_updated_at ON public.leave_policies;
CREATE TRIGGER leave_policies_updated_at
  BEFORE UPDATE ON public.leave_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

