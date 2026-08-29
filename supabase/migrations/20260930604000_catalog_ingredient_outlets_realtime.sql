-- Enable Realtime for Ingredient Library / kitchen stock UI refresh.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'catalog_ingredient_outlets'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_ingredient_outlets;
    END IF;
  END IF;
END $$;
