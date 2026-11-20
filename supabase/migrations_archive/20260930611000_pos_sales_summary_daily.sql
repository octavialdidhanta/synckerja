-- Daily sales summary time-series (WIB buckets) + cron for operational daily email

CREATE OR REPLACE FUNCTION public.pos_sales_summary_daily(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day date,
  net_sales numeric,
  total_collected numeric,
  refunds numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  RETURN QUERY
  WITH bounds AS (
    SELECT
      COALESCE(p_from, timestamptz '1970-01-01') AS from_ts,
      COALESCE(p_to, timestamptz '2100-01-01') AS to_ts
  ),
  day_spine AS (
    SELECT d::date AS day
    FROM bounds b,
    LATERAL generate_series(
      (b.from_ts AT TIME ZONE 'Asia/Jakarta')::date,
      ((b.to_ts - interval '1 second') AT TIME ZONE 'Asia/Jakarta')::date,
      interval '1 day'
    ) AS d
  ),
  sales AS (
    SELECT
      (sa.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      COALESCE(SUM(COALESCE(sa.checkout_subtotal, 0)), 0)::numeric AS net_sales,
      COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)::numeric AS total_collected
    FROM public.sales_activities sa
    CROSS JOIN bounds b
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND sa.created_at >= b.from_ts
      AND sa.created_at < b.to_ts
    GROUP BY 1
  ),
  refund_rows AS (
    SELECT
      (sa.refunded_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      COALESCE(SUM(COALESCE(sa.refund_amount, 0)), 0)::numeric AS refunds
    FROM public.sales_activities sa
    CROSS JOIN bounds b
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'full'
      AND sa.refunded_at IS NOT NULL
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND sa.refunded_at >= b.from_ts
      AND sa.refunded_at < b.to_ts
    GROUP BY 1
  )
  SELECT
    ds.day,
    COALESCE(s.net_sales, 0)::numeric AS net_sales,
    COALESCE(s.total_collected, 0)::numeric AS total_collected,
    COALESCE(r.refunds, 0)::numeric AS refunds
  FROM day_spine ds
  LEFT JOIN sales s ON s.day = ds.day
  LEFT JOIN refund_rows r ON r.day = ds.day
  ORDER BY ds.day;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz) IS
  'Daily net_sales / total_collected (non-refunded by created_at WIB) and refunds (by refunded_at WIB).';

-- pg_cron → Edge Function daily sales email at 00:15 Asia/Jakarta (17:15 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_operational_daily_sales_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := nullif(current_setting('app.settings.supabase_url', true), '');
  v_key := nullif(current_setting('app.settings.service_role_key', true), '');

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name IN (
      'operational_daily_sales_project_url',
      'google_ads_scheduler_project_url',
      'tiktok_scheduler_project_url'
    )
    ORDER BY CASE name
      WHEN 'operational_daily_sales_project_url' THEN 0
      WHEN 'google_ads_scheduler_project_url' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name IN (
      'operational_daily_sales_service_role_key',
      'google_ads_scheduler_service_role_key',
      'tiktok_scheduler_service_role_key'
    )
    ORDER BY CASE name
      WHEN 'operational_daily_sales_service_role_key' THEN 0
      WHEN 'google_ads_scheduler_service_role_key' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE LOG 'invoke_operational_daily_sales_edge: missing Vault secrets (project url / service role key)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-operational-daily-sales',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_operational_daily_sales_edge() IS
  'POST send-operational-daily-sales at 00:15 WIB via pg_cron. Vault: operational_daily_sales_* or shared scheduler secrets.';

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'operational-daily-sales') THEN
      PERFORM cron.unschedule('operational-daily-sales');
    END IF;

    -- 00:15 Asia/Jakarta = 17:15 UTC
    PERFORM cron.schedule(
      'operational-daily-sales',
      '15 17 * * *',
      $cmd$SELECT public.invoke_operational_daily_sales_edge();$cmd$
    );
  END IF;
END
$cron$;
