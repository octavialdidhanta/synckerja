-- Seed DISC test questions (public.test_questions) for the default DISC test id.
--
-- UI expects questions in public.test_questions for test_id DISC, otherwise it shows:
-- "Soal tes belum tersedia".
--
-- Note: tests are global (no organization_id on public.tests), so this is seeded once per DB.

DO $$
DECLARE
  v_disc_test_id uuid := 'a1000000-0000-4000-8000-000000000001';
BEGIN
  -- Ensure the DISC test meta row exists (id is referenced from UI as DEFAULT_DISC_TEST_ID).
  INSERT INTO public.tests (id, type, title, duration_minutes, is_active)
  VALUES (v_disc_test_id, 'disc', 'DISC', 10, true)
  ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    duration_minutes = EXCLUDED.duration_minutes,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  -- Re-seed questions deterministically (avoid duplicates across deployments).
  DELETE FROM public.test_questions
  WHERE test_id = v_disc_test_id;

  -- Each question: 4 adjectives/phrases, each mapped to a DISC dimension (D/I/S/C).
  INSERT INTO public.test_questions (
    test_id,
    question_order,
    option_1_text, option_1_dimension,
    option_2_text, option_2_dimension,
    option_3_text, option_3_dimension,
    option_4_text, option_4_dimension
  )
  VALUES
    (v_disc_test_id,  1, 'Tegas',                 'D', 'Ramah',                  'I', 'Sabar',                 'S', 'Teliti',                'C'),
    (v_disc_test_id,  2, 'Cepat mengambil keputusan','D', 'Mudah bergaul',       'I', 'Konsisten',             'S', 'Analitis',              'C'),
    (v_disc_test_id,  3, 'Berorientasi hasil',     'D', 'Antusias',              'I', 'Pendengar baik',         'S', 'Teratur',               'C'),
    (v_disc_test_id,  4, 'Berani tantangan',       'D', 'Optimis',               'I', 'Kooperatif',             'S', 'Cermat',                'C'),
    (v_disc_test_id,  5, 'Kompetitif',             'D', 'Persuasif',             'I', 'Setia',                  'S', 'Akurat',                'C'),
    (v_disc_test_id,  6, 'Langsung ke inti',       'D', 'Ekspresif',             'I', 'Tenang',                 'S', 'Berpikir sistematis',   'C'),
    (v_disc_test_id,  7, 'Mandiri',                'D', 'Menginspirasi',         'I', 'Suka membantu',          'S', 'Berdasar data',         'C'),
    (v_disc_test_id,  8, 'Berani mengambil risiko','D', 'Menyenangkan',          'I', 'Stabil',                'S', 'Patuh prosedur',        'C'),
    (v_disc_test_id,  9, 'Berorientasi target',    'D', 'Komunikatif',           'I', 'Harmonis',              'S', 'Perfeksionis',          'C'),
    (v_disc_test_id, 10, 'Suka memimpin',          'D', 'Suka dikenal',          'I', 'Sabar menghadapi proses','S', 'Suka aturan jelas',     'C'),
    (v_disc_test_id, 11, 'Teguh pendirian',        'D', 'Hangat',                'I', 'Dapat diandalkan',       'S', 'Berhati-hati',          'C'),
    (v_disc_test_id, 12, 'Berani mengoreksi',      'D', 'Mudah memulai percakapan','I','Mengutamakan kenyamanan','S','Menghindari kesalahan','C'),
    (v_disc_test_id, 13, 'Tidak suka bertele-tele','D', 'Suka bercerita',         'I', 'Suka rutinitas',         'S', 'Suka detail',           'C'),
    (v_disc_test_id, 14, 'Menuntut standar tinggi','D', 'Membangun relasi',       'I', 'Menjaga kedamaian',      'S', 'Mengikuti instruksi',   'C'),
    (v_disc_test_id, 15, 'Suka tantangan baru',    'D', 'Penuh ide',             'I', 'Suka kerja tim',         'S', 'Menyusun rencana',      'C'),
    (v_disc_test_id, 16, 'Berorientasi aksi',      'D', 'Spontan',               'I', 'Menghindari konflik',    'S', 'Memastikan kualitas',   'C'),
    (v_disc_test_id, 17, 'Suka memegang kendali',  'D', 'Mudah memotivasi',      'I', 'Suka mendukung orang lain','S','Mengecek ulang',     'C'),
    (v_disc_test_id, 18, 'Suka tantang status quo','D', 'Suka tampil',           'I', 'Sabar menunggu',         'S', 'Butuh kepastian',       'C'),
    (v_disc_test_id, 19, 'Berani berkata tidak',   'D', 'Mudah percaya',         'I', 'Setia pada proses',      'S', 'Kritis',               'C'),
    (v_disc_test_id, 20, 'Menyukai kompetisi',     'D', 'Suka kolaborasi sosial','I', 'Stabil emosi',            'S', 'Berpikir logis',        'C'),
    (v_disc_test_id, 21, 'Fokus pada solusi',      'D', 'Membawa energi positif','I', 'Suka konsensus',          'S', 'Suka dokumentasi',      'C'),
    (v_disc_test_id, 22, 'Cepat bergerak',         'D', 'Mudah beradaptasi sosial','I','Suka ritme kerja stabil','S','Mengevaluasi risiko', 'C'),
    (v_disc_test_id, 23, 'Berani mengambil alih',  'D', 'Mudah mempengaruhi',    'I', 'Tulus',                  'S', 'Tepat waktu',           'C'),
    (v_disc_test_id, 24, 'Ingin menang',           'D', 'Suka interaksi',        'I', 'Sabar & konsisten',      'S', 'Mematuhi standar',      'C');
END $$;

