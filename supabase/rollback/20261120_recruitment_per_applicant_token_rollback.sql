-- Rollback for 20261120120000_recruitment_per_applicant_token.sql.
-- Note: re-tokened legacy rows keep their new per-applicant tokens (old link tokens are not restored).

DROP POLICY IF EXISTS recruitment_files_insert_public ON storage.objects;
DROP FUNCTION IF EXISTS public.recruitment_public_upload_allowed(text);
DROP FUNCTION IF EXISTS public.submit_job_application(text, jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.candidate_submit_profile(text);
DROP TRIGGER IF EXISTS candidate_profiles_guard_anon_update ON public.candidate_profiles;
DROP FUNCTION IF EXISTS public.candidate_profiles_guard_anon_update();

ALTER POLICY cp_select_anon_token ON public.candidate_profiles
  USING ((recruitment_token IS NOT NULL) AND (EXISTS (SELECT 1 FROM recruitment_links rl
    WHERE rl.token = candidate_profiles.recruitment_token AND rl.status = 'active'
      AND (rl.expires_at IS NULL OR rl.expires_at > now()))));
ALTER POLICY cp_update_anon ON public.candidate_profiles
  USING (EXISTS (SELECT 1 FROM recruitment_links rl WHERE rl.token = candidate_profiles.recruitment_token
    AND rl.status = 'active' AND (rl.expires_at IS NULL OR rl.expires_at > now())))
  WITH CHECK (EXISTS (SELECT 1 FROM recruitment_links rl WHERE rl.token = candidate_profiles.recruitment_token
    AND rl.status = 'active' AND (rl.expires_at IS NULL OR rl.expires_at > now())));
CREATE POLICY cp_insert_anon ON public.candidate_profiles FOR INSERT TO anon
  WITH CHECK ((recruitment_token IS NOT NULL) AND (EXISTS (SELECT 1 FROM recruitment_links rl
    WHERE rl.token = candidate_profiles.recruitment_token AND rl.status = 'active'
      AND (rl.expires_at IS NULL OR rl.expires_at > now()))));
CREATE POLICY ja_insert_anon ON public.job_applications FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM recruitment_links rl WHERE rl.token = job_applications.recruitment_token
    AND rl.job_opening_id = job_applications.job_opening_id AND rl.status = 'active'
    AND (rl.expires_at IS NULL OR rl.expires_at > now())));
CREATE POLICY ja_update_anon ON public.job_applications FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM recruitment_links rl WHERE rl.token = job_applications.recruitment_token
    AND rl.job_opening_id = job_applications.job_opening_id AND rl.status = 'active'
    AND (rl.expires_at IS NULL OR rl.expires_at > now())))
  WITH CHECK (EXISTS (SELECT 1 FROM recruitment_links rl WHERE rl.token = job_applications.recruitment_token
    AND rl.job_opening_id = job_applications.job_opening_id AND rl.status = 'active'
    AND (rl.expires_at IS NULL OR rl.expires_at > now())));

CREATE OR REPLACE FUNCTION public.candidate_profile_accessible(p_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE tok text; org uuid;
BEGIN
  SELECT recruitment_token, organization_id INTO tok, org FROM public.candidate_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF org IS NOT NULL AND org IN (SELECT public.user_organization_ids()) THEN RETURN true; END IF;
    IF EXISTS (SELECT 1 FROM public.job_applications ja WHERE ja.candidate_profile_id = p_profile_id
               AND ja.organization_id IS NOT NULL AND ja.organization_id IN (SELECT public.user_organization_ids())) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.recruitment_links rl WHERE rl.token = tok AND rl.status = 'active'
                 AND (rl.expires_at IS NULL OR rl.expires_at > now()));
END; $$;

CREATE OR REPLACE FUNCTION public.recruitment_file_in_active_org(p_name text, p_owner uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid := public.storage_active_organization_id();
  v_top text;
  v_owner uuid := COALESCE(p_owner, (SELECT auth.uid()));
BEGIN
  IF v_org IS NULL OR p_name IS NULL OR position('../' in p_name) > 0 THEN RETURN false; END IF;
  v_top := (storage.foldername(p_name))[1];
  IF v_top = 'cvs' THEN RETURN public.storage_user_in_active_org(v_owner::text); END IF;
  IF v_top ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    IF EXISTS (SELECT 1 FROM public.candidate_profiles c WHERE c.id::text = v_top AND c.organization_id = v_org)
       OR EXISTS (SELECT 1 FROM public.candidate_documents d JOIN public.candidate_profiles c ON c.id = d.candidate_profile_id
                  WHERE d.file_path = p_name AND c.organization_id = v_org)
       OR EXISTS (SELECT 1 FROM public.candidate_profiles c WHERE c.cv_file_path = p_name AND c.organization_id = v_org) THEN
      RETURN true;
    END IF;
    IF EXISTS (SELECT 1 FROM public.candidate_profiles c WHERE c.id::text = v_top AND c.organization_id IS DISTINCT FROM v_org) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN public.storage_user_in_active_org(v_owner::text);
END; $$;

DROP FUNCTION IF EXISTS public.candidate_request_token();
