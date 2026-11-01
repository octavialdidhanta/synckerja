-- AI Employee fase 1: role runner dan fungsi pintu.
-- Role hanya menerima EXECUTE. Tidak ada SELECT tabel dan tidak BYPASSRLS.
-- service_role tidak menerima EXECUTE. Cadangan itu diputuskan di step 6.

-- CREATE ROLE boleh di dalam transaksi. Dokumentasi Postgres hanya melarang
-- perintah yang disebut eksplisit, misalnya CREATE DATABASE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_employee_runner') THEN
    CREATE ROLE ai_employee_runner NOLOGIN NOINHERIT;
  END IF;
END $$;

ALTER ROLE ai_employee_runner NOBYPASSRLS;
GRANT ai_employee_runner TO authenticator;
GRANT USAGE ON SCHEMA public TO ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_require_run(
  p_employee_id uuid,
  p_run_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_owner uuid;
  v_status text;
  v_is_ai boolean;
  v_active boolean;
  v_performance text;
BEGIN
  SELECT r.organization_id, r.employee_id, r.status, e.is_ai, p.is_active, p.performance_status
  INTO v_org, v_owner, v_status, v_is_ai, v_active, v_performance
  FROM public.ai_employee_runs r
  JOIN public.employees e
    ON e.id = r.employee_id
   AND e.organization_id IS NOT DISTINCT FROM r.organization_id
  LEFT JOIN public.ai_employee_profiles p ON p.employee_id = e.id
  WHERE r.id = p_run_id
  FOR UPDATE OF r;

  IF NOT FOUND OR v_owner IS DISTINCT FROM p_employee_id OR v_status IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_is_ai, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_ai_employee' USING ERRCODE = '42501';
  END IF;

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_assert_task(
  p_employee_id uuid,
  p_org uuid,
  p_task_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_tasks t
    WHERE t.id = p_task_id
      AND t.organization_id = p_org
      AND (
        t.requested_ai_employee_id = p_employee_id
        OR EXISTS (
          SELECT 1
          FROM public.daily_tasks_assigned a
          WHERE a.daily_task_id = t.id
            AND a.employee_id = p_employee_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_notify_reviewer(
  p_employee_id uuid,
  p_event_type text,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  SELECT p.organization_id, reviewer.user_id
  INTO v_org, v_user
  FROM public.ai_employee_profiles p
  LEFT JOIN public.employees reviewer ON reviewer.id = p.reviewer_employee_id
  WHERE p.employee_id = p_employee_id;

  IF v_org IS NULL OR v_user IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.daily_task_notifications (
    user_id, organization_id, title, body, daily_task_id, created_at
  ) VALUES (
    v_user, v_org, p_title, p_body, NULL, now()
  );

  INSERT INTO public.daily_task_completion_push_queue (
    organization_id, recipient_user_id, event_type, entity_type,
    daily_task_id, title, url
  ) VALUES (
    v_org, v_user, p_event_type, 'ai_run',
    NULL, p_title, '/tools/daily-task?view=jobdesc'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_run_start(
  p_employee_id uuid,
  p_sop_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_is_ai boolean;
  v_active boolean;
  v_performance text;
  v_run uuid;
BEGIN
  SELECT e.organization_id, e.is_ai, p.is_active, p.performance_status
  INTO v_org, v_is_ai, v_active, v_performance
  FROM public.employees e
  LEFT JOIN public.ai_employee_profiles p
    ON p.employee_id = e.id
   AND p.organization_id IS NOT DISTINCT FROM e.organization_id
  WHERE e.id = p_employee_id
  FOR UPDATE OF e;

  IF NOT FOUND OR v_org IS NULL OR COALESCE(v_is_ai, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_ai_employee' USING ERRCODE = '42501';
  END IF;

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status)
  VALUES (p_employee_id, v_org, NULLIF(btrim(COALESCE(p_sop_code, '')), ''), 'running')
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_run_finish(
  p_employee_id uuid,
  p_run_id uuid,
  p_status text,
  p_model_calls integer,
  p_plan_count integer,
  p_object_ids uuid[],
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_event text;
  v_title text;
  v_body text;
BEGIN
  IF p_status NOT IN ('succeeded', 'deferred', 'late', 'failed', 'returned') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);

  UPDATE public.ai_employee_runs
  SET status = p_status,
      finished_at = now(),
      model_calls = COALESCE(p_model_calls, model_calls),
      plan_count = COALESCE(p_plan_count, plan_count),
      object_ids = COALESCE(p_object_ids, object_ids),
      note = COALESCE(p_note, note)
  WHERE id = p_run_id
    AND employee_id = p_employee_id
    AND organization_id = v_org
    AND status = 'running';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = '42501';
  END IF;

  IF p_status = 'succeeded' THEN
    RETURN;
  END IF;

  v_event := CASE p_status
    WHEN 'failed' THEN 'run_failed'
    WHEN 'late' THEN 'run_late'
    WHEN 'deferred' THEN 'run_deferred'
    ELSE 'revision_returned'
  END;

  v_title := CASE p_status
    WHEN 'failed' THEN 'Rencana karyawan AI gagal'
    WHEN 'late' THEN 'Rencana karyawan AI melewati batas'
    WHEN 'deferred' THEN 'Rencana karyawan AI tertunda karena kuota'
    ELSE 'Revisi dikembalikan ke reviewer'
  END;

  v_body := v_title;
  PERFORM public.ai_employee_notify_reviewer(p_employee_id, v_event, v_title, v_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_reserve_model_call(
  p_employee_id uuid,
  p_run_id uuid,
  p_commit boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_jakarta date;
  v_utc date;
  v_cap integer;
  v_used integer;
  v_org_limit integer;
  v_org_used integer;
  v_allowed boolean;
BEGIN
  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);
  v_jakarta := (timezone('Asia/Jakarta', now()))::date;
  v_utc := (timezone('UTC', now()))::date;

  SELECT CASE WHEN performance_status = 'coaching' THEN 8 ELSE 15 END
  INTO v_cap
  FROM public.ai_employee_profiles
  WHERE employee_id = p_employee_id;

  INSERT INTO public.ai_employee_model_calls (employee_id, usage_date, call_count)
  VALUES (p_employee_id, v_jakarta, 0)
  ON CONFLICT (employee_id, usage_date) DO NOTHING;

  SELECT call_count INTO v_used
  FROM public.ai_employee_model_calls
  WHERE employee_id = p_employee_id
    AND usage_date = v_jakarta
  FOR UPDATE;

  SELECT COALESCE(daily_limit, 50)
  INTO v_org_limit
  FROM public.organization_script_ai_config
  WHERE organization_id = v_org;

  IF v_org_limit IS NULL OR v_org_limit < 1 THEN
    v_org_limit := 50;
  END IF;

  SELECT COALESCE(count, 0)
  INTO v_org_used
  FROM public.script_ai_daily_usage
  WHERE organization_id = v_org
    AND usage_date = v_utc;

  v_org_used := COALESCE(v_org_used, 0);
  v_allowed := v_used < v_cap AND v_org_used < v_org_limit;

  IF COALESCE(p_commit, false) AND NOT v_allowed THEN
    RAISE EXCEPTION 'quota_exceeded' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_commit, false) AND v_allowed THEN
    UPDATE public.ai_employee_model_calls
    SET call_count = call_count + 1,
        updated_at = now()
    WHERE employee_id = p_employee_id
      AND usage_date = v_jakarta;
    v_used := v_used + 1;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'used', v_used,
    'cap', v_cap,
    'usage_date', v_jakarta,
    'org_used', v_org_used,
    'org_limit', v_org_limit,
    'org_usage_date', v_utc
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_context(
  p_employee_id uuid,
  p_run_id uuid,
  p_scope text,
  p_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_from date;
  v_to date;
  v_rows jsonb;
BEGIN
  IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks') THEN
    RAISE EXCEPTION 'scope_forbidden' USING ERRCODE = '42501';
  END IF;

  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);
  v_from := COALESCE((NULLIF(p_params->>'from', ''))::date, (timezone('Asia/Jakarta', now()))::date);
  v_to := COALESCE((NULLIF(p_params->>'to', ''))::date, v_from + 7);

  IF p_scope IN ('plans', 'calendar') THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT p.id, p.title, p.brief, p.post_date, p.production_status,
             p.content_pillar_id, p.approved, p.production_approved
      FROM public.social_media_plans p
      WHERE p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
        AND (
          p_scope = 'plans'
          OR (timezone('Asia/Jakarta', p.post_date))::date BETWEEN v_from AND v_to
        )
      ORDER BY p.post_date DESC NULLS LAST
      LIMIT 100
    ) x;
  ELSIF p_scope = 'catalog' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT s.id, s.name
      FROM public.services s
      WHERE s.organization_id = v_org
        AND s.is_active
      ORDER BY s.name
      LIMIT 100
    ) x;
  ELSIF p_scope = 'pillars' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT c.id, c.name
      FROM public.content_pillars c
      WHERE c.is_active
        AND (c.organization_id = v_org OR c.is_default)
      ORDER BY c.name
      LIMIT 100
    ) x;
  ELSIF p_scope = 'thinking' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.statement
      FROM public.thinking_master_thoughts t
      WHERE t.organization_id = v_org
        AND t.status = 'locked'
      ORDER BY t.updated_at DESC
      LIMIT 100
    ) x;
  ELSIF p_scope = 'feedback' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT f.id, f.object_type, f.object_id, f.reason, f.expires_at
      FROM public.ai_employee_feedback f
      WHERE f.employee_id = p_employee_id
        AND f.organization_id = v_org
        AND f.dismissed_at IS NULL
        AND f.expires_at > now()
      ORDER BY f.created_at DESC
      LIMIT 10
    ) x;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT t.id, t.title, t.status, t.due_date, t.priority, t.ai_revision_count,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'title', s.title,
              'order', s."order",
              'is_completed', s.is_completed
            )
            ORDER BY s."order"
          )
          FROM public.task_steps s
          WHERE s.task_id = t.id
        ), '[]'::jsonb) AS steps
      FROM public.daily_tasks t
      WHERE t.organization_id = v_org
        AND (
          t.requested_ai_employee_id = p_employee_id
          OR EXISTS (
            SELECT 1 FROM public.daily_tasks_assigned a
            WHERE a.daily_task_id = t.id
              AND a.employee_id = p_employee_id
          )
        )
      ORDER BY t.created_at DESC
      LIMIT 100
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'scope', p_scope,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_refresh_krs(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_closed integer;
  v_on_time integer;
  v_kr1 numeric;
  v_plan_count integer;
  v_pillar_count integer;
  v_missing_pillar integer;
  v_max_share numeric;
  v_kr3 numeric;
  v_kr3_metric text;
  v_kr3_unit text;
  v_approved integer;
  v_scheduled integer;
  v_kr5 numeric;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.employees
  WHERE id = p_employee_id
    AND COALESCE(is_ai, false);

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_ai_employee' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.key_results kr
    JOIN public.individual_objectives io ON io.id = kr.individual_objective_id
    WHERE io.employee_id = p_employee_id
      AND io.organization_id = v_org
      AND kr.ai_kr_code IN ('KR1', 'KR3', 'KR5')
  ) THEN
    RETURN;
  END IF;

  -- Penyebut sementara: run SOP1 yang sudah ditutup. Penyebut yang benar adalah
  -- minggu yang dijadwalkan. Itu diperbaiki di step 5 saat instance jadwal ada.
  SELECT
    COUNT(*) FILTER (
      WHERE status IN ('succeeded', 'late', 'failed', 'deferred', 'returned')
    ),
    COUNT(*) FILTER (
      WHERE status = 'succeeded'
        AND finished_at IS NOT NULL
        AND EXTRACT(ISODOW FROM timezone('Asia/Jakarta', started_at)) = 5
        AND timezone('Asia/Jakarta', finished_at)
            <= date_trunc('day', timezone('Asia/Jakarta', started_at)) + interval '17 hours'
    )
  INTO v_closed, v_on_time
  FROM public.ai_employee_runs
  WHERE employee_id = p_employee_id
    AND organization_id = v_org
    AND sop_code = 'SOP1';

  v_kr1 := CASE
    WHEN COALESCE(v_closed, 0) = 0 THEN 0
    ELSE ROUND((100.0 * v_on_time / v_closed)::numeric, 2)
  END;

  UPDATE public.key_results kr
  SET current_value = v_on_time,
      progress_percentage = v_kr1,
      metric_type = 'percentage',
      unit = '%',
      updated_at = now()
  FROM public.individual_objectives io
  WHERE kr.individual_objective_id = io.id
    AND io.employee_id = p_employee_id
    AND io.organization_id = v_org
    AND kr.ai_kr_code = 'KR1';

  SELECT COUNT(*)
  INTO v_plan_count
  FROM public.social_media_plans p
  WHERE p.organization_id = v_org
    AND p.author_employee_id = p_employee_id
    AND p.post_date >= now() - interval '28 days';

  SELECT COUNT(*)
  INTO v_pillar_count
  FROM public.content_pillars c
  WHERE c.is_active
    AND (c.organization_id = v_org OR c.is_default);

  IF v_plan_count < 5 OR v_pillar_count < 3 THEN
    v_kr3 := 0;
    v_kr3_metric := 'unrated';
    v_kr3_unit := 'belum dinilai';
  ELSE
    SELECT COUNT(*) FILTER (WHERE content_pillar_id IS NULL)
    INTO v_missing_pillar
    FROM public.social_media_plans p
    WHERE p.organization_id = v_org
      AND p.author_employee_id = p_employee_id
      AND p.post_date >= now() - interval '28 days';

    SELECT MAX(cnt)::numeric / NULLIF(v_plan_count, 0)
    INTO v_max_share
    FROM (
      SELECT COUNT(*) AS cnt
      FROM public.social_media_plans p
      WHERE p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
        AND p.post_date >= now() - interval '28 days'
      GROUP BY p.content_pillar_id
    ) shares;

    IF COALESCE(v_missing_pillar, 0) > 0 OR COALESCE(v_max_share, 0) = 0 THEN
      v_kr3 := 0;
    ELSE
      v_kr3 := LEAST(100, ROUND((100.0 * 0.40 / v_max_share)::numeric, 2));
    END IF;
    v_kr3_metric := 'percentage';
    v_kr3_unit := '%';
  END IF;

  UPDATE public.key_results kr
  SET current_value = CASE WHEN v_kr3_metric = 'unrated' THEN NULL ELSE v_kr3 END,
      progress_percentage = v_kr3,
      metric_type = v_kr3_metric,
      unit = v_kr3_unit,
      updated_at = now()
  FROM public.individual_objectives io
  WHERE kr.individual_objective_id = io.id
    AND io.employee_id = p_employee_id
    AND io.organization_id = v_org
    AND kr.ai_kr_code = 'KR3';

  SELECT COUNT(*)
  INTO v_approved
  FROM public.social_media_plans p
  WHERE p.organization_id = v_org
    AND p.author_employee_id = p_employee_id
    AND p.production_approved;

  SELECT COUNT(*)
  INTO v_scheduled
  FROM public.social_media_plans p
  WHERE p.organization_id = v_org
    AND p.author_employee_id = p_employee_id
    AND p.production_approved
    AND p.production_approved_date IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.social_media_scheduled_posts sp
      WHERE sp.social_media_plan_id = p.id
        AND sp.scheduled_at BETWEEN p.production_approved_date - interval '7 days'
                                AND p.production_approved_date + interval '7 days'
    );

  v_kr5 := CASE
    WHEN COALESCE(v_approved, 0) = 0 THEN 0
    ELSE ROUND((100.0 * v_scheduled / v_approved)::numeric, 2)
  END;

  UPDATE public.key_results kr
  SET current_value = v_scheduled,
      progress_percentage = v_kr5,
      metric_type = 'percentage',
      unit = '%',
      updated_at = now()
  FROM public.individual_objectives io
  WHERE kr.individual_objective_id = io.id
    AND io.employee_id = p_employee_id
    AND io.organization_id = v_org
    AND kr.ai_kr_code = 'KR5';

  UPDATE public.individual_objectives io
  SET progress_percentage = scored.score,
      updated_at = now()
  FROM (
    SELECT io2.id,
      COALESCE(
        ROUND(
          (
            SUM(COALESCE(kr.weight, 0) * COALESCE(kr.progress_percentage, 0))
            / NULLIF(SUM(COALESCE(kr.weight, 0)), 0)
          )::numeric,
          2
        ),
        0
      ) AS score
    FROM public.individual_objectives io2
    JOIN public.key_results kr ON kr.individual_objective_id = io2.id
    WHERE io2.employee_id = p_employee_id
      AND io2.organization_id = v_org
      AND COALESCE(kr.metric_type, '') NOT IN ('manual', 'unrated')
    GROUP BY io2.id
  ) scored
  WHERE io.id = scored.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_perform(
  p_employee_id uuid,
  p_run_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_payload_org uuid;
  v_id uuid;
  v_task uuid;
  v_parent uuid;
  v_assigner uuid;
  v_title text;
  v_brief text;
  v_pillar uuid;
  v_post timestamptz;
  v_order integer;
  v_entity text;
  v_brief_token text;
BEGIN
  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);

  IF p_action = ANY (ARRAY[
    'content.plans.schedule',
    'tasks.delete',
    'tasks.steps.delete',
    'tasks.substeps.delete',
    'session.switchOrg'
  ]) OR p_action LIKE 'finance.%'
    OR p_action LIKE 'payroll.%'
    OR p_action LIKE 'hr.%'
    OR p_action LIKE 'crm.%'
    OR p_action LIKE 'ads.%'
  THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT (p_action = ANY (ARRAY[
    'content.plans.create',
    'content.plans.update',
    'content.briefs.create',
    'thinking.plan.save',
    'thinking.plan.direct',
    'thinking.execution.check',
    'tasks.update',
    'tasks.steps.create',
    'tasks.steps.update',
    'tasks.substeps.create',
    'tasks.completion.request'
  ])) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_permissions perm
    WHERE perm.employee_id = p_employee_id
      AND perm.action_code = p_action
  ) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_payload->>'approved', '') IN ('true', 't', '1')
    OR COALESCE(v_payload->>'production_approved', '') IN ('true', 't', '1')
    OR lower(btrim(COALESCE(v_payload->>'production_status', ''))) = 'approved'
    OR (
      p_action = 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', 'pending'))) <> 'pending'
    )
    OR (
      p_action LIKE 'tasks.%'
      AND p_action <> 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', ''))) IN ('completed', 'cancelled', 'approved')
    )
  THEN
    RAISE EXCEPTION 'approval_forbidden' USING ERRCODE = '42501';
  END IF;

  IF jsonb_exists(v_payload, 'organization_id') THEN
    BEGIN
      v_payload_org := NULLIF(v_payload->>'organization_id', '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END;
    IF v_payload_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'thinking.execution.check' THEN
    RETURN jsonb_build_object('ok', true, 'accepted', true, 'model_call', true);
  END IF;

  IF p_action IN ('content.plans.create', 'thinking.plan.save', 'thinking.plan.direct') THEN
    v_title := NULLIF(btrim(COALESCE(v_payload->>'title', '')), '');
    v_brief := NULLIF(v_payload->>'brief', '');
    IF v_title IS NULL OR char_length(v_title) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF v_brief IS NOT NULL AND char_length(v_brief) > 200000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(v_payload->>'post_date', '') IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';

    IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL
      OR p_action LIKE 'thinking.%'
    THEN
      v_pillar := NULLIF(v_payload->>'content_pillar_id', '')::uuid;
      IF v_pillar IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.content_pillars c
        WHERE c.id = v_pillar
          AND c.is_active
          AND (c.organization_id = v_org OR c.is_default)
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id,
      author_employee_id, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar,
      p_employee_id, 'Need Review', false, false, 'draft'
    )
    RETURNING id INTO v_id;

    UPDATE public.ai_employee_runs
    SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END,
        plan_count = plan_count + 1
    WHERE id = p_run_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action IN ('content.plans.update', 'content.briefs.create') THEN
    v_id := NULLIF(v_payload->>'plan_id', '')::uuid;
    IF v_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.social_media_plans p
      WHERE p.id = v_id
        AND p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'content.briefs.create' THEN
      v_brief := NULLIF(v_payload->>'brief', '');
      IF v_brief IS NULL THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET brief = v_brief,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    ELSE
      IF jsonb_exists(v_payload, 'title') THEN
        v_title := NULLIF(btrim(v_payload->>'title'), '');
        IF v_title IS NULL OR char_length(v_title) > 200 THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NULLIF(v_payload->>'post_date', '') IS NOT NULL THEN
        v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';
      END IF;
      IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL THEN
        v_pillar := (v_payload->>'content_pillar_id')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.content_pillars c
          WHERE c.id = v_pillar
            AND c.is_active
            AND (c.organization_id = v_org OR c.is_default)
        ) THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET title = COALESCE(v_title, title),
          brief = CASE WHEN jsonb_exists(v_payload, 'brief') THEN v_payload->>'brief' ELSE brief END,
          post_date = COALESCE(v_post, post_date),
          content_pillar_id = COALESCE(v_pillar, content_pillar_id),
          author_employee_id = p_employee_id,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.update' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.daily_tasks
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        priority = COALESCE(NULLIF(v_payload->>'priority', ''), priority),
        due_date = CASE
          WHEN NULLIF(v_payload->>'due_date', '') IS NULL THEN due_date
          ELSE (v_payload->>'due_date')::timestamptz
        END,
        updated_at = now()
    WHERE id = v_task
      AND organization_id = v_org;
    RETURN jsonb_build_object('ok', true, 'id', v_task);
  END IF;

  IF p_action = 'tasks.steps.create' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_title := COALESCE(NULLIF(v_payload->>'title', ''), '');
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps (task_id, title, description, "order")
    VALUES (v_task, v_title, v_payload->>'description', v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_steps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.steps.update' THEN
    v_id := NULLIF(v_payload->>'step_id', '')::uuid;
    SELECT task_id INTO v_task FROM public.task_steps WHERE id = v_id;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.task_steps
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        "order" = COALESCE((NULLIF(v_payload->>'order', ''))::integer, "order"),
        is_completed = CASE
          WHEN jsonb_exists(v_payload, 'is_completed') THEN (v_payload->>'is_completed')::boolean
          ELSE is_completed
        END,
        updated_at = now()
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.substeps.create' THEN
    v_parent := NULLIF(v_payload->>'parent_step_id', '')::uuid;
    SELECT s.task_id INTO v_task
    FROM public.task_steps s
    JOIN public.daily_tasks t ON t.id = s.task_id
    WHERE s.id = v_parent
      AND t.organization_id = v_org;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps_to_steps (parent_step_id, organization_id, title, "order")
    VALUES (v_parent, v_org, COALESCE(NULLIF(v_payload->>'title', ''), ''), v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_substeps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  v_entity := COALESCE(NULLIF(v_payload->>'entity_type', ''), 'task');
  IF v_entity NOT IN ('task', 'step', 'substep') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_task := NULLIF(v_payload->>'task_id', '')::uuid;
  IF v_entity = 'step' THEN
    SELECT task_id INTO v_task
    FROM public.task_steps
    WHERE id = NULLIF(v_payload->>'step_id', '')::uuid;
  ELSIF v_entity = 'substep' THEN
    SELECT s.task_id INTO v_task
    FROM public.task_steps_to_steps sub
    JOIN public.task_steps s ON s.id = sub.parent_step_id
    WHERE sub.id = NULLIF(v_payload->>'substep_id', '')::uuid;
  END IF;

  PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);

  SELECT a.assigned_by INTO v_assigner
  FROM public.daily_tasks_assigned a
  WHERE a.daily_task_id = v_task
  ORDER BY a.assigned_at DESC
  LIMIT 1;

  IF v_assigner IS NULL THEN
    RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.completion_approvals (
    organization_id, entity_type, daily_task_id, task_step_id, task_steps_to_steps_id,
    assignee_employee_id, assigner_employee_id, status
  ) VALUES (
    v_org,
    v_entity,
    v_task,
    NULLIF(v_payload->>'step_id', '')::uuid,
    NULLIF(v_payload->>'substep_id', '')::uuid,
    p_employee_id,
    v_assigner,
    'pending'
  )
  RETURNING id INTO v_id;

  UPDATE public.ai_employee_runs
  SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END
  WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_require_run(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_assert_task(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_notify_reviewer(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.ai_employee_run_start(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_run_finish(uuid, uuid, text, integer, integer, uuid[], text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_reserve_model_call(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_refresh_krs(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.ai_employee_run_start(uuid, text) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_run_finish(uuid, uuid, text, integer, integer, uuid[], text) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_reserve_model_call(uuid, uuid, boolean) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_context(uuid, uuid, text, jsonb) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_refresh_krs(uuid) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) TO ai_employee_runner;

REVOKE ALL ON FUNCTION public.ai_employee_set_performance_status(uuid, text) FROM ai_employee_runner;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ai_employee_runner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_employee_runner;
