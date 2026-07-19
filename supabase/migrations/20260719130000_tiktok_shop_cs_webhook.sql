-- TikTok Shop Customer Service webhook (type 14 new message): idempotency + Realtime messages

CREATE TABLE IF NOT EXISTS public.tiktok_shop_cs_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tts_notification_id text NOT NULL,
  type integer,
  shop_id text,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.organization_tiktok_shop_accounts (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processed', 'skipped', 'unknown_shop')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_shop_cs_webhook_events_tts_notification_id_key UNIQUE (tts_notification_id)
);

COMMENT ON TABLE public.tiktok_shop_cs_webhook_events IS
  'Idempotency + audit for TikTok Shop CS webhook deliveries (type 14 new message).';

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_cs_webhook_events_org_created
  ON public.tiktok_shop_cs_webhook_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_cs_webhook_events_shop_created
  ON public.tiktok_shop_cs_webhook_events (shop_id, created_at DESC);

ALTER TABLE public.tiktok_shop_cs_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_shop_cs_webhook_events_deny
  ON public.tiktok_shop_cs_webhook_events;
CREATE POLICY tiktok_shop_cs_webhook_events_deny
  ON public.tiktok_shop_cs_webhook_events
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.tiktok_shop_cs_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.organization_tiktok_shop_accounts (id) ON DELETE CASCADE,
  shop_id text NOT NULL,
  conversation_id text NOT NULL,
  message_id text NOT NULL,
  message_type text,
  content text,
  sender_im_user_id text,
  sender_role text,
  is_visible boolean NOT NULL DEFAULT true,
  message_index text,
  create_time bigint,
  tts_notification_id text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_shop_cs_messages_account_message_key UNIQUE (account_id, message_id)
);

COMMENT ON TABLE public.tiktok_shop_cs_messages IS
  'Persisted TikTok Shop CS messages from webhook type 14; source for Supabase Realtime inbox push.';

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_cs_messages_thread
  ON public.tiktok_shop_cs_messages (organization_id, account_id, conversation_id, create_time);

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_cs_messages_account_created
  ON public.tiktok_shop_cs_messages (account_id, created_at DESC);

ALTER TABLE public.tiktok_shop_cs_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_shop_cs_messages_select_org
  ON public.tiktok_shop_cs_messages;
CREATE POLICY tiktok_shop_cs_messages_select_org
  ON public.tiktok_shop_cs_messages
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

-- Writes only via service role (edge webhook); no client INSERT/UPDATE/DELETE policies.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'tiktok_shop_cs_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tiktok_shop_cs_messages;
    END IF;
  END IF;
END $$;
