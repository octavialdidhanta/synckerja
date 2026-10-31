-- Step reads and limited writes, plus the signed-in member's habit checklist.
-- Does not mark work complete, and does not return free-text habit notes.

CREATE OR REPLACE FUNCTION public.mcp_habit_on_day(
  p_frequency text,
  p_weekly jsonb,
  p_monthly jsonb,
  p_active boolean,
  p_day date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_weekly jsonb;
  v_monthly jsonb;
BEGIN
  IF COALESCE(p_active, false) = false OR p_day IS NULL THEN
    RETURN false;
  END IF;

  v_weekly := CASE WHEN p_weekly IS NULL OR jsonb_typeof(p_weekly) IS DISTINCT FROM 'array' THEN '[]'::jsonb ELSE p_weekly END;
  v_monthly := CASE WHEN p_monthly IS NULL OR jsonb_typeof(p_monthly) IS DISTINCT FROM 'array' THEN '[]'::jsonb ELSE p_monthly END;

  IF lower(COALESCE(p_frequency, 'daily')) = 'weekly' THEN
    IF jsonb_array_length(v_weekly) = 0 THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_weekly) elem
      WHERE (elem #>> '{}') ~ '^[0-9]+$'
        AND (elem #>> '{}')::int = EXTRACT(DOW FROM p_day)::int
    );
  END IF;

  IF lower(COALESCE(p_frequency, 'daily')) = 'monthly' THEN
    IF jsonb_array_length(v_monthly) = 0 THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_monthly) elem
      WHERE (elem #>> '{}') ~ '^[0-9]+$'
        AND (elem #>> '{}')::int = EXTRACT(DAY FROM p_day)::int
    );
  END IF;

  RETURN true;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_habit_flags(
  p_habit_id uuid,
  p_employee_id uuid,
  p_organization_id uuid,
  p_day date,
  p_target integer
)
RETURNS boolean[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_target integer;
  v_flags boolean[];
  v_has_indexed boolean := false;
  v_legacy integer := 0;
  v_notes text;
  v_idx integer;
  v_slot integer;
BEGIN
  v_target := GREATEST(COALESCE(p_target, 1), 1);
  v_flags := array_fill(false, ARRAY[v_target]);

  IF v_target = 1 THEN
    IF EXISTS (
      SELECT 1
      FROM public.habit_entries entry
      WHERE entry.habit_id = p_habit_id
        AND entry.employee_id = p_employee_id
        AND entry.organization_id = p_organization_id
        AND entry.entry_date = p_day
    ) THEN
      v_flags[1] := true;
    END IF;
    RETURN v_flags;
  END IF;

  FOR v_notes IN
    SELECT entry.notes
    FROM public.habit_entries entry
    WHERE entry.habit_id = p_habit_id
      AND entry.employee_id = p_employee_id
      AND entry.organization_id = p_organization_id
      AND entry.entry_date = p_day
  LOOP
    IF v_notes ~ '^checklist_index:[0-9]+$' THEN
      v_has_indexed := true;
      v_idx := substring(v_notes FROM '^checklist_index:([0-9]+)$')::integer;
      IF v_idx >= 0 AND v_idx < v_target THEN
        v_flags[v_idx + 1] := true;
      END IF;
    ELSE
      v_legacy := v_legacy + 1;
    END IF;
  END LOOP;

  IF NOT v_has_indexed THEN
    FOR v_slot IN 0..LEAST(v_legacy, v_target) - 1 LOOP
      v_flags[v_slot + 1] := true;
    END LOOP;
  END IF;

  RETURN v_flags;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_list_task_steps(
  p_user_id uuid,
  p_organization_id uuid,
  p_task_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  step_order integer,
  is_completed boolean,
  assignee_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_task_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_tasks task
    WHERE task.id = p_task_id
      AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    step.id,
    step.title,
    step."order",
    step.is_completed,
    assignee.full_name
  FROM public.task_steps step
  LEFT JOIN LATERAL (
    SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name
    FROM public.task_steps_assigned assigned
    JOIN public.employees emp ON emp.id = assigned.employee_id
    LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
    WHERE assigned.task_step_id = step.id
    ORDER BY assigned.assigned_at DESC
    LIMIT 1
  ) assignee ON true
  WHERE step.task_id = p_task_id
  ORDER BY step."order" ASC, step.created_at ASC, step.id ASC
  LIMIT 50;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_task_step(
  p_user_id uuid,
  p_organization_id uuid,
  p_task_id uuid,
  p_title text,
  p_description text
)
RETURNS TABLE (
  id uuid,
  title text,
  step_order integer,
  is_completed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_title text;
  v_description text;
  v_order integer;
  v_id uuid;
  v_done boolean;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_task_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_title := btrim(COALESCE(p_title, ''));
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    v_description := NULL;
  ELSIF char_length(btrim(p_description)) > 2000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  ELSE
    v_description := btrim(p_description);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_tasks task
    WHERE task.id = p_task_id
      AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(step."order"), 0) + 1 INTO v_order
  FROM public.task_steps step
  WHERE step.task_id = p_task_id;

  INSERT INTO public.task_steps (task_id, title, description, is_completed, "order", created_by)
  VALUES (p_task_id, v_title, v_description, false, v_order, p_user_id)
  RETURNING task_steps.id, task_steps.title, task_steps."order", task_steps.is_completed
  INTO v_id, v_title, v_order, v_done;

  UPDATE public.daily_tasks task
  SET
    has_steps = true,
    status = CASE WHEN lower(task.status) = 'completed' THEN 'pending' ELSE task.status END,
    updated_at = now()
  WHERE task.id = p_task_id
    AND task.organization_id = p_organization_id;

  id := v_id;
  title := v_title;
  step_order := v_order;
  is_completed := v_done;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_update_task_step(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_title text
)
RETURNS TABLE (
  id uuid,
  title text,
  step_order integer,
  is_completed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_title text;
  v_id uuid;
  v_order integer;
  v_done boolean;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_title := btrim(COALESCE(p_title, ''));
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.task_steps step
  SET title = v_title, updated_at = now()
  FROM public.daily_tasks task
  WHERE step.id = p_id
    AND step.task_id = task.id
    AND task.organization_id = p_organization_id
  RETURNING step.id, step.title, step."order", step.is_completed
  INTO v_id, v_title, v_order, v_done;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  id := v_id;
  title := v_title;
  step_order := v_order;
  is_completed := v_done;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_delete_task_step(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_task_id uuid;
  v_plan_id uuid;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT step.task_id, step.social_media_plan_id
  INTO v_task_id, v_plan_id
  FROM public.task_steps step
  JOIN public.daily_tasks task ON task.id = step.task_id
  WHERE step.id = p_id
    AND task.organization_id = p_organization_id;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_plan_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.task_steps_assigned assigned
      WHERE assigned.task_step_id = p_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_steps_to_steps sub
      JOIN public.task_steps_to_steps_assigned assigned
        ON assigned.task_steps_to_steps_id = sub.id
      WHERE sub.parent_step_id = p_id
    )
  THEN
    RAISE EXCEPTION 'not_deletable' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.task_steps step
  WHERE step.id = p_id
  RETURNING step.id INTO v_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.task_steps step WHERE step.task_id = v_task_id
  ) THEN
    UPDATE public.daily_tasks task
    SET has_steps = false, updated_at = now()
    WHERE task.id = v_task_id
      AND task.organization_id = p_organization_id;
  END IF;

  id := v_id;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_list_habits(
  p_user_id uuid,
  p_organization_id uuid,
  p_date text
)
RETURNS TABLE (
  id uuid,
  name text,
  frequency text,
  target_count integer,
  items jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_day date;
  v_habit record;
  v_names jsonb;
  v_target integer;
  v_flags boolean[];
  v_items jsonb;
  v_label text;
  v_slot integer;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_date IS NULL OR btrim(p_date) = '' THEN
    v_day := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  ELSE
    IF btrim(p_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_date)::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_day, 'YYYY-MM-DD') IS DISTINCT FROM btrim(p_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
  END IF;

  FOR v_habit IN
    SELECT
      habit.id,
      habit.name,
      habit.frequency,
      habit.target_count,
      habit.checklist_names,
      habit.weekly_days,
      habit.monthly_dates,
      habit.is_active,
      habit.created_at
    FROM public.habits habit
    WHERE habit.organization_id = p_organization_id
      AND habit.employee_id = v_self
      AND public.mcp_habit_on_day(
        habit.frequency,
        CASE WHEN habit.weekly_days IS NULL THEN NULL ELSE to_jsonb(habit.weekly_days) END,
        CASE WHEN habit.monthly_dates IS NULL THEN NULL ELSE to_jsonb(habit.monthly_dates) END,
        habit.is_active,
        v_day
      )
    ORDER BY habit.created_at DESC, habit.id ASC
    LIMIT 50
  LOOP
    v_target := GREATEST(COALESCE(v_habit.target_count, 1), 1);
    v_names := CASE
      WHEN v_habit.checklist_names IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(v_habit.checklist_names)
    END;
    IF jsonb_typeof(v_names) IS DISTINCT FROM 'array' THEN
      v_names := '[]'::jsonb;
    END IF;
    v_flags := public.mcp_habit_flags(v_habit.id, v_self, p_organization_id, v_day, v_target);
    v_items := '[]'::jsonb;
    FOR v_slot IN 0..v_target - 1 LOOP
      v_label := NULLIF(btrim(v_names ->> v_slot), '');
      IF v_label IS NULL THEN
        IF v_target = 1 THEN
          v_label := v_habit.name;
        ELSE
          v_label := (v_slot + 1)::text || ' of ' || v_target::text;
        END IF;
      END IF;
      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'index', v_slot,
          'name', v_label,
          'checked', COALESCE(v_flags[v_slot + 1], false)
        )
      );
    END LOOP;

    id := v_habit.id;
    name := v_habit.name;
    frequency := v_habit.frequency;
    target_count := v_target;
    items := v_items;
    RETURN NEXT;
  END LOOP;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_check_habit(
  p_user_id uuid,
  p_organization_id uuid,
  p_habit_id uuid,
  p_checked boolean,
  p_date text,
  p_index integer
)
RETURNS TABLE (
  id uuid,
  entry_date date,
  item_index integer,
  checked boolean,
  checked_count integer,
  target_count integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_profile uuid;
  v_day date;
  v_today date;
  v_habit record;
  v_target integer;
  v_flags boolean[];
  v_today_flags boolean[];
  v_today_count integer;
  v_legacy boolean;
  v_slot integer;
  v_checked_count integer;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_habit_id IS NULL OR p_checked IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_date IS NULL OR btrim(p_date) = '' THEN
    v_day := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  ELSE
    IF btrim(p_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_date)::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_day, 'YYYY-MM-DD') IS DISTINCT FROM btrim(p_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT
    habit.id,
    habit.frequency,
    habit.target_count,
    habit.weekly_days,
    habit.monthly_dates,
    habit.is_active
  INTO v_habit
  FROM public.habits habit
  WHERE habit.id = p_habit_id
    AND habit.organization_id = p_organization_id
    AND habit.employee_id = v_self;

  IF v_habit.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  v_target := GREATEST(COALESCE(v_habit.target_count, 1), 1);
  IF NOT public.mcp_habit_on_day(
    v_habit.frequency,
    CASE WHEN v_habit.weekly_days IS NULL THEN NULL ELSE to_jsonb(v_habit.weekly_days) END,
    CASE WHEN v_habit.monthly_dates IS NULL THEN NULL ELSE to_jsonb(v_habit.monthly_dates) END,
    v_habit.is_active,
    v_day
  ) THEN
    RAISE EXCEPTION 'not_scheduled' USING ERRCODE = '22023';
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  IF v_day > v_today AND public.mcp_habit_on_day(
    v_habit.frequency,
    CASE WHEN v_habit.weekly_days IS NULL THEN NULL ELSE to_jsonb(v_habit.weekly_days) END,
    CASE WHEN v_habit.monthly_dates IS NULL THEN NULL ELSE to_jsonb(v_habit.monthly_dates) END,
    v_habit.is_active,
    v_today
  ) THEN
    SELECT count(*) INTO v_today_count
    FROM public.habit_entries entry
    WHERE entry.habit_id = v_habit.id
      AND entry.employee_id = v_self
      AND entry.organization_id = p_organization_id
      AND entry.entry_date = v_today;
    v_today_flags := public.mcp_habit_flags(v_habit.id, v_self, p_organization_id, v_today, v_target);
    IF lower(COALESCE(v_habit.frequency, '')) IN ('weekly', 'monthly') THEN
      IF v_today_count = 0 THEN
        RAISE EXCEPTION 'not_open' USING ERRCODE = '22023';
      END IF;
    ELSIF v_target > 1 THEN
      IF v_today_count < v_target THEN
        RAISE EXCEPTION 'not_open' USING ERRCODE = '22023';
      END IF;
    ELSIF NOT COALESCE(v_today_flags[1], false) THEN
      RAISE EXCEPTION 'not_open' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_target = 1 THEN
    IF p_index IS NOT NULL AND p_index <> 0 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_slot := 0;
  ELSE
    IF p_index IS NULL OR p_index < 0 OR p_index >= v_target THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_slot := p_index;
  END IF;

  v_flags := public.mcp_habit_flags(v_habit.id, v_self, p_organization_id, v_day, v_target);
  IF COALESCE(v_flags[v_slot + 1], false) IS DISTINCT FROM p_checked THEN
    SELECT profile.id INTO v_profile
    FROM public.profiles profile
    WHERE profile.user_id = p_user_id
    LIMIT 1;

    IF v_target = 1 THEN
      IF p_checked THEN
        INSERT INTO public.habit_entries (
          habit_id, entry_date, count, notes, organization_id, employee_id, created_by
        )
        VALUES (v_habit.id, v_day, 1, NULL, p_organization_id, v_self, v_profile);
      ELSE
        DELETE FROM public.habit_entries entry
        WHERE entry.habit_id = v_habit.id
          AND entry.employee_id = v_self
          AND entry.organization_id = p_organization_id
          AND entry.entry_date = v_day;
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.habit_entries entry
        WHERE entry.habit_id = v_habit.id
          AND entry.employee_id = v_self
          AND entry.organization_id = p_organization_id
          AND entry.entry_date = v_day
          AND (entry.notes IS NULL OR entry.notes !~ '^checklist_index:[0-9]+$')
      ) INTO v_legacy;

      IF v_legacy THEN
        v_flags[v_slot + 1] := p_checked;
        DELETE FROM public.habit_entries entry
        WHERE entry.habit_id = v_habit.id
          AND entry.employee_id = v_self
          AND entry.organization_id = p_organization_id
          AND entry.entry_date = v_day;
        FOR v_slot IN 0..v_target - 1 LOOP
          IF COALESCE(v_flags[v_slot + 1], false) THEN
            INSERT INTO public.habit_entries (
              habit_id, entry_date, count, notes, organization_id, employee_id, created_by
            )
            VALUES (
              v_habit.id,
              v_day,
              1,
              'checklist_index:' || v_slot::text,
              p_organization_id,
              v_self,
              v_profile
            );
          END IF;
        END LOOP;
        v_slot := COALESCE(p_index, 0);
      ELSIF p_checked THEN
        INSERT INTO public.habit_entries (
          habit_id, entry_date, count, notes, organization_id, employee_id, created_by
        )
        VALUES (
          v_habit.id,
          v_day,
          1,
          'checklist_index:' || v_slot::text,
          p_organization_id,
          v_self,
          v_profile
        );
      ELSE
        DELETE FROM public.habit_entries entry
        WHERE entry.habit_id = v_habit.id
          AND entry.employee_id = v_self
          AND entry.organization_id = p_organization_id
          AND entry.entry_date = v_day
          AND entry.notes = 'checklist_index:' || v_slot::text;
      END IF;
    END IF;
  END IF;

  v_flags := public.mcp_habit_flags(v_habit.id, v_self, p_organization_id, v_day, v_target);
  v_checked_count := 0;
  FOR v_slot IN 1..v_target LOOP
    IF COALESCE(v_flags[v_slot], false) THEN
      v_checked_count := v_checked_count + 1;
    END IF;
  END LOOP;

  id := v_habit.id;
  entry_date := v_day;
  item_index := COALESCE(p_index, 0);
  checked := p_checked;
  checked_count := v_checked_count;
  target_count := v_target;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_habit_on_day(text, jsonb, jsonb, boolean, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_habit_on_day(text, jsonb, jsonb, boolean, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_habit_on_day(text, jsonb, jsonb, boolean, date) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_habit_flags(uuid, uuid, uuid, date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_habit_flags(uuid, uuid, uuid, date, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_habit_flags(uuid, uuid, uuid, date, integer) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_task_steps(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_task_steps(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_task_steps(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_task_step(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_task_step(uuid, uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_task_step(uuid, uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_task_step(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_task_step(uuid, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_task_step(uuid, uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_delete_task_step(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_delete_task_step(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_delete_task_step(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_habits(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_habits(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_habits(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_check_habit(uuid, uuid, uuid, boolean, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_check_habit(uuid, uuid, uuid, boolean, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_check_habit(uuid, uuid, uuid, boolean, text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
