-- Cognitive & SJT test RPCs used by the public candidate flow.
--
-- UI calls:
-- - public.cognitive_start_test(p_recruitment_token text)
-- - public.cognitive_submit_answer(p_recruitment_token text, p_candidate_test_id uuid, p_cognitive_question_id uuid, p_selected_option_index int)
-- - public.cognitive_submit_test(p_recruitment_token text, p_candidate_test_id uuid)
--
-- - public.sjt_start_test(p_recruitment_token text)
-- - public.sjt_submit_answer(p_recruitment_token text, p_candidate_test_id uuid, p_sjt_question_id uuid, p_selected_option_index int)
-- - public.sjt_submit_test(p_recruitment_token text, p_candidate_test_id uuid)
--
-- These RPCs validate access via public.candidate_profile_accessible(profile_id).

-- ---------------------------------------------------------------------------
-- Cognitive
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cognitive_start_test(p_recruitment_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_test_id uuid;
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
  INTO v_test_id, v_duration_minutes
  FROM public.tests t
  WHERE t.type = 'cognitive'
    AND t.is_active = true
  ORDER BY t.updated_at DESC
  LIMIT 1;

  IF v_test_id IS NULL THEN
    v_test_id := 'a1000000-0000-4000-8000-000000000002'::uuid;
    v_duration_minutes := 15;
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
    v_test_id,
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
    score_total = NULL,
    score_verbal = NULL,
    score_numerical = NULL,
    score_logical = NULL,
    answers = NULL,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_candidate_test_id;

  RETURN jsonb_build_object(
    'candidate_test_id', v_candidate_test_id,
    'started_at', v_started_at,
    'duration_minutes', COALESCE(v_duration_minutes, 15)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cognitive_start_test(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cognitive_start_test(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cognitive_submit_answer(
  p_recruitment_token text,
  p_candidate_test_id uuid,
  p_cognitive_question_id uuid,
  p_selected_option_index integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_candidate_profile_id uuid;
  v_test_id uuid;
BEGIN
  IF p_recruitment_token IS NULL OR btrim(p_recruitment_token) = '' THEN
    RAISE EXCEPTION 'Token tidak valid';
  END IF;
  IF p_candidate_test_id IS NULL OR p_cognitive_question_id IS NULL THEN
    RAISE EXCEPTION 'Parameter tidak valid';
  END IF;
  IF p_selected_option_index NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'Pilihan jawaban tidak valid';
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.cognitive_questions cq
    WHERE cq.id = p_cognitive_question_id
      AND cq.test_id = v_test_id
  ) THEN
    RAISE EXCEPTION 'Soal tidak valid';
  END IF;

  UPDATE public.candidate_tests ct
  SET
    status = 'in_progress',
    answers = jsonb_set(
      COALESCE(ct.answers, '{}'::jsonb),
      ARRAY[p_cognitive_question_id::text],
      to_jsonb(p_selected_option_index),
      true
    ),
    updated_at = now()
  WHERE ct.id = p_candidate_test_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cognitive_submit_answer(text, uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cognitive_submit_answer(text, uuid, uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cognitive_submit_test(
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
  v_total integer := 0;
  v_verbal integer := 0;
  v_numerical integer := 0;
  v_logical integer := 0;
  r record;
  v_selected integer;
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
    SELECT cq.id, cq.correct_option_index, cq.category
    FROM public.cognitive_questions cq
    WHERE cq.test_id = v_test_id
    ORDER BY cq.question_order ASC
  LOOP
    v_selected := NULLIF((v_answers ->> r.id::text)::int, 0);
    IF v_selected IS NULL THEN
      CONTINUE;
    END IF;
    IF v_selected = r.correct_option_index THEN
      v_total := v_total + 1;
      IF r.category = 'verbal' THEN
        v_verbal := v_verbal + 1;
      ELSIF r.category = 'numerical' THEN
        v_numerical := v_numerical + 1;
      ELSIF r.category = 'logical' THEN
        v_logical := v_logical + 1;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.candidate_tests ct
  SET
    status = 'submitted',
    submitted_at = now(),
    score_total = v_total,
    score_verbal = v_verbal,
    score_numerical = v_numerical,
    score_logical = v_logical,
    updated_at = now()
  WHERE ct.id = p_candidate_test_id;

  RETURN jsonb_build_object(
    'score_total', v_total,
    'score_verbal', v_verbal,
    'score_numerical', v_numerical,
    'score_logical', v_logical
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cognitive_submit_test(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cognitive_submit_test(text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- SJT
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sjt_start_test(p_recruitment_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_test_id uuid;
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
  INTO v_test_id, v_duration_minutes
  FROM public.tests t
  WHERE t.type = 'sjt'
    AND t.is_active = true
  ORDER BY t.updated_at DESC
  LIMIT 1;

  IF v_test_id IS NULL THEN
    v_test_id := 'a1000000-0000-4000-8000-000000000003'::uuid;
    v_duration_minutes := 15;
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
    v_test_id,
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
    score_sjt = NULL,
    sjt_dimension_scores = NULL,
    answers = NULL,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_candidate_test_id;

  RETURN jsonb_build_object(
    'candidate_test_id', v_candidate_test_id,
    'started_at', v_started_at,
    'duration_minutes', COALESCE(v_duration_minutes, 15)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sjt_start_test(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sjt_start_test(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sjt_submit_answer(
  p_recruitment_token text,
  p_candidate_test_id uuid,
  p_sjt_question_id uuid,
  p_selected_option_index integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_candidate_profile_id uuid;
  v_test_id uuid;
BEGIN
  IF p_recruitment_token IS NULL OR btrim(p_recruitment_token) = '' THEN
    RAISE EXCEPTION 'Token tidak valid';
  END IF;
  IF p_candidate_test_id IS NULL OR p_sjt_question_id IS NULL THEN
    RAISE EXCEPTION 'Parameter tidak valid';
  END IF;
  IF p_selected_option_index NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'Pilihan jawaban tidak valid';
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.sjt_questions sq
    WHERE sq.id = p_sjt_question_id
      AND sq.test_id = v_test_id
  ) THEN
    RAISE EXCEPTION 'Soal tidak valid';
  END IF;

  UPDATE public.candidate_tests ct
  SET
    status = 'in_progress',
    answers = jsonb_set(
      COALESCE(ct.answers, '{}'::jsonb),
      ARRAY[p_sjt_question_id::text],
      to_jsonb(p_selected_option_index),
      true
    ),
    updated_at = now()
  WHERE ct.id = p_candidate_test_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sjt_submit_answer(text, uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sjt_submit_answer(text, uuid, uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sjt_submit_test(
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
  v_score integer := 0;
  v_total_weighted integer := 0;
  v_count_a integer := 0;
  v_count_b integer := 0;
  v_count_c integer := 0;
  v_count_d integer := 0;
  v_dim_etika jsonb := jsonb_build_object('A', 0, 'B', 0, 'C', 0, 'D', 0, 'weighted', 0);
  v_dim_komunikasi jsonb := jsonb_build_object('A', 0, 'B', 0, 'C', 0, 'D', 0, 'weighted', 0);
  v_dim_prioritas jsonb := jsonb_build_object('A', 0, 'B', 0, 'C', 0, 'D', 0, 'weighted', 0);
  v_dim_konflik jsonb := jsonb_build_object('A', 0, 'B', 0, 'C', 0, 'D', 0, 'weighted', 0);
  v_dim_prosedur jsonb := jsonb_build_object('A', 0, 'B', 0, 'C', 0, 'D', 0, 'weighted', 0);
  v_dim_key text;
  v_grade text;
  v_weight integer;
  r record;
  v_selected integer;
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
    SELECT sq.id, sq.best_option_index, sq.question_order
    FROM public.sjt_questions sq
    WHERE sq.test_id = v_test_id
    ORDER BY sq.question_order ASC
  LOOP
    v_selected := NULLIF((v_answers ->> r.id::text)::int, 0);
    IF v_selected IS NULL THEN
      CONTINUE;
    END IF;

    -- Grade simplification:
    -- A (4) if best option, otherwise C (2). This matches sjtResultUtils "new format"
    -- which expects A/B/C/D counts + weighted totals per dimension.
    IF v_selected = r.best_option_index THEN
      v_grade := 'A';
      v_weight := 4;
      v_score := v_score + 1;
    ELSE
      v_grade := 'C';
      v_weight := 2;
    END IF;

    v_total_weighted := v_total_weighted + v_weight;
    IF v_grade = 'A' THEN
      v_count_a := v_count_a + 1;
    ELSIF v_grade = 'B' THEN
      v_count_b := v_count_b + 1;
    ELSIF v_grade = 'C' THEN
      v_count_c := v_count_c + 1;
    ELSE
      v_count_d := v_count_d + 1;
    END IF;

    -- Dimension mapping by question_order (cycles across 5 dimensions):
    -- 1 etika, 2 komunikasi, 3 prioritas, 4 konflik, 0 prosedur
    v_dim_key := CASE (r.question_order % 5)
      WHEN 1 THEN 'etika'
      WHEN 2 THEN 'komunikasi'
      WHEN 3 THEN 'prioritas'
      WHEN 4 THEN 'konflik'
      ELSE 'prosedur'
    END;

    IF v_dim_key = 'etika' THEN
      v_dim_etika := jsonb_set(v_dim_etika, ARRAY[v_grade], to_jsonb(COALESCE((v_dim_etika ->> v_grade)::int, 0) + 1), true);
      v_dim_etika := jsonb_set(v_dim_etika, ARRAY['weighted'], to_jsonb(COALESCE((v_dim_etika ->> 'weighted')::int, 0) + v_weight), true);
    ELSIF v_dim_key = 'komunikasi' THEN
      v_dim_komunikasi := jsonb_set(v_dim_komunikasi, ARRAY[v_grade], to_jsonb(COALESCE((v_dim_komunikasi ->> v_grade)::int, 0) + 1), true);
      v_dim_komunikasi := jsonb_set(v_dim_komunikasi, ARRAY['weighted'], to_jsonb(COALESCE((v_dim_komunikasi ->> 'weighted')::int, 0) + v_weight), true);
    ELSIF v_dim_key = 'prioritas' THEN
      v_dim_prioritas := jsonb_set(v_dim_prioritas, ARRAY[v_grade], to_jsonb(COALESCE((v_dim_prioritas ->> v_grade)::int, 0) + 1), true);
      v_dim_prioritas := jsonb_set(v_dim_prioritas, ARRAY['weighted'], to_jsonb(COALESCE((v_dim_prioritas ->> 'weighted')::int, 0) + v_weight), true);
    ELSIF v_dim_key = 'konflik' THEN
      v_dim_konflik := jsonb_set(v_dim_konflik, ARRAY[v_grade], to_jsonb(COALESCE((v_dim_konflik ->> v_grade)::int, 0) + 1), true);
      v_dim_konflik := jsonb_set(v_dim_konflik, ARRAY['weighted'], to_jsonb(COALESCE((v_dim_konflik ->> 'weighted')::int, 0) + v_weight), true);
    ELSE
      v_dim_prosedur := jsonb_set(v_dim_prosedur, ARRAY[v_grade], to_jsonb(COALESCE((v_dim_prosedur ->> v_grade)::int, 0) + 1), true);
      v_dim_prosedur := jsonb_set(v_dim_prosedur, ARRAY['weighted'], to_jsonb(COALESCE((v_dim_prosedur ->> 'weighted')::int, 0) + v_weight), true);
    END IF;
  END LOOP;

  UPDATE public.candidate_tests ct
  SET
    status = 'submitted',
    submitted_at = now(),
    score_sjt = v_score,
    sjt_dimension_scores = jsonb_build_object(
      'total_weighted', v_total_weighted,
      'count_A', v_count_a,
      'count_B', v_count_b,
      'count_C', v_count_c,
      'count_D', v_count_d,
      'etika', v_dim_etika,
      'komunikasi', v_dim_komunikasi,
      'prioritas', v_dim_prioritas,
      'konflik', v_dim_konflik,
      'prosedur', v_dim_prosedur
    ),
    updated_at = now()
  WHERE ct.id = p_candidate_test_id;

  RETURN jsonb_build_object(
    'score_sjt', v_score,
    'sjt_dimension_scores', jsonb_build_object(
      'total_weighted', v_total_weighted,
      'count_A', v_count_a,
      'count_B', v_count_b,
      'count_C', v_count_c,
      'count_D', v_count_d,
      'etika', v_dim_etika,
      'komunikasi', v_dim_komunikasi,
      'prioritas', v_dim_prioritas,
      'konflik', v_dim_konflik,
      'prosedur', v_dim_prosedur
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sjt_submit_test(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sjt_submit_test(text, uuid) TO anon, authenticated;

