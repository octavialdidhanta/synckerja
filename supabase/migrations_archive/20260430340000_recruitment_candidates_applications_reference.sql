-- Recruitment: candidate_profiles, job_applications, reviews, child tables, tests — aligned with src/2-2-recruitment-dashboard

-- ---------------------------------------------------------------------------
-- Review taxonomy (CandidateReviewsTab)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_category (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_review (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text text NOT NULL,
  review_category_id uuid NOT NULL REFERENCES public.review_category (id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.review_category (id, name, description, is_active, sort_order)
VALUES
  ('a2000000-0000-4000-8000-000000000001', 'general', 'Penilaian keseluruhan', true, 1),
  ('a2000000-0000-4000-8000-000000000002', 'technical', 'Keterampilan teknis', true, 2),
  ('a2000000-0000-4000-8000-000000000003', 'communication', 'Komunikasi', true, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.question_review (id, question_text, review_category_id, organization_id, is_default, is_active, sort_order)
VALUES
  (
    'a3000000-0000-4000-8000-000000000001',
    'Bagaimana penilaian keseluruhan Anda terhadap kandidat ini?',
    'a2000000-0000-4000-8000-000000000001',
    NULL,
    true,
    true,
    1
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- candidate_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  mobile_phone text NULL,
  birth_date date NULL,
  birth_place text NULL,
  gender text NULL,
  nik text NULL,
  religion text NULL,
  marital_status text NULL,
  nationality text NULL,
  blood_type text NULL,
  address text NULL,
  citizen_address text NULL,
  postal_code text NULL,
  recruitment_token text NULL,
  profile_completed boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NULL,
  photo_url text NULL,
  cover_letter text NULL,
  experience_years text NULL,
  expected_salary text NULL,
  employment_status text NULL,
  status text NULL,
  cv_file_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS candidate_profiles_email_recruitment_token_lower
  ON public.candidate_profiles (lower(email), recruitment_token)
  WHERE recruitment_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_org ON public.candidate_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_token ON public.candidate_profiles (recruitment_token);

-- ---------------------------------------------------------------------------
-- job_applications (depends on job_openings, recruitment_links from prior migration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_opening_id uuid NOT NULL REFERENCES public.job_openings (id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  recruitment_link_id uuid NULL REFERENCES public.recruitment_links (id) ON DELETE SET NULL,
  candidate_profile_id uuid NULL REFERENCES public.candidate_profiles (id) ON DELETE SET NULL,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  applicant_phone text NULL,
  birth_date date NULL,
  gender text NULL,
  nik text NULL,
  cv_file_path text NULL,
  cover_letter text NULL,
  experience_years text NULL,
  expected_salary text NULL,
  skills jsonb NULL,
  status text NOT NULL DEFAULT 'pending',
  recruitment_token text NULL,
  interview_status text NULL,
  interview_date timestamptz NULL,
  interview_time text NULL,
  interview_location text NULL,
  interviewer_name text NULL,
  interviewer_email text NULL,
  interview_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_applications_org ON public.job_applications (organization_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON public.job_applications (job_opening_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_token ON public.job_applications (recruitment_token);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_profile ON public.job_applications (candidate_profile_id);

-- ---------------------------------------------------------------------------
-- candidate_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  question_review_id uuid NOT NULL REFERENCES public.question_review (id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL,
  reviewer_name text NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text NULL,
  review_category_id uuid NOT NULL REFERENCES public.review_category (id) ON DELETE RESTRICT,
  is_recommendation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_reviews_profile ON public.candidate_reviews (candidate_profile_id);

-- ---------------------------------------------------------------------------
-- Child tables (candidate profile tabs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_educations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  degree text NULL,
  field_of_study text NULL,
  start_date date NULL,
  end_date date NULL,
  grade_gpa text NULL,
  description text NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_informal_educations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  course_name text NOT NULL,
  provider text NULL,
  field_of_certification text NULL,
  certificate_number text NULL,
  start_date date NULL,
  end_date date NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_work_experiences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  position text NOT NULL,
  job_description text NULL,
  start_date date NULL,
  end_date date NULL,
  is_current boolean NOT NULL DEFAULT false,
  location text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_family_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL,
  gender text NULL,
  age integer NULL,
  occupation text NULL,
  phone text NULL,
  address text NULL,
  is_emergency_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  document_type text NOT NULL,
  mime_type text NULL,
  file_size bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recruitment_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_opening_id uuid NOT NULL REFERENCES public.job_openings (id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  is_required boolean NOT NULL DEFAULT false,
  skill_level text NOT NULL DEFAULT 'beginner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruitment_skills_skill_level_check CHECK (
    skill_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_recruitment_skills_job ON public.recruitment_skills (job_opening_id);

-- ---------------------------------------------------------------------------
-- Tests (DISC / cognitive / SJT) — IDs match DEFAULT_*_TEST_ID in React tabs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tests (
  id uuid NOT NULL PRIMARY KEY,
  type text NOT NULL,
  title text NULL,
  duration_minutes integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tests_type_check CHECK (type = ANY (ARRAY['disc'::text, 'cognitive'::text, 'sjt'::text]))
);

INSERT INTO public.tests (id, type, title, duration_minutes, is_active)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'disc', 'DISC', 10, true),
  ('a1000000-0000-4000-8000-000000000002', 'cognitive', 'Cognitive', 15, true),
  ('a1000000-0000-4000-8000-000000000003', 'sjt', 'Situational Judgment', 15, true)
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  duration_minutes = EXCLUDED.duration_minutes,
  is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS public.candidate_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles (id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  started_at timestamptz NULL,
  submitted_at timestamptz NULL,
  score_d integer NULL,
  score_i integer NULL,
  score_s integer NULL,
  score_c integer NULL,
  score_total integer NULL,
  score_verbal integer NULL,
  score_numerical integer NULL,
  score_logical integer NULL,
  score_sjt integer NULL,
  sjt_dimension_scores jsonb NULL,
  answers jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_tests_unique_profile_test UNIQUE (candidate_profile_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_tests_profile ON public.candidate_tests (candidate_profile_id);

CREATE TABLE IF NOT EXISTS public.test_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
  question_order integer NOT NULL DEFAULT 0,
  option_1_text text NULL,
  option_1_dimension text NULL,
  option_2_text text NULL,
  option_2_dimension text NULL,
  option_3_text text NULL,
  option_3_dimension text NULL,
  option_4_text text NULL,
  option_4_dimension text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cognitive_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
  question_order integer NOT NULL DEFAULT 0,
  question_text text NULL,
  option_1_text text NULL,
  option_2_text text NULL,
  option_3_text text NULL,
  option_4_text text NULL,
  correct_option_index integer NOT NULL DEFAULT 0,
  category text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sjt_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES public.tests (id) ON DELETE CASCADE,
  question_order integer NOT NULL DEFAULT 0,
  scenario_text text NULL,
  option_1_text text NULL,
  option_2_text text NULL,
  option_3_text text NULL,
  option_4_text text NULL,
  best_option_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Access helper (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.candidate_profile_accessible(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok text;
  org uuid;
BEGIN
  SELECT recruitment_token, organization_id INTO tok, org
  FROM public.candidate_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
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
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.recruitment_links rl
    WHERE rl.token = tok
      AND rl.status = 'active'
      AND (rl.expires_at IS NULL OR rl.expires_at > now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.candidate_profile_accessible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_profile_accessible(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.review_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_informal_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sjt_questions ENABLE ROW LEVEL SECURITY;

-- review_category
DROP POLICY IF EXISTS "review_category_select_auth" ON public.review_category;
CREATE POLICY "review_category_select_auth"
  ON public.review_category FOR SELECT TO authenticated
  USING (COALESCE(is_active, true));

-- question_review
DROP POLICY IF EXISTS "question_review_select_auth" ON public.question_review;
CREATE POLICY "question_review_select_auth"
  ON public.question_review FOR SELECT TO authenticated
  USING (COALESCE(is_active, true));

DROP POLICY IF EXISTS "question_review_insert_org" ON public.question_review;
CREATE POLICY "question_review_insert_org"
  ON public.question_review FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "question_review_update_org" ON public.question_review;
CREATE POLICY "question_review_update_org"
  ON public.question_review FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
  );

-- candidate_profiles
DROP POLICY IF EXISTS "cp_select_auth" ON public.candidate_profiles;
CREATE POLICY "cp_select_auth"
  ON public.candidate_profiles FOR SELECT TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id IN (SELECT public.user_organization_ids()))
    OR EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.candidate_profile_id = candidate_profiles.id
        AND ja.organization_id IS NOT NULL
        AND ja.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "cp_select_anon_token" ON public.candidate_profiles;
CREATE POLICY "cp_select_anon_token"
  ON public.candidate_profiles FOR SELECT TO anon
  USING (
    recruitment_token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.recruitment_links rl
      WHERE rl.token = candidate_profiles.recruitment_token
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "cp_insert_auth" ON public.candidate_profiles;
CREATE POLICY "cp_insert_auth"
  ON public.candidate_profiles FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "cp_insert_anon" ON public.candidate_profiles;
CREATE POLICY "cp_insert_anon"
  ON public.candidate_profiles FOR INSERT TO anon
  WITH CHECK (
    recruitment_token IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.recruitment_links rl
      WHERE rl.token = candidate_profiles.recruitment_token
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "cp_update_auth" ON public.candidate_profiles;
CREATE POLICY "cp_update_auth"
  ON public.candidate_profiles FOR UPDATE TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id IN (SELECT public.user_organization_ids()))
    OR EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.candidate_profile_id = candidate_profiles.id
        AND ja.organization_id IS NOT NULL
        AND ja.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    organization_id IS NULL
    OR (organization_id IS NOT NULL AND organization_id IN (SELECT public.user_organization_ids()))
    OR EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.candidate_profile_id = candidate_profiles.id
        AND ja.organization_id IS NOT NULL
        AND ja.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "cp_update_anon" ON public.candidate_profiles;
CREATE POLICY "cp_update_anon"
  ON public.candidate_profiles FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.recruitment_links rl
      WHERE rl.token = candidate_profiles.recruitment_token
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recruitment_links rl
      WHERE rl.token = candidate_profiles.recruitment_token
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "cp_delete_auth" ON public.candidate_profiles;
CREATE POLICY "cp_delete_auth"
  ON public.candidate_profiles FOR DELETE TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id IN (SELECT public.user_organization_ids()))
    OR EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.candidate_profile_id = candidate_profiles.id
        AND ja.organization_id IS NOT NULL
        AND ja.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- job_applications
DROP POLICY IF EXISTS "ja_select_auth" ON public.job_applications;
CREATE POLICY "ja_select_auth"
  ON public.job_applications FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "ja_insert_auth" ON public.job_applications;
CREATE POLICY "ja_insert_auth"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "ja_insert_anon" ON public.job_applications;
CREATE POLICY "ja_insert_anon"
  ON public.job_applications FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recruitment_links rl
      WHERE rl.token = job_applications.recruitment_token
        AND rl.job_opening_id = job_applications.job_opening_id
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "ja_update_auth" ON public.job_applications;
CREATE POLICY "ja_update_auth"
  ON public.job_applications FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "ja_update_anon" ON public.job_applications;
CREATE POLICY "ja_update_anon"
  ON public.job_applications FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.recruitment_links rl
      WHERE rl.token = job_applications.recruitment_token
        AND rl.job_opening_id = job_applications.job_opening_id
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recruitment_links rl
      WHERE rl.token = job_applications.recruitment_token
        AND rl.job_opening_id = job_applications.job_opening_id
        AND rl.status = 'active'
        AND (rl.expires_at IS NULL OR rl.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "ja_delete_auth" ON public.job_applications;
CREATE POLICY "ja_delete_auth"
  ON public.job_applications FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- candidate_reviews
DROP POLICY IF EXISTS "cr_all_auth" ON public.candidate_reviews;
CREATE POLICY "cr_all_auth"
  ON public.candidate_reviews FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = candidate_reviews.candidate_profile_id
        AND (
          (cp.organization_id IS NOT NULL AND cp.organization_id IN (SELECT public.user_organization_ids()))
          OR EXISTS (
            SELECT 1 FROM public.job_applications ja
            WHERE ja.candidate_profile_id = cp.id
              AND ja.organization_id IS NOT NULL
              AND ja.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = candidate_reviews.candidate_profile_id
        AND (
          (cp.organization_id IS NOT NULL AND cp.organization_id IN (SELECT public.user_organization_ids()))
          OR EXISTS (
            SELECT 1 FROM public.job_applications ja
            WHERE ja.candidate_profile_id = cp.id
              AND ja.organization_id IS NOT NULL
              AND ja.organization_id IN (SELECT public.user_organization_ids())
          )
        )
    )
  );

-- Child tables: same access as parent profile
DROP POLICY IF EXISTS "ced_all" ON public.candidate_educations;
CREATE POLICY "ced_all"
  ON public.candidate_educations FOR ALL TO authenticated
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "ced_all_anon" ON public.candidate_educations;
CREATE POLICY "ced_all_anon"
  ON public.candidate_educations FOR ALL TO anon
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cie_all" ON public.candidate_informal_educations;
CREATE POLICY "cie_all"
  ON public.candidate_informal_educations FOR ALL TO authenticated
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cie_all_anon" ON public.candidate_informal_educations;
CREATE POLICY "cie_all_anon"
  ON public.candidate_informal_educations FOR ALL TO anon
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cwe_all" ON public.candidate_work_experiences;
CREATE POLICY "cwe_all"
  ON public.candidate_work_experiences FOR ALL TO authenticated
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cwe_all_anon" ON public.candidate_work_experiences;
CREATE POLICY "cwe_all_anon"
  ON public.candidate_work_experiences FOR ALL TO anon
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cfm_all" ON public.candidate_family_members;
CREATE POLICY "cfm_all"
  ON public.candidate_family_members FOR ALL TO authenticated
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cfm_all_anon" ON public.candidate_family_members;
CREATE POLICY "cfm_all_anon"
  ON public.candidate_family_members FOR ALL TO anon
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cdoc_all" ON public.candidate_documents;
CREATE POLICY "cdoc_all"
  ON public.candidate_documents FOR ALL TO authenticated
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "cdoc_all_anon" ON public.candidate_documents;
CREATE POLICY "cdoc_all_anon"
  ON public.candidate_documents FOR ALL TO anon
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

-- recruitment_skills
DROP POLICY IF EXISTS "rs_org" ON public.recruitment_skills;
CREATE POLICY "rs_org"
  ON public.recruitment_skills FOR ALL TO authenticated
  USING (
    organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())
  );

-- tests & questions (read-only for clients; content seeded separately)
DROP POLICY IF EXISTS "tests_read" ON public.tests;
CREATE POLICY "tests_read"
  ON public.tests FOR SELECT TO anon, authenticated
  USING (COALESCE(is_active, true));

DROP POLICY IF EXISTS "tq_read" ON public.test_questions;
CREATE POLICY "tq_read"
  ON public.test_questions FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "cq_read" ON public.cognitive_questions;
CREATE POLICY "cq_read"
  ON public.cognitive_questions FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "sjtq_read" ON public.sjt_questions;
CREATE POLICY "sjtq_read"
  ON public.sjt_questions FOR SELECT TO anon, authenticated
  USING (true);

-- candidate_tests
DROP POLICY IF EXISTS "ct_all_auth" ON public.candidate_tests;
CREATE POLICY "ct_all_auth"
  ON public.candidate_tests FOR ALL TO authenticated
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

DROP POLICY IF EXISTS "ct_all_anon" ON public.candidate_tests;
CREATE POLICY "ct_all_anon"
  ON public.candidate_tests FOR ALL TO anon
  USING (public.candidate_profile_accessible(candidate_profile_id))
  WITH CHECK (public.candidate_profile_accessible(candidate_profile_id));

-- ---------------------------------------------------------------------------
-- Triggers: updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_review_category_updated_at ON public.review_category;
CREATE TRIGGER update_review_category_updated_at
  BEFORE UPDATE ON public.review_category
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_question_review_updated_at ON public.question_review;
CREATE TRIGGER update_question_review_updated_at
  BEFORE UPDATE ON public.question_review
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_profiles_updated_at ON public.candidate_profiles;
CREATE TRIGGER update_candidate_profiles_updated_at
  BEFORE UPDATE ON public.candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_reviews_updated_at ON public.candidate_reviews;
CREATE TRIGGER update_candidate_reviews_updated_at
  BEFORE UPDATE ON public.candidate_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_educations_updated_at ON public.candidate_educations;
CREATE TRIGGER update_candidate_educations_updated_at
  BEFORE UPDATE ON public.candidate_educations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_informal_educations_updated_at ON public.candidate_informal_educations;
CREATE TRIGGER update_candidate_informal_educations_updated_at
  BEFORE UPDATE ON public.candidate_informal_educations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_work_experiences_updated_at ON public.candidate_work_experiences;
CREATE TRIGGER update_candidate_work_experiences_updated_at
  BEFORE UPDATE ON public.candidate_work_experiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_family_members_updated_at ON public.candidate_family_members;
CREATE TRIGGER update_candidate_family_members_updated_at
  BEFORE UPDATE ON public.candidate_family_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_documents_updated_at ON public.candidate_documents;
CREATE TRIGGER update_candidate_documents_updated_at
  BEFORE UPDATE ON public.candidate_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_recruitment_skills_updated_at ON public.recruitment_skills;
CREATE TRIGGER update_recruitment_skills_updated_at
  BEFORE UPDATE ON public.recruitment_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tests_updated_at ON public.tests;
CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_tests_updated_at ON public.candidate_tests;
CREATE TRIGGER update_candidate_tests_updated_at
  BEFORE UPDATE ON public.candidate_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_questions_updated_at ON public.test_questions;
CREATE TRIGGER update_test_questions_updated_at
  BEFORE UPDATE ON public.test_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cognitive_questions_updated_at ON public.cognitive_questions;
CREATE TRIGGER update_cognitive_questions_updated_at
  BEFORE UPDATE ON public.cognitive_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sjt_questions_updated_at ON public.sjt_questions;
CREATE TRIGGER update_sjt_questions_updated_at
  BEFORE UPDATE ON public.sjt_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
