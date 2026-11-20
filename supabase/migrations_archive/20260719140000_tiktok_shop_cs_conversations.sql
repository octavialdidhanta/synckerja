-- TikTok Shop CS webhook type 13 (new conversation): Realtime signal for inbox refresh

CREATE TABLE IF NOT EXISTS public.tiktok_shop_cs_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.organization_tiktok_shop_accounts (id) ON DELETE CASCADE,
  shop_id text NOT NULL,
  conversation_id text NOT NULL,
  create_time bigint,
  tts_notification_id text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_shop_cs_conversations_account_conversation_key
    UNIQUE (account_id, conversation_id)
);

COMMENT ON TABLE public.tiktok_shop_cs_conversations IS
  'Persisted TikTok Shop CS conversations from webhook type 13; Realtime signal to refresh inbox list.';

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_cs_conversations_org_account
  ON public.tiktok_shop_cs_conversations (organization_id, account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_cs_conversations_shop
  ON public.tiktok_shop_cs_conversations (shop_id, updated_at DESC);

ALTER TABLE public.tiktok_shop_cs_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_shop_cs_conversations_select_org
  ON public.tiktok_shop_cs_conversations;
CREATE POLICY tiktok_shop_cs_conversations_select_org
  ON public.tiktok_shop_cs_conversations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

-- Writes only via service role (edge webhook).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'tiktok_shop_cs_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_shop_cs_conversations;
    END IF;
  END IF;
END $$;
