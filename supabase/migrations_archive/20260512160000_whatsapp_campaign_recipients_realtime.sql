-- Realtime: UI kampanye dapat status Meta (delivered/read) tanpa polling berat.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_campaign_recipients'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_campaign_recipients;
  END IF;
END $$;
