-- Rekrut karyawan AI hanya untuk job desc yang sudah dibangun.
-- Saat ini hanya Content Plan. Job desc lain ditolak.
-- Karyawan AI baru selalu mendapat profil Content Planner dan jadwal Content Plan Carousel.

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
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_install_content_plan(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_install_content_plan(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_ai_employee_built_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job text;
BEGIN
  IF COALESCE(NEW.is_ai, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_ai, false) IS TRUE THEN
    RETURN NEW;
  END IF;

  v_job := nullif(btrim(coalesce(current_setting('synckerja.ai_job_code', true), '')), '');
  IF v_job IS NULL THEN
    v_job := 'content_plan';
  END IF;
  IF v_job <> 'content_plan' THEN
    RAISE EXCEPTION 'Job desc karyawan AI belum tersedia. Pilih Content Plan.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_require_built_ai_job ON public.employees;
CREATE TRIGGER employees_require_built_ai_job
  BEFORE INSERT OR UPDATE OF is_ai ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ai_employee_built_job();

CREATE OR REPLACE FUNCTION public.install_ai_employee_built_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.is_ai, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_ai, false) IS TRUE THEN
    RETURN NEW;
  END IF;
  PERFORM public.ai_employee_install_content_plan(NEW.id, NEW.organization_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_install_built_ai_job ON public.employees;
CREATE TRIGGER employees_install_built_ai_job
  AFTER INSERT OR UPDATE OF is_ai ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.install_ai_employee_built_job();

CREATE OR REPLACE FUNCTION public.hire_ai_employee(
  p_organization_id uuid,
  p_full_name text,
  p_job_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = p_organization_id
      AND lower(btrim(role.role)) IN ('owner', 'admin', 'hr')
  ) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'Isi nama karyawan AI.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_job_code, '') <> 'content_plan' THEN
    RAISE EXCEPTION 'Job desc karyawan AI belum tersedia. Pilih Content Plan.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('synckerja.ai_job_code', 'content_plan', true);

  INSERT INTO public.employees (organization_id, full_name, user_id, is_ai)
  VALUES (p_organization_id, v_name, NULL, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hire_ai_employee(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hire_ai_employee(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.hire_ai_employee(uuid, text, text) IS
  'Membuat karyawan AI hanya untuk job desc yang sudah dibangun. Saat ini hanya content_plan.';

-- Rekrut percobaan tanpa job desc Content Plan.
DELETE FROM public.employees e
WHERE e.id = 'b02c896b-60f7-43b7-8d8c-92fedb729762'
  AND e.organization_id = '5fa70166-0a35-4f0d-94b3-54f19b3f8c30'
  AND e.is_ai IS TRUE
  AND lower(btrim(e.full_name)) = 'aldi'
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_employee_profiles p WHERE p.employee_id = e.id
  );
