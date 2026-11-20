-- Rekrut Content Plan harus menyalin izin kerja, bukan hanya profil, SOP, dan jadwal.
-- Karyawan yang sudah direkrut sebelum izin ini ada ikut diisi. Izin yang sudah ada tidak ditimpa.

CREATE OR REPLACE FUNCTION public.ai_employee_install_content_plan(
  p_employee_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sop uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.organization_id = p_organization_id
      AND COALESCE(e.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'karyawan AI tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ai_employee_profiles (
    employee_id,
    organization_id,
    job_title,
    time_zone,
    is_active,
    performance_status
  ) VALUES (
    p_employee_id,
    p_organization_id,
    'Content Planner',
    'Asia/Jakarta',
    true,
    'on_track'
  )
  ON CONFLICT (employee_id) DO NOTHING;

  INSERT INTO public.ai_employee_sops (
    employee_id, organization_id, code, version, is_current, title
  )
  SELECT p_employee_id, p_organization_id, 'SOP1', 1, true, 'Content Plan Carousel'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_sops s
    WHERE s.employee_id = p_employee_id
      AND s.code = 'SOP1'
      AND s.is_current
  );

  SELECT s.id
  INTO v_sop
  FROM public.ai_employee_sops s
  WHERE s.employee_id = p_employee_id
    AND s.code = 'SOP1'
    AND s.is_current
  LIMIT 1;

  IF v_sop IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ai_employee_sop_steps step WHERE step.sop_id = v_sop
  ) THEN
    INSERT INTO public.ai_employee_sop_steps (sop_id, step_no, instruction, may_call_model)
    VALUES
      (
        v_sop, 1,
        'Tanpa model, baca kalender, plan yang sudah ada, katalog aktif, content pillar organisasi, rantai Thinking Lab yang sudah dikonfirmasi manusia, dan sebaran pillar karyawan ini.',
        false
      ),
      (
        v_sop, 2,
        'Tanpa model, hitung hari yang belum punya plan dan pangsa tiap pillar. Hasil hitungan masuk log run.',
        false
      ),
      (
        v_sop, 3,
        'Bila jendela sudah penuh dan tidak ada pillar yang melewati 40%, berhenti. Log run berstatus selesai tanpa memanggil model.',
        false
      ),
      (
        v_sop, 4,
        'Bila ada celah, pilih pillar yang penambahannya tidak membuat pangsa melewati 40%. Panggil model di dalam batas harian. Konteks prompt: SOP ini, pillar yang dipilih, katalog, rantai Thinking Lab, dan catatan penolakan yang masih berlaku.',
        true
      ),
      (
        v_sop, 5,
        'Simpan draf plan. Satu plan punya judul, tanggal, brief, dan content pillar. Jumlah plan mengikuti jadwal harian.',
        false
      ),
      (
        v_sop, 6,
        'Untuk plan yang lahir dari Thinking Lab, jalankan pemeriksaan eksekusi. Yang gagal tidak diserahkan. Perbaiki sekali, lalu cek ulang.',
        true
      ),
      (
        v_sop, 7,
        'Set status produksi need review. Jangan set approved atau jadwal tayang.',
        false
      ),
      (
        v_sop, 8,
        'Tulis log run: waktu mulai, waktu selesai, jumlah plan baru, jumlah panggilan model, dan daftar id plan.',
        false
      );
  END IF;

  INSERT INTO public.ai_employee_schedules (
    employee_id,
    organization_id,
    sop_code,
    weekday,
    start_local,
    due_local,
    is_active,
    cadence,
    weekdays,
    plan_count,
    start_times
  )
  SELECT
    p_employee_id,
    p_organization_id,
    'SOP1',
    NULL,
    TIME '09:00',
    TIME '09:00',
    false,
    'days',
    ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[],
    1,
    ARRAY[TIME '09:00']
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_schedules s
    WHERE s.employee_id = p_employee_id
      AND s.organization_id = p_organization_id
      AND s.sop_code = 'SOP1'
      AND s.cadence = 'days'
  );

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  SELECT p_employee_id, p_organization_id, allowed.action_code
  FROM (
    VALUES
      ('content.plans.list'),
      ('product.knowledge.list'),
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
  ) AS allowed(action_code)
  ON CONFLICT (employee_id, action_code) DO NOTHING;
END;
$$;

INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
SELECT employee.id, employee.organization_id, allowed.action_code
FROM public.employees employee
JOIN public.ai_employee_profiles profile
  ON profile.employee_id = employee.id
 AND profile.organization_id = employee.organization_id
 AND profile.job_title = 'Content Planner'
CROSS JOIN (
  VALUES
    ('content.plans.list'),
    ('product.knowledge.list'),
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
) AS allowed(action_code)
WHERE COALESCE(employee.is_ai, false)
ON CONFLICT (employee_id, action_code) DO NOTHING;
