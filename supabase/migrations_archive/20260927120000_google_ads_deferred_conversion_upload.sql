-- Google Ads deferred offline conversion: payment_at, pending queue, enqueue RPC, hourly pg_cron.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS payment_at timestamptz NULL;

COMMENT ON COLUMN public.leads.payment_at IS
  'Timestamp first qualifying payment (DP/full) for Google Ads deferred upload.';

ALTER TABLE public.google_ads_conversion_uploads
  ADD COLUMN IF NOT EXISTS upload_attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.google_ads_conversion_uploads
  DROP CONSTRAINT IF EXISTS google_ads_conversion_uploads_status_check;

ALTER TABLE public.google_ads_conversion_uploads
  ADD CONSTRAINT google_ads_conversion_uploads_status_check
  CHECK (status IN ('pending', 'success', 'failed', 'skipped'));

COMMENT ON COLUMN public.google_ads_conversion_uploads.upload_attempt_count IS
  'Number of UploadClickConversions attempts; cron stops retrying after 5.';

CREATE INDEX IF NOT EXISTS idx_leads_google_ads_pending_batch
  ON public.leads (organization_id, payment_at)
  WHERE gclid IS NOT NULL AND payment_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_google_ads_conversion_uploads_pending_batch
  ON public.google_ads_conversion_uploads (status, updated_at)
  WHERE status IN ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- Enqueue lead for deferred Google Ads upload (after payment + gclid).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_google_ads_conversion_pending(
  p_organization_id uuid,
  p_lead_id uuid,
  p_sales_activity_id uuid DEFAULT NULL,
  p_payment_at timestamptz DEFAULT now(),
  p_force_retry boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_existing_status text;
  v_gclid text;
BEGIN
  IF p_organization_id IS NULL OR p_lead_id IS NULL THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids()))
     AND current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
    AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_gclid := nullif(btrim(coalesce(v_lead.gclid, '')), '');
  IF v_gclid IS NULL THEN
    RETURN false;
  END IF;

  SELECT status INTO v_existing_status
  FROM public.google_ads_conversion_uploads
  WHERE lead_id = p_lead_id;

  IF v_existing_status = 'success' AND NOT p_force_retry THEN
    RETURN false;
  END IF;

  UPDATE public.leads
  SET payment_at = coalesce(payment_at, p_payment_at),
      updated_at = now()
  WHERE id = p_lead_id;

  INSERT INTO public.google_ads_conversion_uploads (
    organization_id,
    lead_id,
    sales_activity_id,
    gclid,
    status,
    skip_reason,
    error_message,
    google_ads_partial_failure,
    upload_attempt_count,
    updated_at
  )
  VALUES (
    p_organization_id,
    p_lead_id,
    p_sales_activity_id,
    v_gclid,
    'pending',
    NULL,
    NULL,
    NULL,
    CASE WHEN p_force_retry THEN 0 ELSE coalesce(
      (SELECT upload_attempt_count FROM public.google_ads_conversion_uploads WHERE lead_id = p_lead_id),
      0
    ) END,
    now()
  )
  ON CONFLICT (lead_id) DO UPDATE SET
    sales_activity_id = coalesce(excluded.sales_activity_id, google_ads_conversion_uploads.sales_activity_id),
    gclid = excluded.gclid,
    status = CASE
      WHEN google_ads_conversion_uploads.status = 'success' AND NOT p_force_retry
        THEN google_ads_conversion_uploads.status
      ELSE 'pending'
    END,
    skip_reason = CASE
      WHEN google_ads_conversion_uploads.status = 'success' AND NOT p_force_retry
        THEN google_ads_conversion_uploads.skip_reason
      ELSE NULL
    END,
    error_message = CASE
      WHEN google_ads_conversion_uploads.status = 'success' AND NOT p_force_retry
        THEN google_ads_conversion_uploads.error_message
      WHEN p_force_retry THEN NULL
      ELSE google_ads_conversion_uploads.error_message
    END,
    google_ads_partial_failure = CASE
      WHEN google_ads_conversion_uploads.status = 'success' AND NOT p_force_retry
        THEN google_ads_conversion_uploads.google_ads_partial_failure
      WHEN p_force_retry THEN NULL
      ELSE google_ads_conversion_uploads.google_ads_partial_failure
    END,
    upload_attempt_count = CASE
      WHEN google_ads_conversion_uploads.status = 'success' AND NOT p_force_retry
        THEN google_ads_conversion_uploads.upload_attempt_count
      WHEN p_force_retry THEN 0
      ELSE google_ads_conversion_uploads.upload_attempt_count
    END,
    updated_at = now()
  WHERE google_ads_conversion_uploads.status IS DISTINCT FROM 'success'
     OR p_force_retry;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.enqueue_google_ads_conversion_pending(uuid, uuid, uuid, timestamptz, boolean) IS
  'Queue lead for deferred Google Ads upload after payment. Requires gclid. p_force_retry resets failed/pending for settings backfill.';

REVOKE ALL ON FUNCTION public.enqueue_google_ads_conversion_pending(uuid, uuid, uuid, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_google_ads_conversion_pending(uuid, uuid, uuid, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_google_ads_conversion_pending(uuid, uuid, uuid, timestamptz, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- pg_cron → Edge Function (hourly batch upload)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_google_ads_pending_conversions_edge()
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
    WHERE name = 'google_ads_scheduler_project_url'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'google_ads_scheduler_service_role_key'
    LIMIT 1;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE LOG 'invoke_google_ads_pending_conversions_edge: missing Vault secrets (google_ads_scheduler_project_url, google_ads_scheduler_service_role_key)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/google-ads-upload-pending-conversions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_google_ads_pending_conversions_edge() IS
  'POST google-ads-upload-pending-conversions every hour via pg_cron. Vault: google_ads_scheduler_project_url + google_ads_scheduler_service_role_key.';

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-ads-pending-conversions') THEN
      PERFORM cron.unschedule('google-ads-pending-conversions');
    END IF;

    PERFORM cron.schedule(
      'google-ads-pending-conversions',
      '0 * * * *',
      $cmd$SELECT public.invoke_google_ads_pending_conversions_edge();$cmd$
    );
  END IF;
END
$cron$;

-- Batch candidate picker for deferred upload Edge Function.
CREATE OR REPLACE FUNCTION public.fetch_google_ads_pending_conversion_batch(p_limit integer DEFAULT 50)
RETURNS TABLE (
  lead_id uuid,
  organization_id uuid,
  sales_activity_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.lead_id,
    u.organization_id,
    u.sales_activity_id
  FROM public.google_ads_conversion_uploads u
  INNER JOIN public.leads l ON l.id = u.lead_id
  WHERE u.status IN ('pending', 'failed')
    AND u.upload_attempt_count < 5
    AND nullif(btrim(coalesce(l.gclid, '')), '') IS NOT NULL
    AND l.payment_at IS NOT NULL
    AND l.payment_at <= now() - interval '5 hours'
  ORDER BY l.payment_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 100));
$$;

COMMENT ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) IS
  'Returns leads ready for Google Ads deferred UploadClickConversions (5h after payment).';

REVOKE ALL ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) TO service_role;
