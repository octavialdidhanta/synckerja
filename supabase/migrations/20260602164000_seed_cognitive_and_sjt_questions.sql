-- Seed Cognitive & SJT questions so the public candidate flow can run end-to-end.
--
-- UI reads:
-- - public.cognitive_questions for test type 'cognitive'
-- - public.sjt_questions for test type 'sjt'
-- and shows "Soal tes belum tersedia" when empty.

DO $$
DECLARE
  v_cognitive_test_id uuid := 'a1000000-0000-4000-8000-000000000002';
  v_sjt_test_id uuid := 'a1000000-0000-4000-8000-000000000003';
BEGIN
  -- Ensure meta rows exist (ids referenced by UI defaults)
  INSERT INTO public.tests (id, type, title, duration_minutes, is_active)
  VALUES
    (v_cognitive_test_id, 'cognitive', 'Cognitive', 15, true),
    (v_sjt_test_id, 'sjt', 'Situational Judgment', 15, true)
  ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    duration_minutes = EXCLUDED.duration_minutes,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  -- Re-seed deterministically
  DELETE FROM public.cognitive_questions WHERE test_id = v_cognitive_test_id;
  DELETE FROM public.sjt_questions WHERE test_id = v_sjt_test_id;

  -- Cognitive questions (30) — UI displays /30
  INSERT INTO public.cognitive_questions (
    test_id,
    question_order,
    question_text,
    option_1_text,
    option_2_text,
    option_3_text,
    option_4_text,
    correct_option_index,
    category
  )
  VALUES
    (v_cognitive_test_id,  1, '2 + 7 = ?',                     '8',  '9',  '10', '11', 2, 'numerical'),
    (v_cognitive_test_id,  2, '15 - 6 = ?',                    '7',  '8',  '9',  '10', 3, 'numerical'),
    (v_cognitive_test_id,  3, '3 × 4 = ?',                     '9',  '10', '11', '12', 4, 'numerical'),
    (v_cognitive_test_id,  4, 'Jika A > B dan B > C, maka ...', 'A > C', 'A < C', 'A = C', 'Tidak dapat ditentukan', 1, 'logical'),
    (v_cognitive_test_id,  5, 'Manakah yang bukan hewan?',      'Kucing', 'Sapi', 'Kursi', 'Kambing', 3, 'verbal'),
    (v_cognitive_test_id,  6, 'Sinonim "Cepat" adalah ...',     'Lambat', 'Segera', 'Keras', 'Tinggi', 2, 'verbal'),
    (v_cognitive_test_id,  7, 'Berapakah 20% dari 150?',        '20', '25', '30', '35', 3, 'numerical'),
    (v_cognitive_test_id,  8, 'Deret: 2, 4, 8, 16, ...',        '18', '20', '24', '32', 4, 'logical'),
    (v_cognitive_test_id,  9, 'Antonim "Baik" adalah ...',      'Bagus', 'Buruk', 'Ramah', 'Cantik', 2, 'verbal'),
    (v_cognitive_test_id, 10, 'Jika hari ini Selasa, 3 hari lagi adalah ...', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 2, 'logical'),
    (v_cognitive_test_id, 11, 'Perbandingan 3 : 9 sama dengan ...', '1 : 2', '1 : 3', '2 : 3', '3 : 4', 2, 'numerical'),
    (v_cognitive_test_id, 12, 'Manakah yang paling tepat melengkapi kalimat: "Ia ___ laporan itu dengan teliti."', 'memakan', 'menulis', 'membaca', 'menghitung', 3, 'verbal'),
    (v_cognitive_test_id, 13, 'Jika semua X adalah Y, dan semua Y adalah Z, maka ...', 'Semua X adalah Z', 'Semua Z adalah X', 'Sebagian Z adalah Y', 'Tidak ada hubungan', 1, 'logical'),
    (v_cognitive_test_id, 14, '45 ÷ 5 = ?',                     '7', '8', '9', '10', 3, 'numerical'),
    (v_cognitive_test_id, 15, 'Kata yang berbeda: apel, jeruk, mangga, meja', 'apel', 'jeruk', 'mangga', 'meja', 4, 'verbal'),
    (v_cognitive_test_id, 16, '6 + 8 = ?',                     '12', '13', '14', '15', 3, 'numerical'),
    (v_cognitive_test_id, 17, '12 + 9 = ?',                    '19', '20', '21', '22', 3, 'numerical'),
    (v_cognitive_test_id, 18, '18 - 7 = ?',                    '9',  '10', '11', '12', 3, 'numerical'),
    (v_cognitive_test_id, 19, '5 × 5 = ?',                     '20', '25', '30', '35', 2, 'numerical'),
    (v_cognitive_test_id, 20, 'Jika semua burung punya sayap, dan merpati adalah burung, maka ...', 'Merpati punya sayap', 'Merpati tidak punya sayap', 'Semua sayap adalah merpati', 'Tidak ada hubungan', 1, 'logical'),
    (v_cognitive_test_id, 21, 'Deret: 1, 3, 6, 10, ...',        '12', '13', '15', '16', 4, 'logical'),
    (v_cognitive_test_id, 22, 'Antonim "besar" adalah ...',      'tinggi', 'kecil', 'luas', 'panjang', 2, 'verbal'),
    (v_cognitive_test_id, 23, 'Sinonim "teliti" adalah ...',     'ceroboh', 'cermat', 'cepat', 'ramah', 2, 'verbal'),
    (v_cognitive_test_id, 24, 'Berapakah 10% dari 320?',         '16', '24', '32', '40', 3, 'numerical'),
    (v_cognitive_test_id, 25, '81 ÷ 9 = ?',                      '7', '8', '9', '10', 3, 'numerical'),
    (v_cognitive_test_id, 26, 'Jika X = 5 dan Y = 2, maka X + Y = ...', '6', '7', '8', '9', 2, 'logical'),
    (v_cognitive_test_id, 27, 'Manakah yang bukan warna?',        'Merah', 'Biru', 'Hijau', 'Meja', 4, 'verbal'),
    (v_cognitive_test_id, 28, 'Deret: 5, 10, 20, 40, ...',       '45', '60', '70', '80', 4, 'logical'),
    (v_cognitive_test_id, 29, '24 ÷ 3 = ?',                      '6', '7', '8', '9', 3, 'numerical'),
    (v_cognitive_test_id, 30, 'Jika hari ini Jumat, 2 hari lalu adalah ...', 'Rabu', 'Kamis', 'Selasa', 'Senin', 1, 'logical');

  -- SJT questions (12) — UI table shows /12
  INSERT INTO public.sjt_questions (
    test_id,
    question_order,
    scenario_text,
    option_1_text,
    option_2_text,
    option_3_text,
    option_4_text,
    best_option_index
  )
  VALUES
    (v_sjt_test_id,  1,
      'Rekan kerja terlambat mengirim data sehingga pekerjaan tim tertunda. Apa yang Anda lakukan?',
      'Marah di grup agar semua tahu',
      'Menanyakan hambatan dan bantu cari solusi agar cepat selesai',
      'Diam saja dan kerjakan sendiri tanpa komunikasi',
      'Laporkan langsung ke atasan tanpa klarifikasi',
      2
    ),
    (v_sjt_test_id,  2,
      'Anda menemukan kesalahan kecil pada laporan yang sudah hampir dikirim. Apa tindakan terbaik?',
      'Tetap kirim agar cepat selesai',
      'Perbaiki seperlunya dan informasikan perubahan ke pihak terkait',
      'Tunda tanpa kabar sampai Anda yakin 100%',
      'Biarkan orang lain yang menemukan nanti',
      2
    ),
    (v_sjt_test_id,  3,
      'Saat meeting, ide Anda dipotong sebelum selesai. Apa yang Anda lakukan?',
      'Membalas memotong pembicaraan orang itu',
      'Minta waktu dengan sopan untuk menyelesaikan penjelasan',
      'Diam dan tidak bicara lagi sepanjang meeting',
      'Keluar dari meeting',
      2
    ),
    (v_sjt_test_id,  4,
      'Deadline mepet dan Anda butuh bantuan. Bagaimana Anda meminta bantuan?',
      'Memaksa rekan tanpa menjelaskan konteks',
      'Jelaskan prioritas, bagi tugas jelas, dan sepakati waktu penyelesaian',
      'Tunggu sampai ada yang menawarkan',
      'Kerjakan sendiri walau berisiko telat',
      2
    ),
    (v_sjt_test_id,  5,
      'Anda menerima feedback keras dari atasan. Apa respon terbaik?',
      'Membela diri panjang lebar',
      'Dengarkan, klarifikasi poin penting, dan susun rencana perbaikan',
      'Mengabaikan karena merasa tidak adil',
      'Curhat ke tim untuk mencari dukungan',
      2
    ),
    (v_sjt_test_id,  6,
      'Klien meminta perubahan mendadak di luar scope. Apa yang Anda lakukan?',
      'Langsung setuju tanpa pertimbangan',
      'Diskusikan dampak scope/waktu/biaya dan tawarkan opsi',
      'Tolak mentah-mentah tanpa penjelasan',
      'Mengabaikan pesan klien',
      2
    ),
    (v_sjt_test_id,  7,
      'Ada konflik kecil antar anggota tim. Apa yang Anda lakukan?',
      'Memihak salah satu',
      'Fasilitasi diskusi fokus pada fakta dan solusi',
      'Biarkan sampai besar',
      'Laporkan ke HR tanpa mencoba menyelesaikan',
      2
    ),
    (v_sjt_test_id,  8,
      'Anda salah mengirim file ke grup internal. Apa yang Anda lakukan?',
      'Hapus pesan dan pura-pura tidak terjadi',
      'Akui, klarifikasi, dan kirim file yang benar',
      'Salahkan orang lain',
      'Keluar dari grup',
      2
    ),
    (v_sjt_test_id,  9,
      'Anda melihat rekan melanggar prosedur ringan untuk mempercepat kerja. Apa yang Anda lakukan?',
      'Ikut melanggar agar cepat',
      'Ingatkan dengan sopan dan jelaskan risiko, cari cara tetap efisien',
      'Diam saja',
      'Sebarkan ke tim agar jadi pelajaran',
      2
    ),
    (v_sjt_test_id, 10,
      'Anda mendapat tugas yang belum pernah Anda kerjakan. Apa langkah terbaik?',
      'Menolak',
      'Cari informasi, minta arahan singkat, dan mulai dari langkah kecil',
      'Tunda terus',
      'Kerjakan tanpa bertanya walau tidak yakin',
      2
    ),
    (v_sjt_test_id, 11,
      'Rekan meminta Anda menutupi kesalahannya. Apa yang Anda lakukan?',
      'Setuju agar hubungan baik',
      'Tolak dengan sopan dan bantu memperbaiki secara transparan',
      'Diam dan biarkan',
      'Langsung membeberkan ke semua orang',
      2
    ),
    (v_sjt_test_id, 12,
      'Anda melihat peluang perbaikan proses. Apa yang Anda lakukan?',
      'Tidak peduli karena bukan tugas Anda',
      'Catat, siapkan usulan singkat, dan diskusikan di waktu yang tepat',
      'Langsung ubah tanpa koordinasi',
      'Keluhkan ke teman saja',
      2
    );
END $$;

