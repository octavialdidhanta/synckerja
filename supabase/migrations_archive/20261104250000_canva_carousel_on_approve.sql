-- One Canva job per content plan. The continuation token stays in this table.
-- Members read status and the design link through canva_carousel_status_for_plans.

CREATE TABLE IF NOT EXISTS public.canva_carousel_runs (
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
  CONSTRAINT canva_carousel_runs_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS canva_carousel_runs_open_idx
  ON public.canva_carousel_runs (status, updated_at)
  WHERE status IN ('queued', 'running');

ALTER TABLE public.canva_carousel_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.canva_carousel_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.canva_carousel_runs TO service_role;

CREATE OR REPLACE FUNCTION public.canva_carousel_status_for_plans(p_plan_ids uuid[])
RETURNS TABLE (
  social_media_plan_id uuid,
  status text,
  design_url text,
  error text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.social_media_plan_id, r.status, r.design_url, left(COALESCE(r.error, ''), 160)
  FROM public.canva_carousel_runs r
  INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
  WHERE r.social_media_plan_id = ANY(COALESCE(p_plan_ids, ARRAY[]::uuid[]))
    AND p.organization_id IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_carousel_post(p_plan_id uuid, p_mode text)
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
    UPDATE public.canva_carousel_runs
    SET status = 'failed',
        error = 'canva_dispatch_missing',
        finished_at = now(),
        updated_at = now()
    WHERE social_media_plan_id = p_plan_id
      AND status IS DISTINCT FROM 'succeeded';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/canva-carousel-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-synckerja-internal-secret', v_secret
    ),
    body := jsonb_build_object('plan_id', p_plan_id, 'mode', CASE WHEN p_mode = 'resume' THEN 'resume' ELSE 'start' END),
    timeout_milliseconds := 150000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_post(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.canva_carousel_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NEW.approved IS NOT TRUE OR OLD.approved IS TRUE THEN
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
      AND lower(btrim(ct.name)) = 'carousel'
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

  INSERT INTO public.canva_carousel_runs (
    social_media_plan_id, organization_id, status, attempts, updated_at
  )
  VALUES (NEW.id, NEW.organization_id, 'queued', 0, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET status = 'queued',
      error = NULL,
      canva_job_id = NULL,
      continuation_token = NULL,
      finished_at = NULL,
      attempts = CASE WHEN public.canva_carousel_runs.status = 'failed' THEN 0 ELSE public.canva_carousel_runs.attempts END,
      updated_at = now()
  WHERE public.canva_carousel_runs.status IS DISTINCT FROM 'succeeded'
    AND NOT (
      public.canva_carousel_runs.status = 'running'
      AND public.canva_carousel_runs.updated_at > now() - interval '3 minutes'
    )
  RETURNING social_media_plan_id INTO v_id;

  IF v_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.canva_carousel_post(NEW.id, 'start');
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_enqueue() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canva_carousel_on_approve ON public.social_media_plans;
CREATE TRIGGER canva_carousel_on_approve
  AFTER UPDATE OF approved ON public.social_media_plans
  FOR EACH ROW
  WHEN (NEW.approved IS TRUE AND OLD.approved IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION public.canva_carousel_enqueue();

CREATE OR REPLACE FUNCTION public.canva_carousel_resume()
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
    FROM public.canva_carousel_runs r
    WHERE r.status IN ('queued', 'running')
      AND r.updated_at < now() - interval '40 seconds'
    ORDER BY r.updated_at
    LIMIT 3
  LOOP
    PERFORM public.canva_carousel_post(v_plan, 'resume');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_resume() FROM PUBLIC, anon, authenticated;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'canva-carousel-resume') THEN
      PERFORM cron.unschedule('canva-carousel-resume');
    END IF;
    PERFORM cron.schedule(
      'canva-carousel-resume',
      '* * * * *',
      $cmd$SELECT public.canva_carousel_resume();$cmd$
    );
  END IF;
END;
$cron$;
