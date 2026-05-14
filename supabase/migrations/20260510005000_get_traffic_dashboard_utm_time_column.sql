-- Add minute-level time metadata to UTM Tracking rows.

ALTER FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int)
  RENAME TO get_traffic_dashboard_base_before_utm_time_column;

CREATE OR REPLACE FUNCTION public.get_traffic_dashboard(
  p_web_id text,
  p_from date,
  p_to date,
  p_top_pages_limit int DEFAULT 15,
  p_top_clicks_limit int DEFAULT 15,
  p_utm_limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_payload jsonb;
  enriched_utm_table jsonb;
  v_from date;
  v_to date;
BEGIN
  base_payload := public.get_traffic_dashboard_base_before_utm_time_column(
    p_web_id,
    p_from,
    p_to,
    p_top_pages_limit,
    p_top_clicks_limit,
    p_utm_limit
  );

  v_from := NULLIF(base_payload->>'from', '')::date;
  v_to := NULLIF(base_payload->>'to', '')::date;

  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN base_payload;
  END IF;

  WITH
    utm_rows AS (
      SELECT
        row_data,
        row_number() OVER () AS row_idx,
        NULLIF(row_data->>'session_id', '') AS session_id
      FROM jsonb_array_elements(COALESCE(base_payload->'utm_table', '[]'::jsonb)) AS row_data
    ),
    session_times AS (
      SELECT
        session_id,
        MIN(first_seen_at) AS first_seen_at
      FROM (
        SELECT
          pv.session_id,
          pv.started_at AS first_seen_at
        FROM public.analytics_page_views pv
        WHERE pv.web_id = p_web_id
          AND pv.session_id IS NOT NULL
          AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to

        UNION ALL

        SELECT
          ce.session_id,
          ce.created_at AS first_seen_at
        FROM public.analytics_click_events ce
        WHERE ce.web_id = p_web_id
          AND ce.session_id IS NOT NULL
          AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      ) seen
      GROUP BY session_id
    )
  SELECT COALESCE(
    jsonb_agg(
      row_data
      || jsonb_build_object(
        'occurred_at', st.first_seen_at,
        'time_label', CASE
          WHEN st.first_seen_at IS NULL THEN NULL
          ELSE to_char(st.first_seen_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI')
        END
      )
      ORDER BY st.first_seen_at DESC NULLS LAST, row_idx
    ),
    '[]'::jsonb
  )
  INTO enriched_utm_table
  FROM utm_rows ur
  LEFT JOIN session_times st
    ON st.session_id = ur.session_id;

  RETURN jsonb_set(base_payload, '{utm_table}', enriched_utm_table, true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) IS
  'Dashboard RPC wrapper; UTM table includes minute-level first-seen time per session.';
