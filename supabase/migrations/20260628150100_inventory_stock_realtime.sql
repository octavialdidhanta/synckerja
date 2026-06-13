DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'inventory_stock_levels'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_stock_levels;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'inventory_sync_queue'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_sync_queue;
    END IF;
  END IF;
END $$;
