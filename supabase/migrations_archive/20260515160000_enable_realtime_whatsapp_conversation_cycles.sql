-- CRM cycle metrics + room tables refetch when cycles change (first_response_at / resolved_at).
-- Client subscribes in `useLeads` (sales.ts); table must be in publication for events to flow.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_conversation_cycles'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversation_cycles;
  END IF;
END $$;
