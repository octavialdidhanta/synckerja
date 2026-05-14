-- Error sync: duplicate key value violates unique constraint "analytics_daily_utm_pkey1"
-- Hapus pkey1 hanya jika primary `analytics_daily_utm_pkey` juga ada (constraint ganda).

DO $$
BEGIN
  IF to_regclass('public.analytics_daily_utm') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.analytics_daily_utm'::regclass
      AND conname = 'analytics_daily_utm_pkey'
  ) AND EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.analytics_daily_utm'::regclass
      AND conname = 'analytics_daily_utm_pkey1'
  ) THEN
    ALTER TABLE public.analytics_daily_utm DROP CONSTRAINT analytics_daily_utm_pkey1;
  END IF;
END $$;
