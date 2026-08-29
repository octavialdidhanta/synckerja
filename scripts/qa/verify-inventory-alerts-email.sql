-- QA: inventory alerts email (daily digest + instant queue)

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'operational_email_notification_settings'
  AND column_name = 'inventory_alerts_enabled';

SELECT proname
FROM pg_proc
WHERE proname IN (
  'invoke_operational_inventory_alerts_edge',
  'invoke_dispatch_operational_inventory_alert',
  'did_cross_inventory_alert_threshold',
  'inventory_alert_status_from_stock',
  'flush_operational_inventory_alert_tx',
  'trg_catalog_ingredient_outlets_inventory_alert'
)
ORDER BY proname;

SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'operational-inventory-alerts';

SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'operational_inventory_alert_jobs',
    'operational_inventory_alert_cooldown',
    'operational_inventory_alert_staging',
    'operational_inventory_alert_tx_flush'
  )
ORDER BY tablename;

SELECT tgname
FROM pg_trigger
WHERE tgname IN (
  'trg_catalog_ingredient_outlets_inventory_alert',
  'trg_flush_operational_inventory_alert_tx'
)
ORDER BY tgname;
