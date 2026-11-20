-- Content plan table listens for inserts and updates on social_media_plans.
-- REPLICA IDENTITY FULL is required so the organization_id filter and RLS can see the row.

ALTER TABLE public.social_media_plans REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'social_media_plans'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_media_plans;
  END IF;
END $$;
