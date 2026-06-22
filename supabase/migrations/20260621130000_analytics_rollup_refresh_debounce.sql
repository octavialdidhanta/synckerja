-- DB-backed debounce for post-ingest analytics rollup refresh (Edge isolate-safe).
-- Also extends get_traffic_ingestion_status with raw WIB bounds + raw_pending_rollup status.

CREATE TABLE IF NOT EXISTS public.analytics_rollup_refresh_state (
  web_id text PRIMARY KEY,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analytics_rollup_refresh_state IS
  'Per-web_id debounce state for maybe_refresh_analytics_rollups (service_role ingest path).';

CREATE OR REPLACE FUNCTION public.traffic_wib_today_yesterday()
RETURNS TABLE (day_today date, day_yesterday date)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (timezone('Asia/Jakarta', now()))::date AS day_today,
    ((timezone('Asia/Jakarta', now()))::date - 1) AS day_yesterday;
$$;

CREATE OR REPLACE FUNCTION public.maybe_refresh_analytics_rollups(
  p_web_id text,
  p_debounce_seconds int DEFAULT 45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_web_id text;
  v_debounce int;
  v_last_started timestamptz;
  v_from date;
  v_to date;
  v_clear_err text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_web_id := lower(btrim(coalesce(p_web_id, '')));
  IF v_web_id = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  v_debounce := GREATEST(15, LEAST(coalesce(p_debounce_seconds, 45), 300));

  PERFORM pg_advisory_xact_lock(hashtext('analytics_rollup_refresh:' || v_web_id));

  SELECT s.last_started_at
  INTO v_last_started
  FROM public.analytics_rollup_refresh_state s
  WHERE s.web_id = v_web_id
  FOR UPDATE;

  IF v_last_started IS NOT NULL
     AND v_last_started > (now() - make_interval(secs => v_debounce)) THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'web_id', v_web_id,
      'reason', 'debounced',
      'debounce_seconds', v_debounce,
      'last_started_at', v_last_started
    );
  END IF;

  INSERT INTO public.analytics_rollup_refresh_state (web_id, last_started_at, updated_at)
  VALUES (v_web_id, now(), now())
  ON CONFLICT (web_id) DO UPDATE SET
    last_started_at = EXCLUDED.last_started_at,
    last_error = NULL,
    updated_at = now();

  SELECT y.day_yesterday, y.day_today
  INTO v_from, v_to
  FROM public.traffic_wib_today_yesterday() y;

  BEGIN
    PERFORM public.refresh_analytics_rollups(v_web_id, v_from, v_to);

    BEGIN
      PERFORM public.clear_analytics_rollups_slice_for_traffic_sync(v_web_id, v_from, v_to);
    EXCEPTION
      WHEN undefined_function THEN
        DELETE FROM public.analytics_daily_utm u
        WHERE u.web_id = v_web_id AND u.day BETWEEN v_from AND v_to;
        DELETE FROM public.analytics_daily_source_breakdown d
        WHERE d.web_id = v_web_id AND d.day BETWEEN v_from AND v_to;
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_clear_err = MESSAGE_TEXT;
        RAISE WARNING 'clear_analytics_rollups_slice_for_traffic_sync failed for %: %', v_web_id, v_clear_err;
    END;

    PERFORM public.refresh_analytics_daily_rollups(v_from, v_to, v_web_id);

    UPDATE public.analytics_rollup_refresh_state
    SET last_completed_at = now(),
        last_error = NULL,
        updated_at = now()
    WHERE web_id = v_web_id;

    RETURN jsonb_build_object(
      'status', 'refreshed',
      'web_id', v_web_id,
      'from', to_char(v_from, 'YYYY-MM-DD'),
      'to', to_char(v_to, 'YYYY-MM-DD'),
      'debounce_seconds', v_debounce
    );
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.analytics_rollup_refresh_state
      SET last_error = SQLERRM,
          updated_at = now()
      WHERE web_id = v_web_id;
      RAISE WARNING 'maybe_refresh_analytics_rollups failed for %: %', v_web_id, SQLERRM;
      RETURN jsonb_build_object(
        'status', 'error',
        'web_id', v_web_id,
        'message', SQLERRM
      );
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_refresh_analytics_rollups(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maybe_refresh_analytics_rollups(text, int) TO service_role;

COMMENT ON FUNCTION public.maybe_refresh_analytics_rollups(text, int) IS
  'Debounced rollup refresh for today+yesterday WIB after analytics ingest (service_role only).';

-- Extend authenticated ingestion status with raw bounds + clearer pending-rollup status.

CREATE OR REPLACE FUNCTION public.get_traffic_ingestion_status(p_web_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_exists boolean;
  daily_exists boolean;
  agg_min date;
  agg_max date;
  raw_min date;
  raw_max date;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  raw_exists :=
    EXISTS (SELECT 1 FROM public.analytics_sessions s WHERE s.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id LIMIT 1);

  daily_exists := EXISTS (
    SELECT 1 FROM public.analytics_daily_sessions d WHERE d.web_id = p_web_id LIMIT 1
  );

  SELECT MIN(day), MAX(day)
  INTO agg_min, agg_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  SELECT
    LEAST(
      (SELECT MIN((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    ),
    GREATEST(
      (SELECT MAX((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    )
  INTO raw_min, raw_max;

  RETURN jsonb_build_object(
    'raw_events_exist', raw_exists,
    'daily_rollups_exist', daily_exists,
    'aggregate_day_min', agg_min,
    'aggregate_day_max', agg_max,
    'raw_day_min', raw_min,
    'raw_day_max', raw_max,
    'data_status', CASE
      WHEN NOT raw_exists THEN 'no_ingested_data'
      WHEN NOT daily_exists THEN 'raw_pending_rollup'
      ELSE 'ok'
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.service_get_traffic_ingestion_status(
  p_organization_id uuid,
  p_web_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_exists boolean;
  daily_exists boolean;
  agg_min date;
  agg_max date;
  raw_min date;
  raw_max date;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF p_web_id IS NULL OR btrim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.org_can_access_web_id(p_organization_id, p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  raw_exists :=
    EXISTS (SELECT 1 FROM public.analytics_sessions s WHERE s.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id LIMIT 1);

  daily_exists := EXISTS (
    SELECT 1 FROM public.analytics_daily_sessions d WHERE d.web_id = p_web_id LIMIT 1
  );

  SELECT MIN(day), MAX(day)
  INTO agg_min, agg_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  SELECT
    LEAST(
      (SELECT MIN((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    ),
    GREATEST(
      (SELECT MAX((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    )
  INTO raw_min, raw_max;

  RETURN jsonb_build_object(
    'raw_events_exist', raw_exists,
    'daily_rollups_exist', daily_exists,
    'aggregate_day_min', agg_min,
    'aggregate_day_max', agg_max,
    'raw_day_min', raw_min,
    'raw_day_max', raw_max,
    'data_status', CASE
      WHEN NOT raw_exists THEN 'no_ingested_data'
      WHEN NOT daily_exists THEN 'raw_pending_rollup'
      ELSE 'ok'
    END
  );
END;
$$;
