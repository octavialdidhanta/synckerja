# AI Employee fase 1 — kutipan keamanan migration

Sumber: tujuh file `supabase/migrations/20261101150000` sampai `20261101157000`. `20261101155000` tidak ada. Tidak ada perintah yang dijalankan. Isi di bawah ini disalin dari file itu.

File `20261101153000_ai_employee_attribution.sql` dan `20261101156000_ai_employee_reviewer_notify.sql` tidak memuat `CREATE FUNCTION`, `GRANT`, `REVOKE`, `CREATE ROLE`, `ALTER ROLE`, `ENABLE ROW LEVEL SECURITY`, atau `CREATE POLICY`.

## 1. CREATE FUNCTION

Semua fungsi di tujuh file ini memakai `SECURITY DEFINER`. Tidak ada yang memakai `SECURITY INVOKER`. Semua punya `SET search_path = public`. Kutipan adalah 15 baris pertama badan, dihitung dari baris sesudah `AS $$`.

### `public.count_active_employees_for_org(org_id uuid)`

File: `20261101150000_ai_employee_marker.sql`. `SECURITY DEFINER`. `SET search_path = public`. Badan lebih pendek dari 15 baris.

```sql
  SELECT COUNT(*)::integer
  FROM public.employees e
  LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
  WHERE e.organization_id = org_id
    AND COALESCE(e.pending_removal, false) = false
    AND COALESCE(e.is_ai, false) = false
    AND lower(trim(COALESCE(es.name, 'active'))) IN ('active', 'probation');
```

### `public.ai_employee_status_guard()`

File: `20261101151000_ai_employee_profile.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
DECLARE
  v_token text;
BEGIN
  IF NEW.performance_status IS NOT DISTINCT FROM OLD.performance_status THEN
    RETURN NEW;
  END IF;

  v_token := current_setting('ai_employee.status_write', true);
  IF v_token IS NULL OR v_token = '' THEN
    RAISE EXCEPTION 'performance_status_locked'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.ai_employee_status_tickets
  WHERE employee_id = NEW.employee_id
```

### `public.ai_employee_set_performance_status(p_employee_id uuid, p_status text)`

File: `20261101151000_ai_employee_profile.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
DECLARE
  v_org uuid;
  v_token text;
BEGIN
  IF p_status NOT IN ('on_track', 'attention', 'coaching', 'disabled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id INTO v_org
  FROM public.ai_employee_profiles
  WHERE employee_id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
```

### `public.ai_employee_require_run(p_employee_id uuid, p_run_id uuid)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.ai_employee_assert_task(p_employee_id uuid, p_org uuid, p_task_id uuid)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`. Badan lebih pendek dari 15 baris.

```sql
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
```

### `public.ai_employee_notify_reviewer(p_employee_id uuid, p_event_type text, p_title text, p_body text)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.ai_employee_run_start(p_employee_id uuid, p_sop_code text)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.ai_employee_run_finish(p_employee_id uuid, p_run_id uuid, p_status text, p_model_calls integer, p_plan_count integer, p_object_ids uuid[], p_note text)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.ai_employee_reserve_model_call(p_employee_id uuid, p_run_id uuid, p_commit boolean)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.ai_employee_context(p_employee_id uuid, p_run_id uuid, p_scope text, p_params jsonb)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.ai_employee_refresh_krs(p_employee_id uuid)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.ai_employee_perform(p_employee_id uuid, p_run_id uuid, p_action text, p_payload jsonb)`

File: `20261101154000_ai_employee_perform.sql`. `SECURITY DEFINER`. `SET search_path = public`.

```sql
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
```

### `public.guard_social_media_plan_brief_pic()`

File: `20261101157000_ai_employee_brief_ticket.sql`. `SECURITY DEFINER`. `SET search_path = public`. Badan lebih pendek dari 15 baris.

```sql
DECLARE
  v_token text;
BEGIN
  IF NEW.brief IS NOT DISTINCT FROM OLD.brief THEN
    RETURN NEW;
  END IF;

  IF public.is_plan_pic(OLD.id) THEN
    RETURN NEW;
  END IF;

  v_token := current_setting('ai_employee.brief_write', true);
  IF v_token IS NOT NULL AND v_token <> '' THEN
    DELETE FROM public.ai_employee_brief_tickets
    WHERE plan_id = OLD.id
```

## 2. GRANT dan REVOKE

```sql
REVOKE ALL ON TABLE public.ai_employee_status_tickets FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_status_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_set_performance_status(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_set_performance_status(uuid, text) TO authenticated;
REVOKE ALL ON TABLE public.ai_employee_profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_sops FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_sop_steps FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_schedules FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_permissions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_sops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_sop_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_employee_permissions TO authenticated;
REVOKE ALL ON TABLE public.ai_employee_runs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_feedback FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ai_employee_model_calls FROM PUBLIC, anon;
GRANT SELECT ON public.ai_employee_runs TO authenticated;
GRANT SELECT, INSERT ON public.ai_employee_feedback TO authenticated;
GRANT SELECT ON public.ai_employee_model_calls TO authenticated;
GRANT ai_employee_runner TO authenticator;
GRANT USAGE ON SCHEMA public TO ai_employee_runner;
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
REVOKE ALL ON TABLE public.ai_employee_brief_tickets FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_social_media_plan_brief_pic() FROM PUBLIC, anon, authenticated, service_role;
```

`count_active_employees_for_org` tidak punya baris `GRANT` atau `REVOKE` di file marker.

## 3. CREATE ROLE dan ALTER ROLE

Dari `20261101154000_ai_employee_perform.sql`. `CREATE ROLE` berada di dalam blok `DO`.

```sql
    CREATE ROLE ai_employee_runner NOLOGIN NOINHERIT;
ALTER ROLE ai_employee_runner NOBYPASSRLS;
```

## 4. ENABLE ROW LEVEL SECURITY dan CREATE POLICY

```sql
ALTER TABLE public.ai_employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_sop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_status_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_employee_profiles_select ON public.ai_employee_profiles
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_profiles_write ON public.ai_employee_profiles
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_profiles.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_profiles.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_sops_select ON public.ai_employee_sops
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_sops_write ON public.ai_employee_sops
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_sops.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_sops.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_sop_steps_select ON public.ai_employee_sop_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_employee_sops s
      WHERE s.id = sop_id
        AND s.organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY ai_employee_sop_steps_write ON public.ai_employee_sop_steps
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_employee_sops s
      JOIN public.user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = sop_id
        AND ur.user_id = auth.uid()
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_employee_sops s
      JOIN public.user_roles ur ON ur.organization_id = s.organization_id
      WHERE s.id = sop_id
        AND ur.user_id = auth.uid()
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_schedules_select ON public.ai_employee_schedules
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_schedules_write ON public.ai_employee_schedules
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_schedules.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_schedules.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

CREATE POLICY ai_employee_permissions_select ON public.ai_employee_permissions
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_permissions_write ON public.ai_employee_permissions
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_permissions.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = ai_employee_permissions.organization_id
        AND lower(trim(ur.role)) = 'owner'
    )
  );

ALTER TABLE public.ai_employee_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_model_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_employee_runs_select ON public.ai_employee_runs
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_feedback_select ON public.ai_employee_feedback
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY ai_employee_feedback_insert ON public.ai_employee_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.employees reviewer
      WHERE reviewer.id = reviewer_employee_id
        AND reviewer.user_id = auth.uid()
        AND reviewer.organization_id = ai_employee_feedback.organization_id
    )
  );

CREATE POLICY ai_employee_model_calls_select ON public.ai_employee_model_calls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = employee_id
        AND e.organization_id IN (SELECT public.user_organization_ids())
    )
  );

ALTER TABLE public.ai_employee_brief_tickets ENABLE ROW LEVEL SECURITY;
```

`ai_employee_status_tickets` dan `ai_employee_brief_tickets` diaktifkan RLS-nya. Tidak ada `CREATE POLICY` untuk kedua tabel itu.

## 5. Tabel baru tanpa RLS

Tidak ada.

Sepuluh tabel baru semuanya punya `ENABLE ROW LEVEL SECURITY`:

- `ai_employee_profiles`
- `ai_employee_sops`
- `ai_employee_sop_steps`
- `ai_employee_schedules`
- `ai_employee_permissions`
- `ai_employee_status_tickets`
- `ai_employee_runs`
- `ai_employee_feedback`
- `ai_employee_model_calls`
- `ai_employee_brief_tickets`
