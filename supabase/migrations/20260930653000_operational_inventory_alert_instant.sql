-- Instant inventory alerts: queue + cooldown + deferred batch flush + edge invoke
-- Triggered when catalog_ingredient_outlets.in_stock crosses into low/out.

-- ---------------------------------------------------------------------------
-- Queue (one email job per transaction batch)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_inventory_alert_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT operational_inventory_alert_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT operational_inventory_alert_jobs_status_check CHECK (
    status IN ('pending', 'sent', 'failed')
  ),
  CONSTRAINT operational_inventory_alert_jobs_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_operational_inventory_alert_jobs_pending
  ON public.operational_inventory_alert_jobs (status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_operational_inventory_alert_jobs_org
  ON public.operational_inventory_alert_jobs (organization_id, created_at DESC);

ALTER TABLE public.operational_inventory_alert_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operational_inventory_alert_jobs_org_select"
  ON public.operational_inventory_alert_jobs;
CREATE POLICY "operational_inventory_alert_jobs_org_select"
  ON public.operational_inventory_alert_jobs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.operational_inventory_alert_jobs IS
  'Instant inventory alert email queue (batched per DB transaction).';

-- ---------------------------------------------------------------------------
-- Cooldown: max 1 instant alert per (org, outlet, ingredient, status) per WIB day
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_inventory_alert_cooldown (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.catalog_ingredients (id) ON DELETE CASCADE,
  status text NOT NULL,
  sent_on_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_inventory_alert_cooldown_pkey
    PRIMARY KEY (organization_id, outlet_id, ingredient_id, status),
  CONSTRAINT operational_inventory_alert_cooldown_status_check CHECK (
    status IN ('low', 'out')
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_inventory_alert_cooldown_date
  ON public.operational_inventory_alert_cooldown (sent_on_date);

ALTER TABLE public.operational_inventory_alert_cooldown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operational_inventory_alert_cooldown_org_select"
  ON public.operational_inventory_alert_cooldown;
CREATE POLICY "operational_inventory_alert_cooldown_org_select"
  ON public.operational_inventory_alert_cooldown FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.operational_inventory_alert_cooldown IS
  'Anti-spam: one instant inventory alert per ingredient/outlet/status per WIB calendar day.';

-- ---------------------------------------------------------------------------
-- Per-tx staging (row events) + deferred flush marker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_inventory_alert_staging (
  id bigserial PRIMARY KEY,
  txid bigint NOT NULL,
  organization_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  ingredient_name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  outlet_name text NOT NULL DEFAULT '',
  status text NOT NULL,
  in_stock numeric(14, 3) NOT NULL,
  alert_at numeric(14, 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_inventory_alert_staging_status_check CHECK (
    status IN ('low', 'out')
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_inventory_alert_staging_txid
  ON public.operational_inventory_alert_staging (txid);

COMMENT ON TABLE public.operational_inventory_alert_staging IS
  'Transient row-level inventory alert events keyed by txid_current(); flushed at COMMIT.';

CREATE TABLE IF NOT EXISTS public.operational_inventory_alert_tx_flush (
  txid bigint PRIMARY KEY
);

COMMENT ON TABLE public.operational_inventory_alert_tx_flush IS
  'Deferred COMMIT marker to batch staging rows into one email job.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_alert_wib_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('Asia/Jakarta', now()))::date;
$$;

CREATE OR REPLACE FUNCTION public.inventory_alert_status_from_stock(
  p_in_stock numeric,
  p_alert_enabled boolean,
  p_alert_at numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_in_stock, 0) <= 0 THEN 'out'
    WHEN COALESCE(p_alert_enabled, false)
      AND p_alert_at IS NOT NULL
      AND COALESCE(p_in_stock, 0) <= p_alert_at THEN 'low'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.did_cross_inventory_alert_threshold(
  p_prev numeric,
  p_next numeric,
  p_alert_enabled boolean,
  p_alert_at numeric
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_was text;
  v_now text;
BEGIN
  v_was := public.inventory_alert_status_from_stock(p_prev, p_alert_enabled, p_alert_at);
  v_now := public.inventory_alert_status_from_stock(p_next, p_alert_enabled, p_alert_at);
  IF v_now IS NULL THEN
    RETURN NULL;
  END IF;
  -- Fire only on transition into the status (out preferred over low)
  IF v_now = 'out' AND COALESCE(v_was, '') IS DISTINCT FROM 'out' THEN
    RETURN 'out';
  END IF;
  IF v_now = 'low' AND COALESCE(v_was, '') IS DISTINCT FROM 'low' THEN
    RETURN 'low';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoke_dispatch_operational_inventory_alert(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

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
    RAISE LOG 'invoke_dispatch_operational_inventory_alert: missing Vault secrets';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/dispatch-operational-inventory-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('jobId', p_job_id),
    timeout_milliseconds := 60000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_dispatch_operational_inventory_alert(uuid) IS
  'POST dispatch-operational-inventory-alert for one job id (Vault secrets shared with daily sales).';

-- ---------------------------------------------------------------------------
-- Flush staging → one job + cooldown + edge invoke (deferred at COMMIT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flush_operational_inventory_alert_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txid bigint := NEW.txid;
  v_org uuid;
  v_items jsonb := '[]'::jsonb;
  v_job_id uuid;
  r record;
  v_today date := public.inventory_alert_wib_today();
BEGIN
  SELECT organization_id INTO v_org
  FROM public.operational_inventory_alert_staging
  WHERE txid = v_txid
  LIMIT 1;

  IF v_org IS NULL THEN
    DELETE FROM public.operational_inventory_alert_tx_flush WHERE txid = v_txid;
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT DISTINCT ON (s.outlet_id, s.ingredient_id, s.status)
      s.outlet_id,
      s.ingredient_id,
      s.ingredient_name,
      s.unit,
      s.outlet_name,
      s.status,
      s.in_stock,
      s.alert_at
    FROM public.operational_inventory_alert_staging s
    WHERE s.txid = v_txid
    ORDER BY s.outlet_id, s.ingredient_id, s.status, s.id DESC
  LOOP
    -- Skip if already alerted today for this key
    IF EXISTS (
      SELECT 1
      FROM public.operational_inventory_alert_cooldown c
      WHERE c.organization_id = v_org
        AND c.outlet_id = r.outlet_id
        AND c.ingredient_id = r.ingredient_id
        AND c.status = r.status
        AND c.sent_on_date = v_today
    ) THEN
      CONTINUE;
    END IF;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'outletId', r.outlet_id,
        'outletName', r.outlet_name,
        'ingredientId', r.ingredient_id,
        'name', r.ingredient_name,
        'unit', r.unit,
        'status', r.status,
        'inStock', r.in_stock,
        'alertAt', r.alert_at
      )
    );

    INSERT INTO public.operational_inventory_alert_cooldown (
      organization_id, outlet_id, ingredient_id, status, sent_on_date
    )
    VALUES (v_org, r.outlet_id, r.ingredient_id, r.status, v_today)
    ON CONFLICT (organization_id, outlet_id, ingredient_id, status) DO UPDATE
      SET sent_on_date = EXCLUDED.sent_on_date,
          created_at = now();
  END LOOP;

  DELETE FROM public.operational_inventory_alert_staging WHERE txid = v_txid;
  DELETE FROM public.operational_inventory_alert_tx_flush WHERE txid = v_txid;

  IF jsonb_array_length(v_items) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.operational_inventory_alert_jobs (
    organization_id,
    payload,
    status
  )
  VALUES (
    v_org,
    jsonb_build_object('items', v_items),
    'pending'
  )
  RETURNING id INTO v_job_id;

  PERFORM public.invoke_dispatch_operational_inventory_alert(v_job_id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_flush_operational_inventory_alert_tx
  ON public.operational_inventory_alert_tx_flush;
CREATE CONSTRAINT TRIGGER trg_flush_operational_inventory_alert_tx
  AFTER INSERT ON public.operational_inventory_alert_tx_flush
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.flush_operational_inventory_alert_tx();

-- ---------------------------------------------------------------------------
-- Row trigger: stage crossings + schedule deferred flush
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_catalog_ingredient_outlets_inventory_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean := true;
  v_cross text;
  v_track boolean := false;
  v_name text;
  v_unit text;
  v_outlet_name text;
  v_txid bigint := txid_current();
BEGIN
  IF NEW.in_stock IS NOT DISTINCT FROM OLD.in_stock THEN
    RETURN NEW;
  END IF;

  -- Restock: clear cooldown so a future drop can alert again
  IF public.inventory_alert_status_from_stock(
       NEW.in_stock, NEW.alert_enabled, NEW.alert_at
     ) IS NULL THEN
    DELETE FROM public.operational_inventory_alert_cooldown
    WHERE organization_id = NEW.organization_id
      AND outlet_id = NEW.outlet_id
      AND ingredient_id = NEW.ingredient_id;
    RETURN NEW;
  END IF;

  v_cross := public.did_cross_inventory_alert_threshold(
    OLD.in_stock,
    NEW.in_stock,
    NEW.alert_enabled,
    NEW.alert_at
  );
  IF v_cross IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.inventory_alerts_enabled, true) INTO v_enabled
  FROM public.operational_email_notification_settings s
  WHERE s.organization_id = NEW.organization_id;

  IF NOT COALESCE(v_enabled, true) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(i.track_inventory, false), COALESCE(i.name, 'Ingredient'), COALESCE(i.unit_code, '')
  INTO v_track, v_name, v_unit
  FROM public.catalog_ingredients i
  WHERE i.id = NEW.ingredient_id;

  IF NOT v_track THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(o.name, 'Outlet') INTO v_outlet_name
  FROM public.pos_outlets o
  WHERE o.id = NEW.outlet_id;

  -- Skip if already cooled down today (avoid staging noise)
  IF EXISTS (
    SELECT 1
    FROM public.operational_inventory_alert_cooldown c
    WHERE c.organization_id = NEW.organization_id
      AND c.outlet_id = NEW.outlet_id
      AND c.ingredient_id = NEW.ingredient_id
      AND c.status = v_cross
      AND c.sent_on_date = public.inventory_alert_wib_today()
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.operational_inventory_alert_staging (
    txid,
    organization_id,
    outlet_id,
    ingredient_id,
    ingredient_name,
    unit,
    outlet_name,
    status,
    in_stock,
    alert_at
  )
  VALUES (
    v_txid,
    NEW.organization_id,
    NEW.outlet_id,
    NEW.ingredient_id,
    v_name,
    v_unit,
    COALESCE(v_outlet_name, 'Outlet'),
    v_cross,
    NEW.in_stock,
    NEW.alert_at
  );

  INSERT INTO public.operational_inventory_alert_tx_flush (txid)
  VALUES (v_txid)
  ON CONFLICT (txid) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalog_ingredient_outlets_inventory_alert
  ON public.catalog_ingredient_outlets;
CREATE TRIGGER trg_catalog_ingredient_outlets_inventory_alert
  AFTER UPDATE OF in_stock ON public.catalog_ingredient_outlets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_catalog_ingredient_outlets_inventory_alert();

COMMENT ON FUNCTION public.trg_catalog_ingredient_outlets_inventory_alert() IS
  'Stage inventory alert crossings; deferred flush batches one email per transaction.';
