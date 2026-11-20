-- Recruitment: per-applicant access token for the public candidate flow.
--
-- Before: every applicant of a job shared the job's recruitment-link token, and anon policies
-- granted access to any row whose token matched an active link. The anon flow was broken
-- (policies called user_organization_ids(), which anon cannot execute); simply fixing that would
-- have let anyone holding a job link read/edit every applicant's profile (NIK, birth date, files).
--
-- After:
--  * submit_job_application(link_token, ...) (SECURITY DEFINER, anon) creates the application +
--    candidate profile and issues a random per-applicant token (cand_<48 hex>), stored in
--    job_applications.recruitment_token and candidate_profiles.recruitment_token. HR's existing
--    "/candidate/profile?token=" links therefore become per-applicant automatically.
--  * The candidate pages send that token in the `x-candidate-token` request header. Anon can only
--    see/edit rows whose token equals the header (no listing of other applicants).
--  * candidate_submit_profile(token) marks the profile complete + application confirmed.
--  * Anon may no longer insert/update job_applications directly, and cannot change protected
--    candidate_profiles columns (organization, token, status, completion).
--  * Storage: anon may upload a CV to apply/<active link token>/... and documents to
--    <candidate profile id>/... (profile must hold a per-applicant token). Insert only.
--    HR can only open such files when they belong to an application/profile of their own org
--    (also closes: any org's HR could open CVs uploaded without an owner).
--  * Legacy rows that still carry a link token get a fresh per-applicant token.
--
-- Rollback: supabase/rollback/20261120_recruitment_per_applicant_token_rollback.sql

-- 1. Token from the request header (only the per-applicant format is accepted) ---------------
CREATE OR REPLACE FUNCTION public.candidate_request_token()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    v := nullif(current_setting('request.headers', true), '')::json ->> 'x-candidate-token';
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF v IS NULL OR v !~ '^cand_[0-9a-f]{48}$' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.candidate_request_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_request_token() TO anon, authenticated, service_role;

-- 2. Profile access helper used by the candidate_* child-table policies and the test RPCs ------
CREATE OR REPLACE FUNCTION public.candidate_profile_accessible(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tok text;
  org uuid;
  hdr text := public.candidate_request_token();
BEGIN
  SELECT recruitment_token, organization_id INTO tok, org
  FROM public.candidate_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  -- The candidate: holds this profile's own per-applicant token.
  IF hdr IS NOT NULL AND tok = hdr THEN
    RETURN true;
  END IF;
  -- Staff of the organization.
  IF auth.uid() IS NOT NULL THEN
    IF org IS NOT NULL AND org IN (SELECT public.user_organization_ids()) THEN
      RETURN true;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.candidate_profile_id = p_profile_id
        AND ja.organization_id IS NOT NULL
        AND ja.organization_id IN (SELECT public.user_organization_ids())
    ) THEN
      RETURN true;
    END IF;
  END IF;
  RETURN false;
END;
$$;

-- 3. Table policies for anon ------------------------------------------------------------------
DROP POLICY IF EXISTS cp_insert_anon ON public.candidate_profiles;
DROP POLICY IF EXISTS ja_insert_anon ON public.job_applications;
DROP POLICY IF EXISTS ja_update_anon ON public.job_applications;

ALTER POLICY cp_select_anon_token ON public.candidate_profiles
  USING (recruitment_token = public.candidate_request_token());

ALTER POLICY cp_update_anon ON public.candidate_profiles
  USING (recruitment_token = public.candidate_request_token())
  WITH CHECK (recruitment_token = public.candidate_request_token());

-- Candidates (anon) may edit their personal data but not these columns.
CREATE OR REPLACE FUNCTION public.candidate_profiles_guard_anon_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user = 'anon' THEN
    NEW.organization_id   := OLD.organization_id;
    NEW.recruitment_token := OLD.recruitment_token;
    NEW.status            := OLD.status;
    NEW.employment_status := OLD.employment_status;
    NEW.profile_completed := OLD.profile_completed;
    NEW.submitted_at      := OLD.submitted_at;
    NEW.created_at        := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.candidate_profiles_guard_anon_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS candidate_profiles_guard_anon_update ON public.candidate_profiles;
CREATE TRIGGER candidate_profiles_guard_anon_update
  BEFORE UPDATE ON public.candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.candidate_profiles_guard_anon_update();

-- 4. Submit an application from a public job link --------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_job_application(
  p_link_token text,
  p_applicant jsonb,
  p_skills jsonb DEFAULT '[]'::jsonb,
  p_cv_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link public.recruitment_links%ROWTYPE;
  v_name text  := left(btrim(coalesce(p_applicant->>'applicant_name', '')), 200);
  v_email text := lower(left(btrim(coalesce(p_applicant->>'applicant_email', '')), 200));
  v_phone text := nullif(left(btrim(coalesce(p_applicant->>'applicant_phone', '')), 40), '');
  v_birth date;
  v_token text;
  v_profile_id uuid;
  v_app_id uuid;
BEGIN
  IF p_link_token IS NULL OR length(p_link_token) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'invalid_link' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_link FROM public.recruitment_links
  WHERE token = p_link_token AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link' USING ERRCODE = 'P0001';
  END IF;

  IF v_name = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_applicant' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_birth := nullif(p_applicant->>'birth_date', '')::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_applicant' USING ERRCODE = 'P0001';
  END;

  IF p_cv_path IS NOT NULL AND (
       p_cv_path NOT LIKE 'apply/' || v_link.token || '/%'
       OR position('..' in p_cv_path) > 0
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'recruitment-files' AND o.name = p_cv_path)
     ) THEN
    RAISE EXCEPTION 'invalid_cv' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.job_applications ja
    WHERE ja.job_opening_id = v_link.job_opening_id AND lower(ja.applicant_email) = v_email
  ) THEN
    RAISE EXCEPTION 'already_applied' USING ERRCODE = 'P0001';
  END IF;

  v_token := 'cand_' || encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.candidate_profiles (
    organization_id, full_name, email, mobile_phone, birth_date, gender, nik,
    cover_letter, experience_years, expected_salary, employment_status, status,
    profile_completed, recruitment_token, cv_file_path
  ) VALUES (
    v_link.organization_id, v_name, v_email, v_phone, v_birth,
    nullif(left(p_applicant->>'gender', 20), ''),
    nullif(left(regexp_replace(coalesce(p_applicant->>'nik', ''), '\D', '', 'g'), 16), ''),
    left(p_applicant->>'cover_letter', 5000),
    left(p_applicant->>'experience_years', 50),
    left(p_applicant->>'expected_salary', 50),
    'pending', 'submitted', false, v_token, p_cv_path
  ) RETURNING id INTO v_profile_id;

  INSERT INTO public.job_applications (
    job_opening_id, organization_id, recruitment_link_id, candidate_profile_id,
    applicant_name, applicant_email, applicant_phone, birth_date, gender, nik,
    cv_file_path, cover_letter, experience_years, expected_salary, skills, status, recruitment_token
  ) VALUES (
    v_link.job_opening_id, v_link.organization_id, v_link.id, v_profile_id,
    v_name, v_email, v_phone, v_birth,
    nullif(left(p_applicant->>'gender', 20), ''),
    nullif(left(regexp_replace(coalesce(p_applicant->>'nik', ''), '\D', '', 'g'), 16), ''),
    p_cv_path,
    left(p_applicant->>'cover_letter', 5000),
    left(p_applicant->>'experience_years', 50),
    left(p_applicant->>'expected_salary', 50),
    CASE WHEN jsonb_typeof(p_skills) = 'array' THEN p_skills ELSE '[]'::jsonb END,
    'pending', v_token
  ) RETURNING id INTO v_app_id;

  UPDATE public.recruitment_links SET submissions = coalesce(submissions, 0) + 1 WHERE id = v_link.id;
  UPDATE public.job_openings SET submissions = coalesce(submissions, 0) + 1 WHERE id = v_link.job_opening_id;

  RETURN jsonb_build_object('application_id', v_app_id, 'candidate_profile_id', v_profile_id, 'token', v_token);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_job_application(text, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_application(text, jsonb, jsonb, text) TO anon, authenticated, service_role;

-- 5. Candidate finishes the profile form ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.candidate_submit_profile(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n int;
BEGIN
  IF p_token IS NULL OR p_token !~ '^cand_[0-9a-f]{48}$' THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.candidate_profiles
     SET profile_completed = true, submitted_at = now()
   WHERE recruitment_token = p_token;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.job_applications SET status = 'confirmed'
   WHERE recruitment_token = p_token AND status IN ('pending', 'submitted', 'interview', 'scheduled');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.candidate_submit_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_submit_profile(text) TO anon, authenticated, service_role;

-- 6. Storage ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recruitment_public_upload_allowed(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parts text[];
BEGIN
  IF p_name IS NULL OR position('..' in p_name) > 0 OR length(p_name) > 400 THEN
    RETURN false;
  END IF;
  parts := storage.foldername(p_name);
  -- CV during application: apply/<active link token>/<file>
  IF parts[1] = 'apply' THEN
    RETURN array_length(parts, 1) = 2
      AND p_name ~* '\.(pdf|doc|docx)$'
      AND EXISTS (SELECT 1 FROM public.recruitment_links rl
                  WHERE rl.token = parts[2] AND rl.status = 'active'
                    AND (rl.expires_at IS NULL OR rl.expires_at > now()));
  END IF;
  -- Profile documents: <candidate profile id>/<file>, profile must use a per-applicant token
  IF parts[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN array_length(parts, 1) = 1
      AND p_name ~* '\.(pdf|doc|docx|jpg|jpeg|png|webp)$'
      AND EXISTS (SELECT 1 FROM public.candidate_profiles c
                  WHERE c.id::text = parts[1] AND c.recruitment_token ~ '^cand_[0-9a-f]{48}$');
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.recruitment_public_upload_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruitment_public_upload_allowed(text) TO anon, service_role;

DROP POLICY IF EXISTS recruitment_files_insert_public ON storage.objects;
CREATE POLICY recruitment_files_insert_public ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'recruitment-files' AND public.recruitment_public_upload_allowed(name));

CREATE OR REPLACE FUNCTION public.recruitment_file_in_active_org(p_name text, p_owner uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.storage_active_organization_id();
  v_top text;
  v_owner uuid := COALESCE(p_owner, (SELECT auth.uid()));
BEGIN
  IF v_org IS NULL OR p_name IS NULL OR position('../' in p_name) > 0 THEN
    RETURN false;
  END IF;
  v_top := (storage.foldername(p_name))[1];
  -- Files uploaded by candidates (no owner): only the org the application belongs to.
  IF v_top = 'apply' OR (v_top = 'cvs' AND p_owner IS NULL) THEN
    RETURN EXISTS (SELECT 1 FROM public.job_applications ja
                   WHERE ja.cv_file_path = p_name AND ja.organization_id = v_org)
        OR EXISTS (SELECT 1 FROM public.candidate_profiles c
                   WHERE c.cv_file_path = p_name AND c.organization_id = v_org);
  END IF;
  IF v_top = 'cvs' THEN
    RETURN public.storage_user_in_active_org(v_owner::text);
  END IF;
  IF v_top ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    IF EXISTS (
      SELECT 1 FROM public.candidate_profiles c
      WHERE c.id::text = v_top AND c.organization_id = v_org
    ) OR EXISTS (
      SELECT 1 FROM public.candidate_documents d
      JOIN public.candidate_profiles c ON c.id = d.candidate_profile_id
      WHERE d.file_path = p_name AND c.organization_id = v_org
    ) OR EXISTS (
      SELECT 1 FROM public.candidate_profiles c
      WHERE c.cv_file_path = p_name AND c.organization_id = v_org
    ) THEN
      RETURN true;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.candidate_profiles c
      WHERE c.id::text = v_top AND c.organization_id IS DISTINCT FROM v_org
    ) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN public.storage_user_in_active_org(v_owner::text);
END;
$$;

-- 7. Legacy rows that still use a shared link token -------------------------------------------
DO $$
DECLARE
  r record;
  v_new text;
BEGIN
  FOR r IN SELECT id FROM public.candidate_profiles
           WHERE recruitment_token IS NOT NULL AND recruitment_token !~ '^cand_[0-9a-f]{48}$'
  LOOP
    v_new := 'cand_' || encode(extensions.gen_random_bytes(24), 'hex');
    UPDATE public.candidate_profiles SET recruitment_token = v_new WHERE id = r.id;
    UPDATE public.job_applications SET recruitment_token = v_new WHERE candidate_profile_id = r.id;
  END LOOP;
  FOR r IN SELECT id FROM public.job_applications
           WHERE recruitment_token IS NOT NULL AND recruitment_token !~ '^cand_[0-9a-f]{48}$'
  LOOP
    UPDATE public.job_applications
       SET recruitment_token = 'cand_' || encode(extensions.gen_random_bytes(24), 'hex')
     WHERE id = r.id;
  END LOOP;
END $$;
