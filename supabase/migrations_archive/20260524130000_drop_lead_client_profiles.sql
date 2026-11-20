-- Client Profile data lives on lead_submissions; remove legacy bridge + lead_client_profiles.

DROP TRIGGER IF EXISTS trg_bridge_lead_submission_to_client_profile ON public.lead_submissions;
DROP FUNCTION IF EXISTS public.bridge_lead_submission_to_client_profile();

DROP TRIGGER IF EXISTS update_lead_client_profiles_updated_at ON public.lead_client_profiles;
DROP FUNCTION IF EXISTS public.update_lead_client_profiles_updated_at();

DROP POLICY IF EXISTS "lead_client_profiles_org" ON public.lead_client_profiles;

DROP TABLE IF EXISTS public.lead_client_profiles CASCADE;

-- RLS for CRM staff updating submission profile fields (idempotent).
ALTER TABLE public.lead_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_submissions_org" ON public.lead_submissions;
CREATE POLICY "lead_submissions_org"
  ON public.lead_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = lead_submissions.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = lead_submissions.organization_id
    )
  );
