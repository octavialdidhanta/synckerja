-- Halaman karyawan AI. Tidak membuat tabel, policy, extension, atau cron.
-- Klien authenticated hanya lewat tiga fungsi halaman. auth.uid() adalah pengguna.
-- Organisasi diambil dari baris karyawan AI, bukan dari argumen klien.
-- Brief memakai ai_employee_brief_write. Jadwal memakai CHECK dan trigger next_run yang sudah ada.
-- Baca kuota tidak menulis baris pemakaian.

CREATE OR REPLACE FUNCTION public.ai_employee_page_gate(
  p_employee_id uuid,
  p_write boolean
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $gate$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_ai boolean;
BEGIN
  IF p_employee_id IS NULL OR v_uid IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT employee.organization_id, COALESCE(employee.is_ai, false)
  INTO v_org, v_ai
  FROM public.employees employee
  WHERE employee.id = p_employee_id;

  IF NOT FOUND OR NOT COALESCE(v_ai, false) OR v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations membership
    WHERE membership.user_id = v_uid
      AND membership.organization_id = v_org
      AND COALESCE(membership.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(p_write, false) THEN
    PERFORM public.ai_employee_require_owner(v_uid, v_org);
    RETURN v_org;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = v_uid
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN v_org;
END;
$gate$;

COMMENT ON FUNCTION public.ai_employee_page_gate(uuid, boolean) IS
  'Pintu halaman AI. Pengguna dari auth.uid(), organisasi dari karyawan AI, keanggotaan aktif. Ubah: owner. Baca: owner atau admin.';

CREATE OR REPLACE FUNCTION public.ai_employee_schedule_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_sop_code text,
  p_weekday integer,
  p_start_local time,
  p_due_local time,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $schedule$
DECLARE
  v_code text := NULLIF(btrim(COALESCE(p_sop_code, '')), '');
  v_count integer;
  v_id uuid;
  v_prev_weekday smallint;
  v_prev_start time;
  v_prev_due time;
  v_prev_active boolean;
  v_prev_next timestamptz;
  v_weekday smallint;
  v_start time;
  v_due time;
  v_active boolean;
  v_next timestamptz;
BEGIN
  PERFORM public.ai_employee_require_owner(p_user_id, p_organization_id);
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_code IS NULL
    OR p_weekday IS NULL
    OR p_start_local IS NULL
    OR p_due_local IS NULL
    OR p_is_active IS NULL
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = p_organization_id
    AND schedule.sop_code = v_code;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'schedule_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'schedule_ambiguous' USING ERRCODE = '22023';
  END IF;

  SELECT schedule.id, schedule.weekday, schedule.start_local, schedule.due_local, schedule.is_active, schedule.next_run_at
  INTO v_id, v_prev_weekday, v_prev_start, v_prev_due, v_prev_active, v_prev_next
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = p_organization_id
    AND schedule.sop_code = v_code
  FOR UPDATE;

  BEGIN
    UPDATE public.ai_employee_schedules schedule
    SET weekday = p_weekday::smallint,
        start_local = p_start_local,
        due_local = p_due_local,
        is_active = p_is_active
    WHERE schedule.id = v_id
    RETURNING schedule.weekday, schedule.start_local, schedule.due_local, schedule.is_active, schedule.next_run_at
    INTO v_weekday, v_start, v_due, v_active, v_next;
  EXCEPTION
    WHEN check_violation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'previous', jsonb_build_object(
      'sop_code', v_code,
      'weekday', v_prev_weekday,
      'start_local', to_char(v_prev_start, 'HH24:MI'),
      'due_local', to_char(v_prev_due, 'HH24:MI'),
      'is_active', v_prev_active,
      'next_run_at', v_prev_next
    ),
    'schedule', jsonb_build_object(
      'sop_code', v_code,
      'weekday', v_weekday,
      'start_local', to_char(v_start, 'HH24:MI'),
      'due_local', to_char(v_due, 'HH24:MI'),
      'is_active', v_active,
      'next_run_at', v_next
    )
  );
END;
$schedule$;

COMMENT ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean) IS
  'Mengubah satu jadwal yang sudah ada. Hari dan jam diperiksa oleh CHECK tabel. next_run_at diisi trigger yang sudah ada.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_read(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $read$
DECLARE
  v_org uuid;
  v_can_edit boolean;
  v_name text;
  v_title text;
  v_reviewer text;
  v_status text;
  v_active boolean;
  v_brief jsonb;
  v_service_ids uuid[];
  v_persona_ids uuid[];
  v_pillar_ids uuid[];
  v_product_ids uuid[];
  v_key_results jsonb;
  v_runs jsonb;
  v_jobs jsonb;
  v_schedules jsonb;
  v_services jsonb;
  v_personas jsonb;
  v_pillars jsonb;
  v_products jsonb;
  v_cap integer;
  v_used integer;
  v_remaining integer;
  v_date date;
  v_org_limit integer;
  v_org_used integer;
  v_org_date date;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) = 'owner'
  )
  INTO v_can_edit;

  SELECT employee.full_name,
         profile.job_title,
         reviewer.full_name,
         profile.performance_status,
         profile.is_active
  INTO v_name, v_title, v_reviewer, v_status, v_active
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND employee.organization_id = v_org;

  v_brief := public.ai_employee_brief_payload(p_employee_id);
  v_service_ids := public.ai_employee_brief_ids(v_brief->'service_ids');
  v_persona_ids := public.ai_employee_brief_ids(v_brief->'persona_ids');
  v_pillar_ids := public.ai_employee_brief_ids(v_brief->'pillar_ids');
  v_product_ids := public.ai_employee_brief_ids(v_brief->'product_knowledge_ids');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', kr.ai_kr_code,
    'title', kr.title,
    'current_value', kr.current_value,
    'target_value', kr.target_value,
    'unit', kr.unit,
    'progress_percentage', kr.progress_percentage
  ) ORDER BY kr.ai_kr_code, kr.title), '[]'::jsonb)
  INTO v_key_results
  FROM public.key_results kr
  JOIN public.individual_objectives objective
    ON objective.id = kr.individual_objective_id
  WHERE objective.organization_id = v_org
    AND objective.employee_id = p_employee_id
    AND kr.ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', run.id,
    'started_at', run.started_at,
    'finished_at', run.finished_at,
    'sop_code', run.sop_code,
    'status', run.status,
    'plan_count', run.plan_count,
    'note', left(COALESCE(run.note, ''), 240),
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', plan.id,
        'title', COALESCE(plan.title, '')
      ) ORDER BY plan.title)
      FROM public.social_media_plans plan
      WHERE plan.organization_id = v_org
        AND plan.id = ANY (run.object_ids)
    ), '[]'::jsonb)
  ) ORDER BY run.started_at DESC), '[]'::jsonb)
  INTO v_runs
  FROM (
    SELECT id, started_at, finished_at, sop_code, status, plan_count, note, object_ids
    FROM public.ai_employee_runs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY started_at DESC, id DESC
    LIMIT 20
  ) run;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', job.id,
    'source', job.source,
    'priority', job.priority,
    'status', job.status,
    'attempts', job.attempts,
    'reason', job.reason,
    'daily_task_id', job.daily_task_id,
    'plan_id', job.plan_id,
    'run_id', job.run_id,
    'next_attempt_at', job.next_attempt_at,
    'created_at', job.created_at,
    'claimed_at', job.claimed_at,
    'finished_at', job.finished_at
  ) ORDER BY job.created_at DESC, job.id DESC), '[]'::jsonb)
  INTO v_jobs
  FROM (
    SELECT id, source, priority, status, attempts, reason, daily_task_id, plan_id,
           run_id, next_attempt_at, created_at, claimed_at, finished_at
    FROM public.ai_employee_jobs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  ) job;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sop_code', schedule.sop_code,
    'weekday', schedule.weekday,
    'start_local', to_char(schedule.start_local, 'HH24:MI'),
    'due_local', to_char(schedule.due_local, 'HH24:MI'),
    'is_active', schedule.is_active,
    'next_run_at', schedule.next_run_at
  ) ORDER BY schedule.sop_code), '[]'::jsonb)
  INTO v_schedules
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = v_org;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_services
  FROM (
    SELECT svc.id, left(btrim(svc.name), 80) AS label
    FROM public.services svc
    WHERE svc.organization_id = v_org
      AND (
        COALESCE(svc.is_active, true)
        OR svc.id = ANY (v_service_ids)
      )
      AND (
        svc.id = ANY (v_service_ids)
        OR svc.id IN (
          SELECT picked.id
          FROM public.services picked
          WHERE picked.organization_id = v_org
            AND COALESCE(picked.is_active, true)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_personas
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Persona')), 80) AS label
    FROM public.product_knowledge knowledge
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_persona_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_pillars
  FROM (
    SELECT pillar.id, left(btrim(pillar.name), 80) AS label
    FROM public.content_pillars pillar
    WHERE (
        pillar.id = ANY (v_pillar_ids)
        OR (
          pillar.is_active
          AND (pillar.organization_id = v_org OR pillar.is_default)
        )
      )
      AND (
        pillar.id = ANY (v_pillar_ids)
        OR pillar.id IN (
          SELECT picked.id
          FROM public.content_pillars picked
          WHERE picked.is_active
            AND (picked.organization_id = v_org OR picked.is_default)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label,
    'service_id', item.service_id,
    'parent_service_id', item.parent_service_id
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Produk')), 80) AS label,
           knowledge.service_id,
           sub.service_id AS parent_service_id
    FROM public.product_knowledge knowledge
    LEFT JOIN public.sub_services sub
      ON sub.id = knowledge.sub_service_id
     AND sub.organization_id = knowledge.organization_id
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_product_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  v_date := (timezone('Asia/Jakarta', now()))::date;
  v_org_date := (timezone('UTC', now()))::date;

  SELECT CASE WHEN profile.performance_status = 'coaching' THEN 8 ELSE 15 END
  INTO v_cap
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = v_org;

  SELECT calls.call_count
  INTO v_used
  FROM public.ai_employee_model_calls calls
  WHERE calls.employee_id = p_employee_id
    AND calls.usage_date = v_date;
  v_used := COALESCE(v_used, 0);
  IF v_cap IS NULL THEN
    v_remaining := NULL;
  ELSE
    v_remaining := GREATEST(v_cap - v_used, 0);
  END IF;

  SELECT COALESCE(config.daily_limit, 50)
  INTO v_org_limit
  FROM public.organization_script_ai_config config
  WHERE config.organization_id = v_org;
  IF v_org_limit IS NULL OR v_org_limit < 1 THEN
    v_org_limit := 50;
  END IF;

  SELECT COALESCE(usage."count", 0)
  INTO v_org_used
  FROM public.script_ai_daily_usage usage
  WHERE usage.organization_id = v_org
    AND usage.usage_date = v_org_date;
  v_org_used := COALESCE(v_org_used, 0);

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'can_edit', v_can_edit,
    'summary', jsonb_build_object(
      'full_name', v_name,
      'job_title', v_title,
      'reviewer_name', v_reviewer,
      'performance_status', v_status,
      'is_active', v_active
    ),
    'key_results', v_key_results,
    'runs', v_runs,
    'jobs', v_jobs,
    'schedules', v_schedules,
    'brief', v_brief,
    'options', jsonb_build_object(
      'services', v_services,
      'personas', v_personas,
      'pillars', v_pillars,
      'products', v_products
    ),
    'quota', jsonb_build_object(
      'usage_date', v_date,
      'used', v_used,
      'cap', v_cap,
      'remaining', v_remaining,
      'org_usage_date', v_org_date,
      'org_used', v_org_used,
      'org_limit', v_org_limit,
      'org_remaining', GREATEST(v_org_limit - v_org_used, 0)
    )
  );
END;
$read$;

COMMENT ON FUNCTION public.ai_employee_page_read(uuid) IS
  'Isi halaman karyawan AI untuk owner/admin organisasi itu. Tidak menulis kuota dan tidak mengembalikan claim_token.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_brief_save(
  p_employee_id uuid,
  p_brief jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $brief$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_brief_write(auth.uid(), v_org, p_employee_id, p_brief);
END;
$brief$;

COMMENT ON FUNCTION public.ai_employee_page_brief_save(uuid, jsonb) IS
  'Owner menyimpan brief lewat ai_employee_brief_write. Aturan katalog, persona, pilar, dan produk tidak disalin ulang.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_schedule_save(
  p_employee_id uuid,
  p_sop_code text,
  p_weekday integer,
  p_start_local time,
  p_due_local time,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $pageschedule$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_schedule_write(
    auth.uid(),
    v_org,
    p_employee_id,
    p_sop_code,
    p_weekday,
    p_start_local,
    p_due_local,
    p_is_active
  );
END;
$pageschedule$;

COMMENT ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean) IS
  'Owner mengubah jadwal yang sudah ada lewat ai_employee_schedule_write.';

REVOKE ALL ON FUNCTION public.ai_employee_page_gate(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_read(uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_brief_save(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

GRANT EXECUTE ON FUNCTION public.ai_employee_page_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_brief_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean) TO authenticated;
