-- DISC test RPCs used by the public candidate flow.
--
-- UI calls:
-- - public.disc_start_test(p_recruitment_token text)
-- - public.disc_submit_answer(p_recruitment_token text, p_candidate_test_id uuid, p_test_question_id uuid, p_most_like_option_index int, p_least_like_option_index int)
-- - public.disc_submit_test(p_recruitment_token text, p_candidate_test_id uuid)
--
-- These RPCs validate access via public.candidate_profile_accessible(profile_id).

CREATE OR REPLACE FUNCTION public.disc_start_test(p_recruitment_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_disc_test_id uuid;
  v_duration_minutes integer;
  v_candidate_test_id uuid;
  v_started_at timestamptz;
BEGIN
  IF p_recruitment_token IS NULL OR btrim(p_recruitment_token) = '' THEN
    RAISE EXCEPTION 'Token tidak valid';
  END IF;

  SELECT cp.id INTO v_profile_id
  FROM public.candidate_profiles cp
  WHERE cp.recruitment_token = btrim(p_recruitment_token)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile tidak ditemukan';
  END IF;

  IF NOT public.candidate_profile_accessible(v_profile_id) THEN
    RAISE EXCEPTION 'Tidak memiliki akses';
  END IF;

  SELECT t.id, t.duration_minutes
  INTO v_disc_test_id, v_duration_minutes
  FROM public.tests t
  WHERE t.type = 'disc'
    AND t.is_active = true
  ORDER BY t.updated_at DESC
  LIMIT 1;

  IF v_disc_test_id IS NULL THEN
    -- fallback to default id used by UI
    v_disc_test_id := 'a1000000-0000-4000-8000-000000000001'::uuid;
    v_duration_minutes := 10;
  END IF;

  v_started_at := now();

  INSERT INTO public.candidate_tests (
    candidate_profile_id,
    test_id,
    status,
    started_at,
    created_at,
    updated_at
  )
  VALUES (
    v_profile_id,
    v_disc_test_id,
    'in_progress',
    v_started_at,
    v_started_at,
    v_started_at
  )
  ON CONFLICT (candidate_profile_id, test_id)
  DO UPDATE SET
    status = 'in_progress',
    started_at = EXCLUDED.started_at,
    submitted_at = NULL,
    score_d = NULL,
    score_i = NULL,
    score_s = NULL,
    score_c = NULL,
    score_total = NULL,
    answers = NULL,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_candidate_test_id;

  RETURN jsonb_build_object(
    'candidate_test_id', v_candidate_test_id,
    'started_at', v_started_at,
    'duration_minutes', COALESCE(v_duration_minutes, 10)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disc_start_test(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disc_start_test(text) TO anon, authenticated;

-- Store one answer per question in candidate_tests.answers (jsonb map by question_id).
CREATE OR REPLACE FUNCTION public.disc_submit_answer(
  p_recruitment_token text,
  p_candidate_test_id uuid,
  p_test_question_id uuid,
  p_most_like_option_index integer,
  p_least_like_option_index integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_test_id uuid;
  v_candidate_profile_id uuid;
  v_answer jsonb;
BEGIN
  IF p_recruitment_token IS NULL OR btrim(p_recruitment_token) = '' THEN
    RAISE EXCEPTION 'Token tidak valid';
  END IF;
  IF p_candidate_test_id IS NULL OR p_test_question_id IS NULL THEN
    RAISE EXCEPTION 'Parameter tidak valid';
  END IF;
  IF p_most_like_option_index NOT BETWEEN 1 AND 4 OR p_least_like_option_index NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'Pilihan jawaban tidak valid';
  END IF;
  IF p_most_like_option_index = p_least_like_option_index THEN
    RAISE EXCEPTION 'Pilihan P dan K tidak boleh sama';
  END IF;

  SELECT cp.id INTO v_profile_id
  FROM public.candidate_profiles cp
  WHERE cp.recruitment_token = btrim(p_recruitment_token)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile tidak ditemukan';
  END IF;

  IF NOT public.candidate_profile_accessible(v_profile_id) THEN
    RAISE EXCEPTION 'Tidak memiliki akses';
  END IF;

  SELECT ct.candidate_profile_id, ct.test_id
  INTO v_candidate_profile_id, v_test_id
  FROM public.candidate_tests ct
  WHERE ct.id = p_candidate_test_id
  LIMIT 1;

  IF v_candidate_profile_id IS NULL THEN
    RAISE EXCEPTION 'Tes kandidat tidak ditemukan';
  END IF;

  IF v_candidate_profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'Tes kandidat tidak sesuai';
  END IF;

  -- Ensure question belongs to the same test
  IF NOT EXISTS (
    SELECT 1
    FROM public.test_questions tq
    WHERE tq.id = p_test_question_id
      AND tq.test_id = v_test_id
  ) THEN
    RAISE EXCEPTION 'Soal tidak valid';
  END IF;

  v_answer := jsonb_build_object(
    'most', p_most_like_option_index,
    'least', p_least_like_option_index
  );

  UPDATE public.candidate_tests ct
  SET
    status = 'in_progress',
    answers = jsonb_set(
      COALESCE(ct.answers, '{}'::jsonb),
      ARRAY[p_test_question_id::text],
      v_answer,
      true
    ),
    updated_at = now()
  WHERE ct.id = p_candidate_test_id;
END;
$$;

REVOKE ALL ON FUNCTION public.disc_submit_answer(text, uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disc_submit_answer(text, uuid, uuid, integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.disc_submit_test(
  p_recruitment_token text,
  p_candidate_test_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_candidate_profile_id uuid;
  v_test_id uuid;
  v_answers jsonb;
  v_score_d integer := 0;
  v_score_i integer := 0;
  v_score_s integer := 0;
  v_score_c integer := 0;
  r record;
  v_most_idx integer;
  v_least_idx integer;
  v_most_dim text;
  v_least_dim text;
BEGIN
  IF p_recruitment_token IS NULL OR btrim(p_recruitment_token) = '' THEN
    RAISE EXCEPTION 'Token tidak valid';
  END IF;
  IF p_candidate_test_id IS NULL THEN
    RAISE EXCEPTION 'Parameter tidak valid';
  END IF;

  SELECT cp.id INTO v_profile_id
  FROM public.candidate_profiles cp
  WHERE cp.recruitment_token = btrim(p_recruitment_token)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile tidak ditemukan';
  END IF;

  IF NOT public.candidate_profile_accessible(v_profile_id) THEN
    RAISE EXCEPTION 'Tidak memiliki akses';
  END IF;

  SELECT ct.candidate_profile_id, ct.test_id, ct.answers
  INTO v_candidate_profile_id, v_test_id, v_answers
  FROM public.candidate_tests ct
  WHERE ct.id = p_candidate_test_id
  LIMIT 1;

  IF v_candidate_profile_id IS NULL THEN
    RAISE EXCEPTION 'Tes kandidat tidak ditemukan';
  END IF;
  IF v_candidate_profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'Tes kandidat tidak sesuai';
  END IF;

  v_answers := COALESCE(v_answers, '{}'::jsonb);

  FOR r IN
    SELECT tq.id,
           tq.option_1_dimension, tq.option_2_dimension, tq.option_3_dimension, tq.option_4_dimension
    FROM public.test_questions tq
    WHERE tq.test_id = v_test_id
    ORDER BY tq.question_order ASC
  LOOP
    v_most_idx := NULLIF((v_answers -> r.id::text ->> 'most')::int, 0);
    v_least_idx := NULLIF((v_answers -> r.id::text ->> 'least')::int, 0);

    IF v_most_idx IS NULL OR v_least_idx IS NULL THEN
      CONTINUE;
    END IF;

    v_most_dim := CASE v_most_idx
      WHEN 1 THEN r.option_1_dimension
      WHEN 2 THEN r.option_2_dimension
      WHEN 3 THEN r.option_3_dimension
      WHEN 4 THEN r.option_4_dimension
      ELSE NULL
    END;

    v_least_dim := CASE v_least_idx
      WHEN 1 THEN r.option_1_dimension
      WHEN 2 THEN r.option_2_dimension
      WHEN 3 THEN r.option_3_dimension
      WHEN 4 THEN r.option_4_dimension
      ELSE NULL
    END;

    IF v_most_dim = 'D' THEN v_score_d := v_score_d + 1;
    ELSIF v_most_dim = 'I' THEN v_score_i := v_score_i + 1;
    ELSIF v_most_dim = 'S' THEN v_score_s := v_score_s + 1;
    ELSIF v_most_dim = 'C' THEN v_score_c := v_score_c + 1;
    END IF;

    IF v_least_dim = 'D' THEN v_score_d := v_score_d - 1;
    ELSIF v_least_dim = 'I' THEN v_score_i := v_score_i - 1;
    ELSIF v_least_dim = 'S' THEN v_score_s := v_score_s - 1;
    ELSIF v_least_dim = 'C' THEN v_score_c := v_score_c - 1;
    END IF;
  END LOOP;

  UPDATE public.candidate_tests ct
  SET
    status = 'submitted',
    submitted_at = now(),
    score_d = v_score_d,
    score_i = v_score_i,
    score_s = v_score_s,
    score_c = v_score_c,
    updated_at = now()
  WHERE ct.id = p_candidate_test_id;

  RETURN jsonb_build_object(
    'score_d', v_score_d,
    'score_i', v_score_i,
    'score_s', v_score_s,
    'score_c', v_score_c
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disc_submit_test(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disc_submit_test(text, uuid) TO anon, authenticated;

