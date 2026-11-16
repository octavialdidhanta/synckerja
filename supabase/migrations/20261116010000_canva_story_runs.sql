-- Fase 4 Design Story: Canva Story runs (mirror tipis carousel, terpisah).

CREATE TABLE IF NOT EXISTS public.canva_story_runs (
  social_media_plan_id uuid PRIMARY KEY REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  status text NOT NULL,
  canva_job_id text,
  continuation_token text,
  design_id text,
  design_url text,
  error text,
  attempts smallint NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  images_ready boolean NOT NULL DEFAULT false,
  export_attempts smallint NOT NULL DEFAULT 0,
  refresh_requested boolean NOT NULL DEFAULT false,
  export_path text,
  CONSTRAINT canva_story_runs_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS canva_story_runs_open_idx
  ON public.canva_story_runs (status, updated_at)
  WHERE status IN ('queued', 'running');

ALTER TABLE public.canva_story_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.canva_story_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.canva_story_runs TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media-story', 'social-media-story', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "social_media_story_public_read" ON storage.objects;
CREATE POLICY "social_media_story_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social-media-story');

DROP POLICY IF EXISTS "social_media_story_service_write" ON storage.objects;
CREATE POLICY "social_media_story_service_write"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'social-media-story');

DROP POLICY IF EXISTS "social_media_story_service_update" ON storage.objects;
CREATE POLICY "social_media_story_service_update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'social-media-story')
  WITH CHECK (bucket_id = 'social-media-story');

DROP POLICY IF EXISTS "social_media_story_service_delete" ON storage.objects;
CREATE POLICY "social_media_story_service_delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'social-media-story');

CREATE OR REPLACE FUNCTION public.canva_story_status_for_plans(p_plan_ids uuid[])
RETURNS TABLE (
  social_media_plan_id uuid,
  status text,
  design_url text,
  error text,
  images_ready boolean,
  refresh_requested boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.social_media_plan_id,
         r.status,
         r.design_url,
         left(COALESCE(r.error, ''), 160),
         r.images_ready,
         r.refresh_requested
  FROM public.canva_story_runs r
  INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
  WHERE r.social_media_plan_id = ANY(COALESCE(p_plan_ids, ARRAY[]::uuid[]))
    AND p.organization_id IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.canva_story_status_for_plans(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_story_status_for_plans(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_story_post(p_plan_id uuid, p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT ds.decrypted_secret INTO v_url
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'ai_employee_project_url'
  LIMIT 1;
  SELECT ds.decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'ai_employee_internal_secret'
  LIMIT 1;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    UPDATE public.canva_story_runs
    SET status = 'failed',
        error = 'canva_dispatch_missing',
        finished_at = now(),
        updated_at = now()
    WHERE social_media_plan_id = p_plan_id
      AND status IS DISTINCT FROM 'succeeded';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/canva-story-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-synckerja-internal-secret', v_secret
    ),
    body := jsonb_build_object(
      'plan_id', p_plan_id,
      'mode', CASE
        WHEN p_mode = 'resume' THEN 'resume'
        WHEN p_mode = 'refresh' THEN 'refresh'
        ELSE 'start'
      END
    ),
    timeout_milliseconds := 150000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_post(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.canva_story_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NEW.approved IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- UPDATE only when approved flips to true; INSERT always when approved.
  IF TG_OP = 'UPDATE' AND OLD.approved IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.pic_id
      AND e.organization_id = NEW.organization_id
      AND e.is_ai IS TRUE
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.content_types ct
    WHERE ct.id = NEW.content_type_id
      AND lower(btrim(ct.name)) = 'story'
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_canva_connections c
    INNER JOIN public.organization_canva_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = NEW.organization_id
      AND c.is_active
      AND c.oauth_connected_at IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.canva_story_runs (
    social_media_plan_id, organization_id, status, attempts, updated_at
  )
  VALUES (NEW.id, NEW.organization_id, 'queued', 0, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET status = 'queued',
      error = NULL,
      canva_job_id = NULL,
      continuation_token = NULL,
      finished_at = NULL,
      images_ready = false,
      refresh_requested = false,
      export_attempts = 0,
      attempts = CASE WHEN public.canva_story_runs.status = 'failed' THEN 0 ELSE public.canva_story_runs.attempts END,
      updated_at = now()
  WHERE public.canva_story_runs.status IS DISTINCT FROM 'succeeded'
    AND NOT (
      public.canva_story_runs.status = 'running'
      AND public.canva_story_runs.updated_at > now() - interval '3 minutes'
    )
  RETURNING social_media_plan_id INTO v_id;

  IF v_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.canva_story_post(NEW.id, 'start');
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_enqueue() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canva_story_on_approve ON public.social_media_plans;
CREATE TRIGGER canva_story_on_approve
  AFTER INSERT OR UPDATE OF approved ON public.social_media_plans
  FOR EACH ROW
  WHEN (NEW.approved IS TRUE)
  EXECUTE FUNCTION public.canva_story_enqueue();

CREATE OR REPLACE FUNCTION public.canva_story_refresh(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plan_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.social_media_plans p
    WHERE p.id = p_plan_id
      AND p.organization_id IN (SELECT public.user_organization_ids())
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.canva_story_runs
  SET refresh_requested = true,
      images_ready = false,
      export_attempts = 0,
      error = NULL,
      updated_at = now()
  WHERE social_media_plan_id = p_plan_id
    AND status = 'succeeded'
    AND design_id IS NOT NULL
    AND btrim(design_id) <> '';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'canva_design_missing' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.canva_story_post(p_plan_id, 'refresh');
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_refresh(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_story_refresh(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_story_start(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_id uuid;
BEGIN
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.organization_id
  INTO v_org
  FROM public.social_media_plans p
  JOIN public.content_types ct ON ct.id = p.content_type_id
  JOIN public.employees e
    ON e.id = p.pic_id
   AND e.organization_id = p.organization_id
   AND e.is_ai IS TRUE
  WHERE p.id = p_plan_id
    AND p.approved IS TRUE
    AND lower(btrim(ct.name)) = 'story'
    AND p.organization_id IN (SELECT public.user_organization_ids());

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_canva_connections c
    INNER JOIN public.organization_canva_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = v_org
      AND c.is_active
      AND c.oauth_connected_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'canva_not_connected' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.canva_story_runs (
    social_media_plan_id, organization_id, status, attempts, updated_at
  )
  VALUES (p_plan_id, v_org, 'queued', 0, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET status = 'queued',
      error = NULL,
      canva_job_id = NULL,
      continuation_token = NULL,
      finished_at = NULL,
      images_ready = false,
      refresh_requested = false,
      export_attempts = 0,
      attempts = 0,
      updated_at = now()
  WHERE public.canva_story_runs.status IS DISTINCT FROM 'running'
     OR public.canva_story_runs.updated_at <= now() - interval '3 minutes'
  RETURNING social_media_plan_id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'too_soon' USING ERRCODE = '22023';
  END IF;

  PERFORM public.canva_story_post(p_plan_id, 'start');
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_start(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_story_start(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_story_resume()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan uuid;
  v_count integer := 0;
BEGIN
  FOR v_plan IN
    SELECT r.social_media_plan_id
    FROM public.canva_story_runs r
    WHERE (
      r.status IN ('queued', 'running')
      OR (r.status = 'succeeded' AND r.images_ready = false AND r.refresh_requested = true)
    )
      AND r.updated_at < now() - interval '40 seconds'
    ORDER BY r.updated_at
    LIMIT 3
  LOOP
    PERFORM public.canva_story_post(v_plan, 'resume');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_resume() FROM PUBLIC, anon, authenticated;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canva-story-resume') THEN
      PERFORM cron.unschedule('canva-story-resume');
    END IF;
    PERFORM cron.schedule(
      'canva-story-resume',
      '* * * * *',
      $job$SELECT public.canva_story_resume();$job$
    );
  END IF;
END;
$cron$;

-- Enrich story plans list with Canva status.
CREATE OR REPLACE FUNCTION public.ai_employee_story_plans(
  p_employee_id uuid,
  p_month date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_month date;
  v_from timestamptz;
  v_to timestamptz;
  v_rows jsonb;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);
  v_month := date_trunc('month', COALESCE(p_month, timezone('Asia/Jakarta', now())::date))::date;
  v_from := v_month::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_to := (v_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Jakarta';

  SELECT COALESCE(jsonb_agg(row_data ORDER BY post_date DESC NULLS LAST, created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      plan.post_date,
      plan.created_at,
      jsonb_build_object(
        'id', plan.id,
        'post_date', plan.post_date,
        'pic_name', left(COALESCE(pic.full_name, ''), 120),
        'content_type_name', left(COALESCE(ctype.name, 'Story'), 40),
        'service_name', left(COALESCE(service.name, ''), 120),
        'pillar_name', left(COALESCE(pillar.name, ''), 120),
        'brief_preview', left(COALESCE(plan.brief, ''), 280),
        'google_drive_link', left(COALESCE(plan.google_drive_link, ''), 500),
        'canva', CASE
          WHEN canva.social_media_plan_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'status', canva.status,
            'design_url', canva.design_url,
            'error', left(COALESCE(canva.error, ''), 160),
            'images_ready', canva.images_ready,
            'refresh_requested', canva.refresh_requested
          )
        END
      ) AS row_data
    FROM public.social_media_plans plan
    JOIN public.content_types ctype
      ON ctype.id = plan.content_type_id
     AND lower(btrim(ctype.name)) = 'story'
    LEFT JOIN public.employees pic
      ON pic.id = plan.pic_id
    LEFT JOIN public.services service
      ON service.id = plan.service_id
    LEFT JOIN public.content_pillars pillar
      ON pillar.id = plan.content_pillar_id
    LEFT JOIN public.canva_story_runs canva
      ON canva.social_media_plan_id = plan.id
    WHERE plan.organization_id = v_org
      AND (plan.pic_id = p_employee_id OR plan.author_employee_id = p_employee_id)
      AND plan.post_date >= v_from
      AND plan.post_date < v_to
    ORDER BY plan.post_date DESC NULLS LAST, plan.created_at DESC
    LIMIT 300
  ) listed;

  RETURN jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'rows', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_story_plans(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_plans(uuid, date) TO authenticated;
