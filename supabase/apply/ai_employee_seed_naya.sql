-- AI Employee step 4b: seed Naya untuk organisasi Synckerja Office.
-- Jalankan utuh di SQL editor. Satu transaksi. Jangan dipecah.
-- Id organisasi, owner, departemen, status, dan siklus diambil dengan SELECT.
--
-- Dicocokkan ke database live pada 2 Nov 2026:
-- departemen aktif: Operations (POS, bukan default) dan Synckerja (is_default).
-- Naya memakai departemen default Synckerja. Departemen baru tidak dibuat.
-- Jabatan "Digital Marketing" di job_positions bukan departemen, jadi tidak dipakai.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $seed$
DECLARE
  v_org uuid;
  v_owner_user uuid;
  v_reviewer uuid;
  v_department uuid;
  v_status uuid;
  v_cycle uuid;
  v_cycle_start date;
  v_cycle_end date;
  v_employee uuid;
  v_company uuid;
  v_department_objective uuid;
  v_individual uuid;
  v_sop1 uuid;
  v_sop2 uuid;
  v_sop3 uuid;
  v_count integer;
  v_names text;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.organizations
  WHERE company_name = 'Synckerja Office';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Organisasi "Synckerja Office" harus tepat satu baris, ketemu %.',
      v_count;
  END IF;

  SELECT id INTO v_org
  FROM public.organizations
  WHERE company_name = 'Synckerja Office';

  SELECT COUNT(DISTINCT user_id) INTO v_count
  FROM public.user_roles
  WHERE organization_id = v_org
    AND lower(btrim(role)) = 'owner';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Owner organisasi harus tepat satu user, ketemu %.',
      v_count;
  END IF;

  SELECT DISTINCT user_id INTO v_owner_user
  FROM public.user_roles
  WHERE organization_id = v_org
    AND lower(btrim(role)) = 'owner';

  SELECT COUNT(*) INTO v_count
  FROM public.employees
  WHERE organization_id = v_org
    AND user_id = v_owner_user
    AND COALESCE(is_ai, false) = false;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Owner harus punya tepat satu baris karyawan manusia di organisasi ini, ketemu %.',
      v_count;
  END IF;

  SELECT id INTO v_reviewer
  FROM public.employees
  WHERE organization_id = v_org
    AND user_id = v_owner_user
    AND COALESCE(is_ai, false) = false;

  SELECT string_agg(name, ', ' ORDER BY name) INTO v_names
  FROM public.departments
  WHERE organization_id = v_org
    AND COALESCE(is_active, true);

  SELECT COUNT(*) INTO v_count
  FROM public.departments
  WHERE organization_id = v_org
    AND COALESCE(is_active, true)
    AND COALESCE(is_default, false)
    AND lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) = 'synckerja';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Departemen default aktif bernama Synckerja harus tepat satu baris, ketemu %. Departemen aktif: %.',
      v_count,
      COALESCE(v_names, '(tidak ada)');
  END IF;

  SELECT id INTO v_department
  FROM public.departments
  WHERE organization_id = v_org
    AND COALESCE(is_active, true)
    AND COALESCE(is_default, false)
    AND lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) = 'synckerja';

  SELECT id INTO v_status
  FROM public.employee_statuses
  WHERE lower(btrim(name)) = 'active'
    AND (organization_id = v_org OR organization_id IS NULL)
  ORDER BY organization_id NULLS LAST
  LIMIT 1;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Status karyawan "active" tidak ditemukan.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.okr_cycles
  WHERE organization_id = v_org
    AND is_active;

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Siklus OKR aktif harus tepat satu, ketemu %.',
      v_count;
  END IF;

  SELECT id, start_date, end_date
  INTO v_cycle, v_cycle_start, v_cycle_end
  FROM public.okr_cycles
  WHERE organization_id = v_org
    AND is_active;

  IF EXISTS (
    SELECT 1
    FROM public.employees
    WHERE organization_id = v_org
      AND COALESCE(is_ai, false)
      AND lower(btrim(full_name)) = 'naya'
  ) THEN
    RAISE EXCEPTION 'Karyawan AI bernama Naya sudah ada di organisasi ini.';
  END IF;

  INSERT INTO public.employees (
    organization_id,
    full_name,
    user_id,
    is_ai,
    department_id,
    employee_status_id,
    manager_id
  ) VALUES (
    v_org,
    'Naya',
    NULL,
    true,
    v_department,
    v_status,
    v_reviewer
  )
  RETURNING id INTO v_employee;

  INSERT INTO public.ai_employee_profiles (
    employee_id,
    organization_id,
    job_title,
    department_id,
    reviewer_employee_id,
    time_zone,
    is_active,
    performance_status
  ) VALUES (
    v_employee,
    v_org,
    'Content Planner',
    v_department,
    v_reviewer,
    'Asia/Jakarta',
    true,
    'on_track'
  );

  INSERT INTO public.ai_employee_sops (
    employee_id, organization_id, code, version, is_current, title
  ) VALUES
    (v_employee, v_org, 'SOP1', 1, true, 'Perencanaan konten mingguan'),
    (v_employee, v_org, 'SOP2', 1, true, 'Menerima dan mengerjakan tugas dadakan'),
    (v_employee, v_org, 'SOP3', 1, true, 'Merevisi hasil yang ditolak')
  ;

  SELECT id INTO v_sop1
  FROM public.ai_employee_sops
  WHERE employee_id = v_employee AND code = 'SOP1' AND is_current;

  SELECT id INTO v_sop2
  FROM public.ai_employee_sops
  WHERE employee_id = v_employee AND code = 'SOP2' AND is_current;

  SELECT id INTO v_sop3
  FROM public.ai_employee_sops
  WHERE employee_id = v_employee AND code = 'SOP3' AND is_current;

  INSERT INTO public.ai_employee_sop_steps (sop_id, step_no, instruction, may_call_model)
  VALUES
    (
      v_sop1, 1,
      'Tanpa model, baca kalender Senin–Minggu berikutnya, plan yang sudah ada, katalog aktif, content pillar organisasi, rantai Thinking Lab yang sudah dikonfirmasi manusia, dan sebaran pillar Naya pada 4 jendela minggu terakhir.',
      false
    ),
    (
      v_sop1, 2,
      'Tanpa model, hitung hari yang belum punya plan dan pangsa tiap pillar. Hasil hitungan masuk log run.',
      false
    ),
    (
      v_sop1, 3,
      'Bila jendela sudah penuh dan tidak ada pillar yang melewati 40%, berhenti. Log run berstatus selesai tanpa memanggil model.',
      false
    ),
    (
      v_sop1, 4,
      'Bila ada celah, pilih pillar yang penambahannya tidak membuat pangsa 4 minggu melewati 40%. Panggil model lewat generate-script-ai di dalam batas 15 panggilan hari itu. Konteks prompt: SOP ini, pillar yang dipilih, katalog, rantai Thinking Lab, dan catatan penolakan yang masih berlaku.',
      true
    ),
    (
      v_sop1, 5,
      'Simpan draf lewat content.plans.create atau thinking.plan.save. Satu plan punya judul, tanggal di dalam Senin–Minggu berikutnya, brief, dan content_pillar_id. Paling banyak 7 plan, satu per hari.',
      false
    ),
    (
      v_sop1, 6,
      'Untuk plan yang lahir dari Thinking Lab, jalankan thinking.execution.check. Pemanggilan ini dihitung sebagai panggilan model. Yang gagal tidak diserahkan. Perbaiki sekali lewat model, lalu cek ulang. Perbaikan dan cek ulang juga dihitung.',
      true
    ),
    (
      v_sop1, 7,
      'Set status produksi need review. Jangan set approved, production_approved, atau jadwal tayang.',
      false
    ),
    (
      v_sop1, 8,
      'Tulis log run: waktu mulai, waktu selesai, jumlah plan baru, jumlah panggilan model, dan daftar id plan. Selesai sebelum Jumat 17:00.',
      false
    ),
    (
      v_sop2, 1,
      'Catat teks instruksi, tenggat, dan prioritas pada tugas. Urgent boleh dikerjakan kapan saja. Normal hanya Senin–Jumat 08:00–17:00.',
      false
    ),
    (
      v_sop2, 2,
      'Tanpa model, kumpulkan katalog, kalender, dan rantai Thinking Lab yang relevan dengan instruksi.',
      false
    ),
    (
      v_sop2, 3,
      'Panggil model sekali untuk menyusun plan atau brief, di dalam batas 15 panggilan hari itu. Bila instruksi hanya memindahkan tanggal plan milik Naya, lakukan tanpa model.',
      true
    ),
    (
      v_sop2, 4,
      'Tulis draf pada plan dan pada step tugas, supaya reviewer melihat hasil di kalender dan di daily task.',
      false
    ),
    (
      v_sop2, 5,
      'Ajukan completion_approvals dengan status pending lewat tasks.completion.request. Jangan mengubah status tugas menjadi selesai sebelum approval.',
      false
    ),
    (
      v_sop3, 1,
      'Tanpa model, baca alasan penolakan dan simpan sebagai catatan feedback yang terikat ke plan atau tugas, serta ke karyawan Naya.',
      false
    ),
    (
      v_sop3, 2,
      'Hitung revisi yang sudah dilakukan untuk objek yang sama. Batasnya 2.',
      false
    ),
    (
      v_sop3, 3,
      'Pada revisi pertama dan kedua, panggil model dengan draf lama, alasan penolakan, dan feedback yang masih berlaku. Setiap panggilan dihitung ke batas 15 hari itu. Hasilnya menimpa draf, bukan membuat plan kedua untuk permintaan yang sama.',
      true
    ),
    (
      v_sop3, 4,
      'Kembalikan plan ke need review, atau ajukan ulang approval tugas.',
      false
    ),
    (
      v_sop3, 5,
      'Tulis log run revisi, termasuk nomor percobaan.',
      false
    ),
    (
      v_sop3, 6,
      'Setelah revisi kedua tetap ditolak, jangan memanggil model lagi. Kembalikan objek ke reviewer bersama riwayat feedback. Naya berhenti mengubah objek itu.',
      false
    );

  -- ISO: Senin = 1, Jumat = 5, Minggu = 7. Sama dengan EXTRACT(ISODOW) pada hitungan KR1.
  INSERT INTO public.ai_employee_schedules (
    employee_id,
    organization_id,
    sop_code,
    weekday,
    start_local,
    due_local,
    window_start_weekday,
    window_end_weekday,
    is_active
  ) VALUES (
    v_employee,
    v_org,
    'SOP1',
    5,
    TIME '15:00',
    TIME '17:00',
    1,
    7,
    true
  );

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  SELECT v_employee, v_org, allowed.action_code
  FROM (
    VALUES
      ('content.plans.list'),
      ('content.calendar.list'),
      ('content.catalog.list'),
      ('thinking.ideas.list'),
      ('thinking.chain.read'),
      ('okr.cycles.list'),
      ('okr.objectives.list'),
      ('okr.departments.list'),
      ('tasks.list'),
      ('tasks.steps.list'),
      ('content.plans.create'),
      ('content.plans.update'),
      ('content.briefs.create'),
      ('thinking.plan.save'),
      ('thinking.plan.direct'),
      ('thinking.execution.check'),
      ('tasks.update'),
      ('tasks.steps.create'),
      ('tasks.steps.update'),
      ('tasks.substeps.create'),
      ('tasks.completion.request')
  ) AS allowed(action_code);

  INSERT INTO public.company_objectives (
    organization_id,
    cycle_id,
    title,
    status,
    progress_percentage,
    weight,
    start_date,
    end_date,
    owner_id,
    created_by
  ) VALUES (
    v_org,
    v_cycle,
    'konten sosial media organisasi terbit konsisten dari rencana yang disetujui',
    'active',
    0,
    1,
    v_cycle_start,
    v_cycle_end,
    v_owner_user,
    v_owner_user
  )
  RETURNING id INTO v_company;

  INSERT INTO public.department_objectives (
    organization_id,
    cycle_id,
    company_objective_id,
    department_id,
    title,
    status,
    progress_percentage,
    weight,
    start_date,
    end_date,
    owner_id,
    created_by
  ) VALUES (
    v_org,
    v_cycle,
    v_company,
    v_department,
    'setiap minggu ada rencana konten yang siap ditinjau sebelum jadwal tayang',
    'active',
    0,
    1,
    v_cycle_start,
    v_cycle_end,
    v_owner_user,
    v_owner_user
  )
  RETURNING id INTO v_department_objective;

  INSERT INTO public.individual_objectives (
    organization_id,
    cycle_id,
    department_objective_id,
    employee_id,
    title,
    status,
    progress_percentage,
    weight,
    start_date,
    end_date,
    created_by
  ) VALUES (
    v_org,
    v_cycle,
    v_department_objective,
    v_employee,
    'menyerahkan rencana konten yang tepat waktu, sebaran pillar-nya seimbang, dan lolos review manusia',
    'active',
    0,
    1,
    v_cycle_start,
    v_cycle_end,
    v_owner_user
  )
  RETURNING id INTO v_individual;

  INSERT INTO public.key_results (
    title,
    target_value,
    current_value,
    unit,
    metric_type,
    progress_percentage,
    weight,
    individual_objective_id,
    ai_kr_code
  ) VALUES
    ('KR1 Ketepatan waktu', 90, 0, '%', 'percentage', 0, 25, v_individual, 'KR1'),
    ('KR2 Diterima tanpa revisi', 50, NULL, '%', 'manual', 0, 25, v_individual, 'KR2'),
    ('KR3 Sebaran pillar', 40, NULL, 'belum dinilai', 'unrated', 0, 20, v_individual, 'KR3'),
    ('KR4 Tugas dadakan', 80, NULL, '%', 'manual', 0, 20, v_individual, 'KR4'),
    ('KR5 Rencana dipakai', 60, 0, '%', 'percentage', 0, 10, v_individual, 'KR5');
END
$seed$;

SELECT
  e.id AS employee_id,
  e.employee_id AS employee_code,
  e.full_name,
  e.is_ai,
  e.user_id,
  d.name AS department_name,
  p.job_title,
  rev.full_name AS reviewer_name,
  c.name AS cycle_name,
  (SELECT count(*) FROM public.ai_employee_sops s WHERE s.employee_id = e.id) AS sops,
  (
    SELECT count(*)
    FROM public.ai_employee_sop_steps st
    JOIN public.ai_employee_sops s ON s.id = st.sop_id
    WHERE s.employee_id = e.id
  ) AS steps,
  (SELECT count(*) FROM public.ai_employee_schedules sc WHERE sc.employee_id = e.id) AS schedules,
  (SELECT count(*) FROM public.ai_employee_permissions perm WHERE perm.employee_id = e.id) AS permissions,
  (
    SELECT count(*)
    FROM public.key_results kr
    JOIN public.individual_objectives io ON io.id = kr.individual_objective_id
    WHERE io.employee_id = e.id
  ) AS key_results
FROM public.employees e
JOIN public.organizations o ON o.id = e.organization_id
JOIN public.ai_employee_profiles p ON p.employee_id = e.id
JOIN public.departments d ON d.id = p.department_id
JOIN public.employees rev ON rev.id = p.reviewer_employee_id
JOIN public.individual_objectives io ON io.employee_id = e.id
JOIN public.okr_cycles c ON c.id = io.cycle_id
WHERE o.company_name = 'Synckerja Office'
  AND e.is_ai
  AND e.full_name = 'Naya';

COMMIT;
