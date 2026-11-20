-- Operations / CRM / Livechat / Leads / Sales activities
-- Concatenated from synckerja-reference migrations (dependency-ordered).
-- Idempotent where possible via IF NOT EXISTS in source files.



-- === 20250202000000_create_organization_meta_config_and_migrate.sql ===

-- Create organization_meta_config: centralized Meta token + WhatsApp/Facebook/Instagram config per org
CREATE TABLE IF NOT EXISTS public.organization_meta_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meta_access_token TEXT NOT NULL,
    meta_business_manager_id TEXT,
    whatsapp_business_account_id TEXT NOT NULL DEFAULT '',
    verify_token TEXT NOT NULL DEFAULT '',
    phone_number_id TEXT,
    display_phone_number TEXT,
    whatsapp_business_name TEXT,
    name_status TEXT,
    facebook_page_id TEXT,
    facebook_verify_token TEXT,
    instagram_business_account_id TEXT,
    instagram_verify_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_org_meta_config UNIQUE (organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_meta_config_verify_token
    ON public.organization_meta_config(verify_token)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_organization_meta_config_organization_id
    ON public.organization_meta_config(organization_id);

ALTER TABLE public.organization_meta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org meta config"
    ON public.organization_meta_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_meta_config.organization_id
        )
    );

CREATE POLICY "Users can insert own org meta config"
    ON public.organization_meta_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_id
        )
    );

CREATE POLICY "Users can update own org meta config"
    ON public.organization_meta_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_meta_config.organization_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_id
        )
    );

CREATE POLICY "Users can delete own org meta config"
    ON public.organization_meta_config FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_meta_config.organization_id
        )
    );

CREATE OR REPLACE FUNCTION update_organization_meta_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_meta_config_updated_at
    BEFORE UPDATE ON public.organization_meta_config
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_meta_config_updated_at();

-- Copy data from organization_whatsapp_config only if that table exists (existing projects)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_whatsapp_config'
  ) THEN
    INSERT INTO public.organization_meta_config (
      id, organization_id, meta_access_token, meta_business_manager_id,
      whatsapp_business_account_id, verify_token, phone_number_id, display_phone_number,
      whatsapp_business_name, name_status, is_active, created_by, created_at, updated_at
    )
    SELECT
      id, organization_id, whatsapp_access_token, NULL,
      COALESCE(whatsapp_business_account_id, ''),
      COALESCE(verify_token, ''),
      phone_number_id, display_phone_number,
      whatsapp_business_name, name_status,
      COALESCE(is_active, TRUE), created_by, created_at, updated_at
    FROM public.organization_whatsapp_config
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;
END $$;


-- === 20250202000001_drop_organization_whatsapp_config.sql ===
-- DROP TRIGGER ... ON table_name requires the table to exist; skip on fresh DBs.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_whatsapp_config'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_organization_whatsapp_config_updated_at ON public.organization_whatsapp_config;
    DROP TABLE IF EXISTS public.organization_whatsapp_config;
  END IF;
END $$;


-- === create_whatsapp_conversations_and_messages.sql (ordered early) ===
-- WhatsApp tables must exist before channel/RPC/preview migrations below.

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_wa_id TEXT NOT NULL,
  customer_name TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_conversation_org_customer UNIQUE (organization_id, customer_wa_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_organization_id ON public.whatsapp_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message_at ON public.whatsapp_conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversations.organization_id)
  );

CREATE POLICY "Users can insert own org whatsapp conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id)
  );

CREATE POLICY "Users can update own org whatsapp conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversations.organization_id)
  );

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  wa_message_id TEXT,
  body TEXT,
  message_type TEXT DEFAULT 'text',
  raw_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = whatsapp_messages.conversation_id
    )
  );

CREATE POLICY "Users can insert own org whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = whatsapp_messages.conversation_id
    )
  );

CREATE OR REPLACE FUNCTION update_whatsapp_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_whatsapp_conversations_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER trigger_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_conversations_updated_at();

-- Preview RPCs below join lead_statuses; column must exist before CREATE FUNCTION (see add_whatsapp_conversation_lead_status_id later — idempotent).
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS lead_status_id UUID REFERENCES public.lead_statuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_lead_status_id
  ON public.whatsapp_conversations(lead_status_id);

-- Preview RPCs select m.status from whatsapp_messages (see add_whatsapp_message_status.sql later — idempotent).
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id ON public.whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;


-- === 20250202000002_ensure_whatsapp_conversations_unique_org_customer.sql ===

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_conversations'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_conversations'::regclass
      AND conname = 'uq_whatsapp_conversation_org_customer'
  ) THEN
    ALTER TABLE public.whatsapp_conversations
    ADD CONSTRAINT uq_whatsapp_conversation_org_customer UNIQUE (organization_id, customer_wa_id);
  END IF;
END $$;


-- === 20250202000003_add_instagram_username_name_to_meta_config.sql ===

-- Add Instagram display name/username for connected account list
ALTER TABLE public.organization_meta_config
  ADD COLUMN IF NOT EXISTS instagram_username TEXT,
  ADD COLUMN IF NOT EXISTS instagram_name TEXT;


-- === 20250202000004_add_channel_to_whatsapp_conversations.sql ===

-- Add channel to whatsapp_conversations: 'whatsapp' | 'instagram'
-- Inbound from WhatsApp â†’ channel = 'whatsapp'; inbound from Instagram â†’ channel = 'instagram'
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';

UPDATE public.whatsapp_conversations
  SET channel = 'whatsapp'
  WHERE channel IS NULL;

COMMENT ON COLUMN public.whatsapp_conversations.channel IS 'Source channel: whatsapp or instagram. Used for live chat unified inbox.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_channel
  ON public.whatsapp_conversations(channel);


-- === 20250202000005_add_channel_to_conversations_preview_rpc.sql ===

-- Extend get_whatsapp_conversations_with_preview to return channel ('whatsapp' | 'instagram')
-- so frontend can show channel icon and use send-instagram-message for Instagram conversations.
DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  channel TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    COALESCE(c.channel, 'whatsapp') AS channel,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;


-- === 20250202000006_add_channel_platform_message_id_to_whatsapp_messages.sql ===

-- Add channel and platform_message_id to whatsapp_messages for consistency with conversations.
-- channel: 'whatsapp' | 'instagram'. Send decision uses whatsapp_conversations.channel; this is for data consistency.
-- platform_message_id: Meta message ID (same as wa_message_id; kept for reporting/consistency).
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS platform_message_id TEXT;

UPDATE public.whatsapp_messages
SET channel = COALESCE(channel, 'whatsapp')
WHERE channel IS NULL;

UPDATE public.whatsapp_messages
SET platform_message_id = wa_message_id
WHERE platform_message_id IS NULL AND wa_message_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages
  ALTER COLUMN channel SET DEFAULT 'whatsapp';

COMMENT ON COLUMN public.whatsapp_messages.channel IS 'Source channel: whatsapp or instagram. Matches conversation channel for consistency.';
COMMENT ON COLUMN public.whatsapp_messages.platform_message_id IS 'Meta/WhatsApp/Instagram message ID. Same as wa_message_id for compatibility.';


-- === 20250203000000_create_organization_whatsapp_accounts.sql ===

-- Multi-account WhatsApp: one row per (org, phone_number_id). Max 3 per org (enforced in app).
-- Token: use meta_access_token from this row if set; else use organization_meta_config.meta_access_token (shared).
CREATE TABLE IF NOT EXISTS public.organization_whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  whatsapp_business_account_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  meta_access_token TEXT,
  display_phone_number TEXT,
  whatsapp_business_name TEXT,
  name_status TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_org_whatsapp_account_phone UNIQUE (organization_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_whatsapp_accounts_organization_id
  ON public.organization_whatsapp_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_whatsapp_accounts_phone_number_id
  ON public.organization_whatsapp_accounts(phone_number_id);

ALTER TABLE public.organization_whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

CREATE POLICY "Users can insert own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "Users can update own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

CREATE POLICY "Users can delete own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

CREATE OR REPLACE FUNCTION update_organization_whatsapp_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.organization_whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION update_organization_whatsapp_accounts_updated_at();

-- Migrate existing single account from organization_meta_config
INSERT INTO public.organization_whatsapp_accounts (
  organization_id,
  whatsapp_business_account_id,
  phone_number_id,
  meta_access_token,
  display_phone_number,
  whatsapp_business_name,
  name_status,
  is_active,
  updated_at
)
SELECT
  organization_id,
  COALESCE(whatsapp_business_account_id, ''),
  phone_number_id,
  meta_access_token,
  display_phone_number,
  whatsapp_business_name,
  name_status,
  COALESCE(is_active, TRUE),
  updated_at
FROM public.organization_meta_config
WHERE phone_number_id IS NOT NULL AND TRIM(phone_number_id) <> ''
ON CONFLICT (organization_id, phone_number_id) DO NOTHING;

COMMENT ON TABLE public.organization_whatsapp_accounts IS 'WhatsApp Business API accounts per organization. Max 3 per org (enforced in app). Token from row or shared from organization_meta_config.';


-- === 20250203000001_add_phone_number_id_to_whatsapp_conversations.sql ===

-- Add phone_number_id to whatsapp_conversations for multi-account WhatsApp.
-- For channel='whatsapp': which account (phone_number_id) this conversation belongs to.
-- For channel='instagram': NULL.
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT;

COMMENT ON COLUMN public.whatsapp_conversations.phone_number_id IS 'WhatsApp Phone Number ID for channel=whatsapp; NULL for instagram. Used for multi-account and send API.';

-- Backfill: set phone_number_id from organization_meta_config (single account) for existing WhatsApp conversations
UPDATE public.whatsapp_conversations c
SET phone_number_id = m.phone_number_id
FROM public.organization_meta_config m
WHERE c.organization_id = m.organization_id
  AND COALESCE(c.channel, 'whatsapp') = 'whatsapp'
  AND c.phone_number_id IS NULL
  AND m.phone_number_id IS NOT NULL;

-- If any still null (e.g. org now uses organization_whatsapp_accounts), set from first account
UPDATE public.whatsapp_conversations c
SET phone_number_id = (
  SELECT a.phone_number_id
  FROM public.organization_whatsapp_accounts a
  WHERE a.organization_id = c.organization_id
  ORDER BY a.updated_at DESC
  LIMIT 1
)
WHERE c.channel = 'whatsapp' AND c.phone_number_id IS NULL;

-- Drop old unique constraint
ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS uq_whatsapp_conversation_org_customer;

-- Partial unique: Instagram = one conversation per (org, customer_wa_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_conv_org_customer_instagram
  ON public.whatsapp_conversations (organization_id, customer_wa_id)
  WHERE channel = 'instagram' OR channel IS NULL;

-- Partial unique: WhatsApp = one conversation per (org, customer_wa_id, phone_number_id) when phone_number_id set
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_conv_org_customer_wa_phone
  ON public.whatsapp_conversations (organization_id, customer_wa_id, phone_number_id)
  WHERE channel = 'whatsapp' AND phone_number_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_number_id
  ON public.whatsapp_conversations(phone_number_id)
  WHERE phone_number_id IS NOT NULL;


-- === 20250203000002_add_phone_number_id_to_conversations_preview_rpc.sql ===

-- Extend get_whatsapp_conversations_with_preview to return phone_number_id and whatsapp_account_display_name
-- for multi-account indicator in inbox.
DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  channel TEXT,
  phone_number_id TEXT,
  whatsapp_account_display_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    COALESCE(c.channel, 'whatsapp') AS channel,
    c.phone_number_id,
    COALESCE(
      NULLIF(TRIM(a.whatsapp_business_name), ''),
      NULLIF(TRIM(a.display_phone_number), ''),
      a.phone_number_id
    )::TEXT AS whatsapp_account_display_name,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN organization_whatsapp_accounts a
    ON a.organization_id = c.organization_id
   AND a.phone_number_id = c.phone_number_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;


-- === 20250204000000_create_organization_email_connections.sql ===

-- Email connections per organization (one per connected email account).
-- inbound_address: address we display to user for Gmail forwarding (e.g. inbound-xxx@chat.domain.com).
-- confirmation_code: extracted from Gmail verification email when received via Resend inbound.
CREATE TABLE IF NOT EXISTS public.organization_email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  inbound_address TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified')),
  confirmation_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_org_email_connection_inbound UNIQUE (organization_id, inbound_address)
);

CREATE INDEX IF NOT EXISTS idx_organization_email_connections_organization_id
  ON public.organization_email_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_email_connections_inbound_address
  ON public.organization_email_connections(inbound_address);
CREATE INDEX IF NOT EXISTS idx_organization_email_connections_status
  ON public.organization_email_connections(status);

ALTER TABLE public.organization_email_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org email connections"
  ON public.organization_email_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_email_connections.organization_id
    )
  );

CREATE POLICY "Users can insert own org email connections"
  ON public.organization_email_connections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "Users can update own org email connections"
  ON public.organization_email_connections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_email_connections.organization_id
    )
  );

CREATE POLICY "Users can delete own org email connections"
  ON public.organization_email_connections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_email_connections.organization_id
    )
  );

CREATE OR REPLACE FUNCTION update_organization_email_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_email_connections_updated_at
  BEFORE UPDATE ON public.organization_email_connections
  FOR EACH ROW EXECUTE FUNCTION update_organization_email_connections_updated_at();

COMMENT ON TABLE public.organization_email_connections IS 'Email accounts connected for forwarding. User adds inbound_address in Gmail; we receive verification email and show confirmation_code in Live Chat.';


-- === 20250204000001_create_email_conversations_and_messages.sql ===

-- Email conversations: one per (organization, email_connection) thread (e.g. verification thread or forwarded thread).
CREATE TABLE IF NOT EXISTS public.email_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_connection_id UUID NOT NULL REFERENCES public.organization_email_connections(id) ON DELETE CASCADE,
  from_email TEXT,
  thread_subject TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_conversations_organization_id ON public.email_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_conversations_email_connection_id ON public.email_conversations(email_connection_id);
CREATE INDEX IF NOT EXISTS idx_email_conversations_last_message_at ON public.email_conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.email_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org email conversations"
  ON public.email_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = email_conversations.organization_id)
  );

CREATE POLICY "Users can insert own org email conversations"
  ON public.email_conversations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id)
  );

CREATE POLICY "Users can update own org email conversations"
  ON public.email_conversations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = email_conversations.organization_id)
  );

-- Email messages (inbound/outbound).
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.email_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body TEXT,
  confirmation_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_conversation_id ON public.email_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON public.email_messages(created_at);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org email messages"
  ON public.email_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = email_messages.conversation_id
    )
  );

CREATE POLICY "Users can insert own org email messages"
  ON public.email_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = email_messages.conversation_id
    )
  );

CREATE OR REPLACE FUNCTION update_email_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_conversations_updated_at
  BEFORE UPDATE ON public.email_conversations
  FOR EACH ROW EXECUTE FUNCTION update_email_conversations_updated_at();

COMMENT ON TABLE public.email_conversations IS 'Email threads per connection. Shown in Live Chat alongside WhatsApp/Instagram.';
COMMENT ON COLUMN public.email_messages.confirmation_code IS 'Extracted from Gmail verification email body; user copies to Gmail forwarding settings.';


-- === 20250204000002_add_get_email_conversations_with_preview_rpc.sql ===

-- RPC: return email conversations with last message preview (for Live Chat list).
CREATE OR REPLACE FUNCTION public.get_email_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  email_connection_id UUID,
  from_email TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  email_connection_display TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.email_connection_id,
    c.from_email,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    COALESCE(NULLIF(TRIM(conn.email_address), ''), conn.inbound_address)::TEXT AS email_connection_display,
    c.created_at,
    c.updated_at
  FROM email_conversations c
  JOIN organization_email_connections conn ON conn.id = c.email_connection_id AND conn.organization_id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction
    FROM email_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_email_conversations_with_preview(UUID) IS 'Email conversations with preview for Live Chat sidebar.';


-- === create_whatsapp_conversations_and_messages.sql ===
-- (Defined earlier in this bundle after drop legacy whatsapp_config.)


-- === create_organization_whatsapp_config.sql ===

-- WhatsApp Business API config per organization
CREATE TABLE IF NOT EXISTS public.organization_whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    whatsapp_business_account_id TEXT NOT NULL,
    whatsapp_access_token TEXT NOT NULL,
    verify_token TEXT NOT NULL,
    phone_number_id TEXT,
    display_phone_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_org_whatsapp_config UNIQUE (organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_whatsapp_config_verify_token
    ON public.organization_whatsapp_config(verify_token)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_organization_whatsapp_config_organization_id
    ON public.organization_whatsapp_config(organization_id);

ALTER TABLE public.organization_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp config"
    ON public.organization_whatsapp_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_whatsapp_config.organization_id
        )
    );

CREATE POLICY "Users can insert own org whatsapp config"
    ON public.organization_whatsapp_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_id
        )
    );

CREATE POLICY "Users can update own org whatsapp config"
    ON public.organization_whatsapp_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_whatsapp_config.organization_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_id
        )
    );

CREATE POLICY "Users can delete own org whatsapp config"
    ON public.organization_whatsapp_config FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.active_organization_id = organization_whatsapp_config.organization_id
        )
    );

CREATE OR REPLACE FUNCTION update_organization_whatsapp_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_whatsapp_config_updated_at
    BEFORE UPDATE ON public.organization_whatsapp_config
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_whatsapp_config_updated_at();


-- === add_whatsapp_conversation_last_message_body.sql ===

-- Show last message content in conversation list instead of phone number
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS last_message_body TEXT;


-- === add_whatsapp_conversation_last_opened_at.sql ===

-- Track when a conversation was last opened in livechat (for leads-management "Status" column)
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.whatsapp_conversations.last_opened_at IS 'Set when user opens this conversation in /operations/consultant/all/livechat';


-- === add_whatsapp_message_read_at.sql ===

-- Add read_at for inbound messages so we can show unread per conversation
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_read_at ON public.whatsapp_messages(conversation_id, read_at) WHERE direction = 'inbound';


-- === add_whatsapp_message_status.sql ===

ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id ON public.whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;


-- === add_whatsapp_messages_delete_policy.sql ===

-- Allow users to delete messages in conversations of their active organization (e.g. from chat dropdown "Hapus")
CREATE POLICY "Users can delete own org whatsapp messages"
  ON public.whatsapp_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = whatsapp_messages.conversation_id
    )
  );


-- === add_whatsapp_unread_rpc.sql ===

-- RPC: return unread count per conversation for an organization
CREATE OR REPLACE FUNCTION public.get_whatsapp_unread_counts(p_organization_id UUID)
RETURNS TABLE(conversation_id UUID, unread_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM whatsapp_conversations c
  LEFT JOIN whatsapp_messages m ON m.conversation_id = c.id AND m.direction = 'inbound' AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id;
$$;

-- RLS: only allow if user belongs to the organization
ALTER FUNCTION public.get_whatsapp_unread_counts(UUID) SET search_path = public;

-- RPC: mark all inbound messages in a conversation as read
CREATE OR REPLACE FUNCTION public.mark_whatsapp_conversation_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id AND direction = 'inbound' AND read_at IS NULL
  AND EXISTS (
    SELECT 1 FROM whatsapp_conversations c
    JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
    WHERE c.id = whatsapp_messages.conversation_id
  );
END;
$$;


-- === add_media_url_to_whatsapp_messages.sql ===

-- Store resolved media URL for preview/thumbnail (outbound: Supabase Storage URL; inbound: our storage after downloading from Meta)
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;

COMMENT ON COLUMN public.whatsapp_messages.media_url IS 'Public URL for image/video/document preview (outbound: storage link we sent; inbound: our storage after downloading from Meta)';


-- === add_reply_to_whatsapp_messages.sql ===

-- Simpan konteks balas agar di UI bisa tampilkan "Balas: [pesan yang dibalas]"
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS reply_to_wa_message_id TEXT,
  ADD COLUMN IF NOT EXISTS reply_to_body TEXT;

COMMENT ON COLUMN public.whatsapp_messages.reply_to_wa_message_id IS 'WhatsApp message ID yang dibalas (context.reply_to)';
COMMENT ON COLUMN public.whatsapp_messages.reply_to_body IS 'Teks/body pesan yang dibalas, untuk ditampilkan di bubble agar tidak bingung';


-- === add_ticket_id_to_whatsapp_conversations.sql ===

-- Ticket ID untuk lead WhatsApp: disimpan di DB, format WA-XXXXXXXX (8 karakter pertama UUID tanpa strip, uppercase).
-- Menggunakan GENERATED column agar otomatis terisi dari id dan konsisten untuk row baru maupun lama.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ticket_id TEXT GENERATED ALWAYS AS (
    'WA-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
  ) STORED;

COMMENT ON COLUMN public.whatsapp_conversations.ticket_id IS 'Ticket ID unik untuk lead WhatsApp (WA-XXXXXXXX), derived dari id.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_ticket_id
  ON public.whatsapp_conversations(ticket_id);


-- === add_whatsapp_business_name_to_config.sql ===

-- Add WhatsApp Business Name to organization_whatsapp_config
ALTER TABLE public.organization_whatsapp_config
ADD COLUMN IF NOT EXISTS whatsapp_business_name TEXT;

COMMENT ON COLUMN public.organization_whatsapp_config.whatsapp_business_name IS 'Display name of the WhatsApp Business as shown in the app';


-- === add_name_status_to_whatsapp_config.sql ===

-- Add name_status (display name verification: APPROVED / DECLINED) to organization_whatsapp_config
ALTER TABLE public.organization_whatsapp_config
ADD COLUMN IF NOT EXISTS name_status TEXT;

COMMENT ON COLUMN public.organization_whatsapp_config.name_status IS 'Meta display name verification: APPROVED or DECLINED';


-- === add_whatsapp_conversation_client_profiles.sql ===

-- Client profile for WhatsApp conversations (same concept as lead_client_profiles for leads).
-- Used by the Client Profile modal when viewing/editing profile for a WhatsApp lead.
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  gender TEXT,
  age INTEGER,
  occupation TEXT,
  location TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_wa_conv_client_profile_conversation UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_client_profiles_conversation_id
  ON public.whatsapp_conversation_client_profiles(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_client_profiles_organization_id
  ON public.whatsapp_conversation_client_profiles(organization_id);

ALTER TABLE public.whatsapp_conversation_client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp conversation client profiles"
  ON public.whatsapp_conversation_client_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_client_profiles.organization_id)
  );

CREATE POLICY "Users can insert own org whatsapp conversation client profiles"
  ON public.whatsapp_conversation_client_profiles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_client_profiles.organization_id)
  );

CREATE POLICY "Users can update own org whatsapp conversation client profiles"
  ON public.whatsapp_conversation_client_profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_client_profiles.organization_id)
  );

COMMENT ON TABLE public.whatsapp_conversation_client_profiles IS 'Client profile (Name, Code, Gender, Age, Occupation, Location) for WhatsApp conversations in Leads Management Client Profile modal.';


-- === add_whatsapp_conversation_cycles_and_tracking.sql ===

-- Resolve-cycle tracking: per-cycle response time and time-to-resolve
-- Cycle = from first inbound (Unread/Open) -> first response (On going) -> resolved (Closed).
-- When same contact chats again after resolve, a new cycle starts.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS first_inbound_at TIMESTAMPTZ;

COMMENT ON COLUMN public.whatsapp_conversations.first_inbound_at IS 'Timestamp of the very first inbound message for this conversation (ever).';

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  cycle_started_at TIMESTAMPTZ NOT NULL,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.whatsapp_conversation_cycles IS 'One row per resolve cycle: from first inbound (Unread) to first agent reply (On going) to resolved (Closed). Reopened chats start a new cycle.';
COMMENT ON COLUMN public.whatsapp_conversation_cycles.cycle_started_at IS 'When this cycle started: first inbound (new conv or after previous resolve).';
COMMENT ON COLUMN public.whatsapp_conversation_cycles.first_response_at IS 'When agent first replied in this cycle (status became On going). Used for response time.';
COMMENT ON COLUMN public.whatsapp_conversation_cycles.resolved_at IS 'When status was set to Closed (Resolve) for this cycle. Used for time-to-resolve.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_cycles_conversation_id
  ON public.whatsapp_conversation_cycles(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_cycles_resolved_at
  ON public.whatsapp_conversation_cycles(resolved_at) WHERE resolved_at IS NOT NULL;

ALTER TABLE public.whatsapp_conversation_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp conversation cycles"
  ON public.whatsapp_conversation_cycles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = whatsapp_conversation_cycles.conversation_id
    )
  );

CREATE POLICY "Users can insert own org whatsapp conversation cycles"
  ON public.whatsapp_conversation_cycles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = whatsapp_conversation_cycles.conversation_id
    )
  );

CREATE POLICY "Users can update own org whatsapp conversation cycles"
  ON public.whatsapp_conversation_cycles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = whatsapp_conversation_cycles.conversation_id
    )
  );

CREATE OR REPLACE FUNCTION update_whatsapp_conversation_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_conversation_cycles_updated_at
  BEFORE UPDATE ON public.whatsapp_conversation_cycles
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_conversation_cycles_updated_at();


-- === add_whatsapp_conversation_follow_up_updates.sql ===

-- Follow-up updates for WhatsApp conversations (same concept as lead_follow_up_updates for leads).
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_follow_up_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  update_details TEXT NOT NULL,
  status TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_follow_up_conversation_id
  ON public.whatsapp_conversation_follow_up_updates(conversation_id);

ALTER TABLE public.whatsapp_conversation_follow_up_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
  );

CREATE POLICY "Users can insert own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
  );

CREATE POLICY "Users can update own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
  );

CREATE POLICY "Users can delete own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id)
  );

COMMENT ON TABLE public.whatsapp_conversation_follow_up_updates IS 'Follow-up updates for WhatsApp conversations in Leads Management Follow Up form.';


-- === add_whatsapp_conversation_followup_and_fu_priority.sql ===

-- Follow Up count and FU Priority for WhatsApp conversations (same as leads table).
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS followup INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fu_priority TEXT;

COMMENT ON COLUMN public.whatsapp_conversations.followup IS 'Number of follow-up updates for this conversation in Leads Management.';
COMMENT ON COLUMN public.whatsapp_conversations.fu_priority IS 'Follow-up priority (Low/Medium/High/Please Follow Up) derived from follow-up updates.';


-- === add_whatsapp_conversation_lead_status_id.sql ===

-- Allow WhatsApp conversations to use the same lead status (Open, In Progress, Qualified, Converted, Lost, Closed)
-- so the Leads Management Status column shows a dropdown for both regular leads and WhatsApp chats.
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS lead_status_id UUID REFERENCES public.lead_statuses(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.whatsapp_conversations.lead_status_id IS 'Lead status (Open/In Progress/Qualified/Converted/Lost/Closed) for this conversation in Leads Management.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_lead_status_id
  ON public.whatsapp_conversations(lead_status_id);


-- === add_whatsapp_conversation_status_history.sql ===

-- Status change history for WhatsApp conversations (same concept as lead_status_history for leads).
-- Used by the Status History modal when viewing history for a WhatsApp lead.
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  notes TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_status_history_conversation_id
  ON public.whatsapp_conversation_status_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_status_history_changed_at
  ON public.whatsapp_conversation_status_history(changed_at DESC);

ALTER TABLE public.whatsapp_conversation_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org whatsapp conversation status history"
  ON public.whatsapp_conversation_status_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_status_history.organization_id)
  );

CREATE POLICY "Users can insert own org whatsapp conversation status history"
  ON public.whatsapp_conversation_status_history FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_status_history.organization_id)
  );

COMMENT ON TABLE public.whatsapp_conversation_status_history IS 'Status change history for WhatsApp conversations shown in Leads Management Status History modal.';


-- === add_assignee_id_to_leads_and_whatsapp.sql ===

-- Assignee ownership: only the assigned agent sees the lead/chat in their "room".
-- No new tables; add assignee_id (FK to employees) so we can filter by current user's employee.

-- 1) leads: add assignee_id (keep assignee text for display/backward compatibility)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assignee_id ON public.leads(assignee_id);
COMMENT ON COLUMN public.leads.assignee_id IS 'Employee responsible for this lead; only this agent sees it in their room.';

-- 2) whatsapp_conversations: add assignee_id
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_assignee_id ON public.whatsapp_conversations(assignee_id);
COMMENT ON COLUMN public.whatsapp_conversations.assignee_id IS 'Employee responsible for this conversation; only this agent sees it in their room.';


-- === add_get_conversations_with_preview_rpc.sql ===

-- RPC: return conversations with last_message_at and last_message_body from actual latest message
-- So preview is always correct (source of truth = whatsapp_messages)
-- DROP required: return type is narrower than the version from add_phone_number_id_to_conversations_preview_rpc.
DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN LATERAL (
    SELECT created_at, body
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;


-- === add_lead_status_to_conversations_preview_rpc.sql ===

-- Extend get_whatsapp_conversations_with_preview to return lead_status_id and lead_status_name
-- so ChatThread can block outbound when status is Closed (Resolve).
DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;


-- === add_last_message_direction_status_to_conversations_rpc.sql ===

-- Extend get_whatsapp_conversations_with_preview to return last message direction and status (for checklist in list)
DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;


-- === add_search_whatsapp_messages_rpc.sql ===

-- RPC: return message-level search results (seperti WhatsApp - setiap baris = satu pesan yang cocok, untuk highlight keyword)
CREATE OR REPLACE FUNCTION public.search_whatsapp_messages(
  p_organization_id UUID,
  p_search TEXT
)
RETURNS TABLE (
  conversation_id UUID,
  message_id UUID,
  body TEXT,
  created_at TIMESTAMPTZ,
  direction TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversation_id,
    m.id AS message_id,
    LEFT(m.body, 300) AS body,
    m.created_at,
    m.direction::TEXT
  FROM whatsapp_conversations c
  INNER JOIN whatsapp_messages m ON m.conversation_id = c.id
  WHERE c.organization_id = p_organization_id
    AND p_search IS NOT NULL
    AND length(trim(p_search)) > 0
    AND m.body IS NOT NULL
    AND m.body ILIKE '%' || trim(p_search) || '%'
  ORDER BY m.created_at DESC
  LIMIT 500;
$$;


-- === add_search_whatsapp_conversations_by_message_body.sql ===

-- RPC: return conversation IDs that have at least one message whose body matches the search (untuk search di seluruh isi chat, bukan hanya last message)
CREATE OR REPLACE FUNCTION public.get_whatsapp_conversation_ids_by_message_search(
  p_organization_id UUID,
  p_search TEXT
)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT c.id
  FROM whatsapp_conversations c
  INNER JOIN whatsapp_messages m ON m.conversation_id = c.id
  WHERE c.organization_id = p_organization_id
    AND p_search IS NOT NULL
    AND length(trim(p_search)) > 0
    AND m.body IS NOT NULL
    AND m.body ILIKE '%' || trim(p_search) || '%';
$$;


-- === add_whatsapp_cycle_metrics_rpc.sql ===

-- RPC: return cycle rows with conversation assignee for Leads Management metrics.
-- Frontend can filter by date and compute avg response time / avg time to resolve per assignee.
CREATE OR REPLACE FUNCTION public.get_whatsapp_cycle_metrics(p_organization_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  assignee_id UUID,
  cycle_started_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cy.conversation_id,
    c.assignee_id,
    cy.cycle_started_at,
    cy.first_response_at,
    cy.resolved_at
  FROM whatsapp_conversation_cycles cy
  JOIN whatsapp_conversations c ON c.id = cy.conversation_id
  WHERE c.organization_id = p_organization_id
  ORDER BY cy.cycle_started_at DESC;
$$;

COMMENT ON FUNCTION public.get_whatsapp_cycle_metrics(UUID) IS 'Returns WhatsApp conversation cycles with assignee for response time and time-to-resolve metrics in Leads Management.';


-- === enable_realtime_whatsapp_conversations.sql ===

-- Enable Realtime for whatsapp_conversations so list updates when last_message_at/last_message_body change
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_conversations'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  END IF;
END $$;


-- === enable_realtime_whatsapp_messages.sql ===

-- Enable Realtime for whatsapp_messages so clients can subscribe to INSERT/UPDATE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_messages'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
END $$;


-- === 20250205000000_instagram_display_name_in_conversations_preview_rpc.sql ===

-- Show connected Instagram account name (e.g. @octa.vialdi) in conversation list instead of generic "Instagram".
-- whatsapp_account_display_name: for Instagram use organization_meta_config.instagram_username / instagram_name.
DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  channel TEXT,
  phone_number_id TEXT,
  whatsapp_account_display_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    COALESCE(c.channel, 'whatsapp') AS channel,
    c.phone_number_id,
    (
      CASE WHEN COALESCE(c.channel, 'whatsapp') = 'instagram' THEN
        COALESCE(
          CASE WHEN meta.instagram_username IS NOT NULL AND TRIM(meta.instagram_username) <> '' THEN '@' || TRIM(meta.instagram_username) END,
          NULLIF(TRIM(COALESCE(meta.instagram_name, '')), '')
        )
      ELSE
        COALESCE(
          NULLIF(TRIM(a.whatsapp_business_name), ''),
          NULLIF(TRIM(a.display_phone_number), ''),
          a.phone_number_id
        )
      END
    )::TEXT AS whatsapp_account_display_name,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN organization_meta_config meta ON meta.organization_id = c.organization_id
  LEFT JOIN organization_whatsapp_accounts a
    ON a.organization_id = c.organization_id
   AND a.phone_number_id = c.phone_number_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;


-- === 20250206000000_auto_sync_fu_priority_from_lead_follow_up_updates.sql ===

-- Auto-sync followup count and fu_priority to whatsapp_conversations and leads
-- when lead_follow_up_updates changes (so FU Priority updates without opening the dialog).
-- Logic: same as client (Hot/Warm/Cold percentage; tie-break Hot > Warm > Cold).

CREATE OR REPLACE FUNCTION public.sync_follow_up_priority_for_conversation(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hot_cnt int;
  warm_cnt int;
  cold_cnt int;
  total_cnt int;
  fp text;
BEGIN
  IF p_conv_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'hot prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'warm prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'cold prospect'),
    COUNT(*)
  INTO hot_cnt, warm_cnt, cold_cnt, total_cnt
  FROM lead_follow_up_updates
  WHERE conversation_id = p_conv_id;

  IF total_cnt = 0 THEN fp := NULL;
  ELSIF (hot_cnt::float / total_cnt) >= (warm_cnt::float / total_cnt) AND (hot_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND hot_cnt > 0 THEN fp := 'High';
  ELSIF (warm_cnt::float / total_cnt) >= (hot_cnt::float / total_cnt) AND (warm_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND warm_cnt > 0 THEN fp := 'Medium';
  ELSIF cold_cnt > 0 THEN fp := 'Low';
  ELSE fp := NULL;
  END IF;

  UPDATE whatsapp_conversations
  SET followup = total_cnt, fu_priority = fp, updated_at = NOW()
  WHERE id = p_conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_follow_up_priority_for_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hot_cnt int;
  warm_cnt int;
  cold_cnt int;
  total_cnt int;
  fp text;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'hot prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'warm prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'cold prospect'),
    COUNT(*)
  INTO hot_cnt, warm_cnt, cold_cnt, total_cnt
  FROM lead_follow_up_updates
  WHERE lead_id = p_lead_id;

  IF total_cnt = 0 THEN fp := NULL;
  ELSIF (hot_cnt::float / total_cnt) >= (warm_cnt::float / total_cnt) AND (hot_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND hot_cnt > 0 THEN fp := 'High';
  ELSIF (warm_cnt::float / total_cnt) >= (hot_cnt::float / total_cnt) AND (warm_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND warm_cnt > 0 THEN fp := 'Medium';
  ELSIF cold_cnt > 0 THEN fp := 'Low';
  ELSE fp := NULL;
  END IF;

  UPDATE leads
  SET followup = total_cnt, fu_priority = fp, updated_at = NOW()
  WHERE id = p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sync_follow_up_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_follow_up_priority_for_conversation(OLD.conversation_id);
    PERFORM sync_follow_up_priority_for_lead(OLD.lead_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM sync_follow_up_priority_for_conversation(NEW.conversation_id);
    PERFORM sync_follow_up_priority_for_lead(NEW.lead_id);
    RETURN NEW;
  ELSE
    PERFORM sync_follow_up_priority_for_conversation(NEW.conversation_id);
    PERFORM sync_follow_up_priority_for_conversation(OLD.conversation_id);
    PERFORM sync_follow_up_priority_for_lead(NEW.lead_id);
    PERFORM sync_follow_up_priority_for_lead(OLD.lead_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS sync_fu_priority_after_lead_follow_up_updates ON public.lead_follow_up_updates;
CREATE TRIGGER sync_fu_priority_after_lead_follow_up_updates
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_follow_up_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_follow_up_priority();


-- === 20250206000000_email_conversations_lead_status_and_follow_up.sql ===

-- Add lead_status_id, followup, fu_priority to email_conversations (same as whatsapp_conversations)
-- so Quick Action panel and Leads Management behave the same for email.

ALTER TABLE public.email_conversations
  ADD COLUMN IF NOT EXISTS lead_status_id UUID REFERENCES public.lead_statuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS followup INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fu_priority TEXT;

COMMENT ON COLUMN public.email_conversations.lead_status_id IS 'Lead status (Open/In Progress/Qualified/Converted/Lost/Closed) for Quick Action and Leads Management.';
COMMENT ON COLUMN public.email_conversations.followup IS 'Number of follow-up updates for this conversation.';
COMMENT ON COLUMN public.email_conversations.fu_priority IS 'Follow-up priority (Low/Medium/High) derived from follow-up updates.';

CREATE INDEX IF NOT EXISTS idx_email_conversations_lead_status_id
  ON public.email_conversations(lead_status_id);

-- Follow-up updates for email conversations (same concept as whatsapp_conversation_follow_up_updates)
CREATE TABLE IF NOT EXISTS public.email_conversation_follow_up_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.email_conversations(id) ON DELETE CASCADE,
  update_details TEXT NOT NULL,
  status TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_conv_follow_up_conversation_id
  ON public.email_conversation_follow_up_updates(conversation_id);

ALTER TABLE public.email_conversation_follow_up_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

CREATE POLICY "Users can insert own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

CREATE POLICY "Users can update own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

CREATE POLICY "Users can delete own org email conversation follow up updates"
  ON public.email_conversation_follow_up_updates FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = email_conversation_follow_up_updates.organization_id)
  );

COMMENT ON TABLE public.email_conversation_follow_up_updates IS 'Follow-up updates for email conversations in Quick Action and Leads Management.';

-- Must DROP before changing return type (PostgreSQL does not allow changing OUT params with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.get_email_conversations_with_preview(uuid);

-- Recreate with lead_status_id, followup, fu_priority in return (for Leads Management and Quick Action)
CREATE OR REPLACE FUNCTION public.get_email_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  email_connection_id UUID,
  from_email TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  email_connection_display TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  lead_status_id UUID,
  followup INTEGER,
  fu_priority TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.email_connection_id,
    c.from_email,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    COALESCE(NULLIF(TRIM(conn.email_address), ''), conn.inbound_address)::TEXT AS email_connection_display,
    c.created_at,
    c.updated_at,
    c.lead_status_id,
    COALESCE(c.followup, 0),
    c.fu_priority
  FROM email_conversations c
  JOIN organization_email_connections conn ON conn.id = c.email_connection_id AND conn.organization_id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction
    FROM email_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_email_conversations_with_preview(uuid) IS 'Email conversations with preview for Live Chat and Leads Management.';


-- === 20250206000001_auto_resolve_email_conversations_after_24h.sql ===

-- Auto-resolve email conversations after 24 hours from last message (same concept as WhatsApp).
-- Run this function periodically (e.g. every hour via pg_cron or a scheduled Edge Function).

CREATE OR REPLACE FUNCTION public.auto_resolve_email_conversations_after_24h()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  in_progress_id UUID;
  closed_id UUID;
  updated_count INTEGER := 0;
BEGIN
  SELECT id INTO in_progress_id FROM lead_statuses WHERE name = 'In Progress' LIMIT 1;
  SELECT id INTO closed_id FROM lead_statuses WHERE name = 'Closed' LIMIT 1;

  IF in_progress_id IS NULL OR closed_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH updated AS (
    UPDATE email_conversations
    SET lead_status_id = closed_id, updated_at = NOW()
    WHERE lead_status_id = in_progress_id
      AND last_message_at IS NOT NULL
      AND last_message_at < (NOW() - INTERVAL '24 hours')
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO updated_count FROM updated;

  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.auto_resolve_email_conversations_after_24h() IS
  'Sets email_conversations to Closed (Resolved) when status is In Progress and last_message_at is older than 24 hours. Schedule with pg_cron or call from a scheduled job.';

-- Example: schedule with pg_cron (run every hour) - uncomment if pg_cron is enabled:
-- SELECT cron.schedule('auto-resolve-email-24h', '0 * * * *', 'SELECT auto_resolve_email_conversations_after_24h()');


-- === 20250206000002_normalize_email_conversations_from_email.sql ===

-- Normalize from_email to lowercase so email-inbound lookup (one room per sender) finds existing conversations.
UPDATE public.email_conversations
SET from_email = LOWER(TRIM(from_email))
WHERE from_email IS NOT NULL
  AND from_email <> LOWER(TRIM(from_email));

COMMENT ON COLUMN public.email_conversations.from_email IS 'Sender email (normalized lowercase). One conversation per (email_connection_id, from_email).';


-- === 20250206000003_add_cc_bcc_to_email_messages.sql ===

-- Add cc and bcc columns to email_messages for outbound replies (Gmail-style compose).
-- Values are stored when user sends with CC/BCC so we have a record per message.
ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS cc TEXT,
  ADD COLUMN IF NOT EXISTS bcc TEXT;

COMMENT ON COLUMN public.email_messages.cc IS 'CC recipients for outbound message (comma-separated if multiple).';
COMMENT ON COLUMN public.email_messages.bcc IS 'BCC recipients for outbound message (comma-separated if multiple).';


-- === 20250206000004_add_from_display_name_to_email.sql ===

-- Add from_display_name so we show "Nama akun email" instead of raw email in list and thread.
-- Parsed from From header: "Display Name <email@example.com>" -> from_display_name = "Display Name", from_email = "email@example.com"

ALTER TABLE public.email_conversations
  ADD COLUMN IF NOT EXISTS from_display_name TEXT;

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS from_display_name TEXT;

COMMENT ON COLUMN public.email_conversations.from_display_name IS 'Sender display name from From header (e.g. "Octa Vialdi"). Shown in Live Chat list instead of email.';
COMMENT ON COLUMN public.email_messages.from_display_name IS 'Sender display name from From header for this message. Shown in thread instead of email.';

-- Include from_display_name in RPC so list shows nama akun
DROP FUNCTION IF EXISTS public.get_email_conversations_with_preview(uuid);
CREATE OR REPLACE FUNCTION public.get_email_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  email_connection_id UUID,
  from_email TEXT,
  from_display_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  email_connection_display TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  lead_status_id UUID,
  followup INTEGER,
  fu_priority TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.email_connection_id,
    c.from_email,
    c.from_display_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    COALESCE(NULLIF(TRIM(conn.email_address), ''), conn.inbound_address)::TEXT AS email_connection_display,
    c.created_at,
    c.updated_at,
    c.lead_status_id,
    COALESCE(c.followup, 0),
    c.fu_priority
  FROM email_conversations c
  JOIN organization_email_connections conn ON conn.id = c.email_connection_id AND conn.organization_id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction
    FROM email_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  ORDER BY m.created_at DESC NULLS LAST;
$$;
COMMENT ON FUNCTION public.get_email_conversations_with_preview(uuid) IS 'Email conversations with preview for Live Chat and Leads Management.';


-- === 20250206000005_email_unread_badge.sql ===

-- Email unread badge (like WhatsApp): read_at on messages, RPCs for count and mark read.

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.email_messages.read_at IS 'When the inbound message was read in Live Chat (NULL = unread). Used for unread badge.';

-- RPC: return unread count per email conversation for an organization (inbound messages with read_at IS NULL)
CREATE OR REPLACE FUNCTION public.get_email_unread_counts(p_organization_id UUID)
RETURNS TABLE(conversation_id UUID, unread_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM email_conversations c
  LEFT JOIN email_messages m ON m.conversation_id = c.id AND m.direction = 'inbound' AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id
  HAVING COUNT(m.id) > 0;
$$;

COMMENT ON FUNCTION public.get_email_unread_counts(UUID) IS 'Unread count per email conversation for Live Chat badge (inbound messages not yet read).';

-- RPC: mark all inbound messages in an email conversation as read
CREATE OR REPLACE FUNCTION public.mark_email_conversation_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE email_messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id AND direction = 'inbound' AND read_at IS NULL
  AND EXISTS (
    SELECT 1 FROM email_conversations c
    JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
    WHERE c.id = email_messages.conversation_id
  );
END;
$$;

COMMENT ON FUNCTION public.mark_email_conversation_read(UUID) IS 'Mark all inbound email messages in conversation as read (for unread badge).';


-- === 20250207000000_add_verify_token_to_organization_whatsapp_accounts.sql ===

-- Move verify_token to organization_whatsapp_accounts (webhook GET reads from here).
-- One value per org; stored on first account. organization_meta_config still holds it for legacy/fallback.

ALTER TABLE public.organization_whatsapp_accounts
  ADD COLUMN IF NOT EXISTS verify_token TEXT DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_whatsapp_accounts_verify_token
  ON public.organization_whatsapp_accounts(verify_token)
  WHERE verify_token IS NOT NULL AND trim(verify_token) <> '';

COMMENT ON COLUMN public.organization_whatsapp_accounts.verify_token IS 'Meta webhook Verify Token for this org. Used in GET hub.verify_token; one value per org (e.g. on first account).';

-- Backfill from organization_meta_config to first account per org
UPDATE public.organization_whatsapp_accounts a
SET verify_token = COALESCE(trim(m.verify_token), '')
FROM public.organization_meta_config m
WHERE m.organization_id = a.organization_id
  AND COALESCE(trim(m.verify_token), '') <> ''
  AND a.id = (
    SELECT id FROM public.organization_whatsapp_accounts a2
    WHERE a2.organization_id = m.organization_id AND (a2.is_active = true OR a2.is_active IS NULL)
    ORDER BY a2.created_at ASC NULLS LAST
    LIMIT 1
  );


-- === 20250210000000_ensure_organization_meta_config_and_whatsapp_accounts.sql ===

-- Ensure organization_meta_config exists (fixes 404 from useWhatsAppConfig / WhatsAppConnectForm).
-- Ensure organization_whatsapp_accounts exists with expected schema.

-- 1) organization_meta_config: create if not exists (centralized Meta token + WhatsApp/Instagram per org)
CREATE TABLE IF NOT EXISTS public.organization_meta_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meta_access_token TEXT NOT NULL DEFAULT '',
  meta_business_manager_id TEXT,
  whatsapp_business_account_id TEXT NOT NULL DEFAULT '',
  verify_token TEXT NOT NULL DEFAULT '',
  phone_number_id TEXT,
  display_phone_number TEXT,
  whatsapp_business_name TEXT,
  name_status TEXT,
  facebook_page_id TEXT,
  facebook_verify_token TEXT,
  instagram_business_account_id TEXT,
  instagram_verify_token TEXT,
  instagram_username TEXT,
  instagram_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_org_meta_config UNIQUE (organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_meta_config_verify_token
  ON public.organization_meta_config(verify_token)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_organization_meta_config_organization_id
  ON public.organization_meta_config(organization_id);

ALTER TABLE public.organization_meta_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can view own org meta config"
  ON public.organization_meta_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_meta_config.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can insert own org meta config"
  ON public.organization_meta_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can update own org meta config"
  ON public.organization_meta_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_meta_config.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org meta config" ON public.organization_meta_config;
CREATE POLICY "Users can delete own org meta config"
  ON public.organization_meta_config FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_meta_config.organization_id
    )
  );

CREATE OR REPLACE FUNCTION update_organization_meta_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_organization_meta_config_updated_at ON public.organization_meta_config;
CREATE TRIGGER trigger_organization_meta_config_updated_at
  BEFORE UPDATE ON public.organization_meta_config
  FOR EACH ROW EXECUTE FUNCTION update_organization_meta_config_updated_at();


-- 2) organization_whatsapp_accounts: create if not exists (schema as requested)
CREATE TABLE IF NOT EXISTS public.organization_whatsapp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  whatsapp_business_account_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  meta_access_token TEXT NULL,
  display_phone_number TEXT NULL,
  whatsapp_business_name TEXT NULL,
  name_status TEXT NULL,
  is_active BOOLEAN NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT organization_whatsapp_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT uq_org_whatsapp_account_phone UNIQUE (organization_id, phone_number_id),
  CONSTRAINT organization_whatsapp_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organization_whatsapp_accounts_organization_id
  ON public.organization_whatsapp_accounts(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_whatsapp_accounts_phone_number_id
  ON public.organization_whatsapp_accounts(phone_number_id);

ALTER TABLE public.organization_whatsapp_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can view own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can insert own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can update own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org whatsapp accounts" ON public.organization_whatsapp_accounts;
CREATE POLICY "Users can delete own org whatsapp accounts"
  ON public.organization_whatsapp_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_whatsapp_accounts.organization_id
    )
  );

CREATE OR REPLACE FUNCTION update_organization_whatsapp_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_organization_whatsapp_accounts_updated_at ON public.organization_whatsapp_accounts;
CREATE TRIGGER trigger_organization_whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.organization_whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION update_organization_whatsapp_accounts_updated_at();

COMMENT ON TABLE public.organization_whatsapp_accounts IS 'WhatsApp Business API accounts per organization. Max 5 per org (enforced in app).';


-- === 20250210000001_backfill_leads_from_conversations.sql ===

-- Backfill leads from existing whatsapp_conversations and email_conversations.
-- Auto-insert only runs when a NEW conversation is created in the webhook; existing rows never got a lead.

-- Default status: Open or Unread (webhook uses "Open", DB may have "Unread")
DO $$
DECLARE
  default_status_id UUID;
  conv RECORD;
  conv_ticket_id TEXT;
  conv_client TEXT;
  conv_title TEXT;
  conv_source TEXT;
BEGIN
  SELECT id INTO default_status_id
  FROM lead_statuses
  WHERE name IN ('Open', 'Unread') AND is_active = TRUE
  LIMIT 1;

  IF default_status_id IS NULL THEN
    RAISE NOTICE 'No Open/Unread status in lead_statuses, skip backfill';
    RETURN;
  END IF;

  -- WhatsApp/Instagram conversations (ticket_id is GENERATED WA-xxx)
  FOR conv IN
    SELECT w.id, w.organization_id, w.channel, w.customer_name, w.customer_wa_id, w.last_message_body, w.ticket_id AS conv_ticket_id
    FROM whatsapp_conversations w
    WHERE NOT EXISTS (
      SELECT 1 FROM leads l
      WHERE l.ticket_id = w.ticket_id AND l.organization_id = w.organization_id
    )
  LOOP
    conv_ticket_id := conv.conv_ticket_id;
    conv_client := NULLIF(TRIM(COALESCE(conv.customer_name, conv.customer_wa_id, '')), '');
    conv_client := COALESCE(conv_client, CASE WHEN LOWER(COALESCE(conv.channel, '')) = 'instagram' THEN 'Instagram' ELSE 'WhatsApp' END);
    conv_title := LEFT(REGEXP_REPLACE(COALESCE(conv.last_message_body, ''), '<[^>]*>', ' ', 'g'), 100);
    conv_title := COALESCE(NULLIF(TRIM(conv_title), ''), CASE WHEN LOWER(COALESCE(conv.channel, '')) = 'instagram' THEN 'Instagram' ELSE 'WhatsApp' END);
    conv_source := CASE WHEN LOWER(COALESCE(conv.channel, '')) = 'instagram' THEN 'Instagram' ELSE 'WhatsApp' END;

    INSERT INTO leads (
      ticket_id, client, title, category, created_by, created_by_name, assignee,
      status_id, organization_id, source, services, followup, phone_number
    ) VALUES (
      conv_ticket_id,
      conv_client,
      conv_title,
      '',
      '00000000-0000-0000-0000-000000000000'::UUID,
      'System',
      '',
      default_status_id,
      conv.organization_id,
      conv_source,
      NULL,
      0,
      CASE WHEN LOWER(COALESCE(conv.channel, '')) = 'whatsapp' AND conv.customer_wa_id IS NOT NULL AND TRIM(conv.customer_wa_id) <> '' THEN TRIM(conv.customer_wa_id) ELSE NULL END
    )
    ON CONFLICT (ticket_id) DO NOTHING;
  END LOOP;

  -- Email conversations (ticket_id = EMAIL- + first 8 chars of id)
  FOR conv IN
    SELECT c.id, c.organization_id, c.from_email, c.from_display_name, c.thread_subject
    FROM email_conversations c
    WHERE NOT EXISTS (
      SELECT 1 FROM leads l
      WHERE l.ticket_id = 'EMAIL-' || UPPER(SUBSTRING(REPLACE(c.id::TEXT, '-', ''), 1, 8))
        AND l.organization_id = c.organization_id
    )
  LOOP
    conv_ticket_id := 'EMAIL-' || UPPER(SUBSTRING(REPLACE(conv.id::TEXT, '-', ''), 1, 8));
    conv_client := NULLIF(TRIM(COALESCE(conv.from_display_name, conv.from_email, '')), '');
    conv_client := COALESCE(conv_client, 'Email');
    conv_title := LEFT(REGEXP_REPLACE(COALESCE(conv.thread_subject, ''), '<[^>]*>', ' ', 'g'), 100);
    conv_title := COALESCE(NULLIF(TRIM(conv_title), ''), 'Email');

    INSERT INTO leads (
      ticket_id, client, title, category, created_by, created_by_name, assignee,
      status_id, organization_id, source, services, followup
    ) VALUES (
      conv_ticket_id,
      conv_client,
      conv_title,
      '',
      '00000000-0000-0000-0000-000000000000'::UUID,
      'System',
      '',
      default_status_id,
      conv.organization_id,
      'Email',
      NULL,
      0
    )
    ON CONFLICT (ticket_id) DO NOTHING;
  END LOOP;
END $$;


-- === 20250210000002_backfill_leads_phone_number_from_whatsapp.sql ===

-- Backfill leads.phone_number from whatsapp_conversations.customer_wa_id when source = WhatsApp.
UPDATE leads l
SET phone_number = w.customer_wa_id
FROM whatsapp_conversations w
WHERE l.ticket_id = w.ticket_id
  AND l.organization_id = w.organization_id
  AND l.source = 'WhatsApp'
  AND (l.phone_number IS NULL OR l.phone_number = '')
  AND w.customer_wa_id IS NOT NULL
  AND TRIM(w.customer_wa_id) <> '';


-- === 20250210000003_migrate_wa_follow_ups_to_lead_status_history.sql ===

-- Add conversation_id to lead_status_history (FK to whatsapp_conversations).
ALTER TABLE public.lead_status_history
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lead_status_history_conversation_id
  ON public.lead_status_history(conversation_id);

COMMENT ON COLUMN public.lead_status_history.conversation_id IS 'When set, this history row is from a WhatsApp/Instagram conversation follow-up (migrated from whatsapp_conversation_follow_up_updates).';

-- Allow edit/delete for own org (used by Lead Follow Up form).
DROP POLICY IF EXISTS "Users can update own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can update own org lead status history"
  ON public.lead_status_history FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id));

DROP POLICY IF EXISTS "Users can delete own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can delete own org lead status history"
  ON public.lead_status_history FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id));

-- Migrate existing rows only if old table still exists (idempotent: safe when table was already dropped).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_conversation_follow_up_updates') THEN
    INSERT INTO public.lead_status_history (
      lead_id,
      conversation_id,
      old_status,
      new_status,
      changed_at,
      changed_by,
      changed_by_name,
      notes,
      organization_id,
      created_at
    )
    SELECT
      l.id,
      f.conversation_id,
      NULL,
      COALESCE(NULLIF(TRIM(f.status), ''), 'Follow-up'),
      COALESCE(f.created_at, NOW()),
      f.created_by,
      f.created_by_name,
      f.update_details,
      f.organization_id,
      COALESCE(f.created_at, NOW())
    FROM public.whatsapp_conversation_follow_up_updates f
    JOIN public.whatsapp_conversations w ON w.id = f.conversation_id
    JOIN public.leads l ON l.ticket_id = w.ticket_id AND l.organization_id = f.organization_id;
    DROP TABLE IF EXISTS public.whatsapp_conversation_follow_up_updates;
  END IF;
END $$;


-- === 20250210000004_revert_wa_follow_ups_from_lead_status_history.sql ===

-- Revert: restore whatsapp_conversation_follow_up_updates and undo changes to lead_status_history.

-- 1. Re-create whatsapp_conversation_follow_up_updates (restore dropped table)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_follow_up_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  update_details TEXT NOT NULL,
  status TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_follow_up_conversation_id
  ON public.whatsapp_conversation_follow_up_updates(conversation_id);

ALTER TABLE public.whatsapp_conversation_follow_up_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates;
CREATE POLICY "Users can view own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id));

DROP POLICY IF EXISTS "Users can insert own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates;
CREATE POLICY "Users can insert own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id));

DROP POLICY IF EXISTS "Users can update own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates;
CREATE POLICY "Users can update own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id));

DROP POLICY IF EXISTS "Users can delete own org whatsapp conversation follow up updates" ON public.whatsapp_conversation_follow_up_updates;
CREATE POLICY "Users can delete own org whatsapp conversation follow up updates"
  ON public.whatsapp_conversation_follow_up_updates FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = whatsapp_conversation_follow_up_updates.organization_id));

COMMENT ON TABLE public.whatsapp_conversation_follow_up_updates IS 'Follow-up updates for WhatsApp conversations in Leads Management Follow Up form.';

-- 2. Copy data from lead_status_history (where conversation_id IS NOT NULL) back to whatsapp_conversation_follow_up_updates
INSERT INTO public.whatsapp_conversation_follow_up_updates (id, conversation_id, update_details, status, created_by, created_by_name, organization_id, created_at)
SELECT id, conversation_id, COALESCE(notes, ''), new_status, changed_by, changed_by_name, organization_id, COALESCE(changed_at, NOW())
FROM public.lead_status_history
WHERE conversation_id IS NOT NULL
  AND changed_by IS NOT NULL;

-- 3. Delete migrated rows from lead_status_history
DELETE FROM public.lead_status_history WHERE conversation_id IS NOT NULL;

-- 4. Drop column conversation_id and index from lead_status_history
DROP INDEX IF EXISTS public.idx_lead_status_history_conversation_id;
ALTER TABLE public.lead_status_history DROP COLUMN IF EXISTS conversation_id;

-- 5. Drop the UPDATE/DELETE policies we added on lead_status_history
DROP POLICY IF EXISTS "Users can update own org lead status history" ON public.lead_status_history;
DROP POLICY IF EXISTS "Users can delete own org lead status history" ON public.lead_status_history;


-- === 20250210000005_migrate_wa_follow_ups_to_lead_follow_up_updates.sql ===

-- Add conversation_id to lead_follow_up_updates (FK to whatsapp_conversations).
ALTER TABLE public.lead_follow_up_updates
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lead_follow_up_updates_conversation_id
  ON public.lead_follow_up_updates(conversation_id);

COMMENT ON COLUMN public.lead_follow_up_updates.conversation_id IS 'When set, this row is from a WhatsApp/Instagram conversation follow-up (migrated from whatsapp_conversation_follow_up_updates).';

-- Migrate existing rows: whatsapp_conversation_follow_up_updates -> lead_follow_up_updates.
-- Only migrate where we have a matching lead (by ticket_id).
INSERT INTO public.lead_follow_up_updates (
  lead_id,
  conversation_id,
  update_details,
  status,
  created_by,
  created_by_name,
  organization_id,
  created_at
)
SELECT
  l.id,
  f.conversation_id,
  f.update_details,
  f.status,
  f.created_by,
  f.created_by_name,
  f.organization_id,
  COALESCE(f.created_at, NOW())
FROM public.whatsapp_conversation_follow_up_updates f
JOIN public.whatsapp_conversations w ON w.id = f.conversation_id
JOIN public.leads l ON l.ticket_id = w.ticket_id AND l.organization_id = f.organization_id;

-- Drop the old table.
DROP TABLE IF EXISTS public.whatsapp_conversation_follow_up_updates;


-- === 20250215000000_livechat_status_clv_and_auto_resolve.sql ===

-- Livechat status flow: last_inbound_at, lead_id on sales_activities, unified auto-resolve 24h
-- Plan: Quick Action status sync to leads, sales_activities on Converted, auto-Resolve after 24h

-- 1. Add last_inbound_at to whatsapp_conversations and email_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN public.whatsapp_conversations.last_inbound_at IS 'Timestamp of last inbound message; used for 24h auto-resolve to Closed.';

ALTER TABLE public.email_conversations
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN public.email_conversations.last_inbound_at IS 'Timestamp of last inbound message; used for 24h auto-resolve to Closed.';

-- Backfill whatsapp_conversations.last_inbound_at from whatsapp_messages (max created_at where direction = inbound)
UPDATE public.whatsapp_conversations w
SET last_inbound_at = sub.max_at
FROM (
  SELECT conversation_id, MAX(created_at) AS max_at
  FROM public.whatsapp_messages
  WHERE direction = 'inbound'
  GROUP BY conversation_id
) sub
WHERE w.id = sub.conversation_id
  AND w.last_inbound_at IS NULL;

-- Backfill email_conversations: assume last_message_at is last customer message (inbound)
UPDATE public.email_conversations
SET last_inbound_at = last_message_at
WHERE last_inbound_at IS NULL AND last_message_at IS NOT NULL;

-- 2. Add lead_id to sales_activities for CLV (skip if sales_activities not deployed yet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_activities'
  ) THEN
    ALTER TABLE public.sales_activities
      ADD COLUMN IF NOT EXISTS lead_id UUID NULL REFERENCES public.leads(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.sales_activities.lead_id IS 'Links to lead for repeat orders and CLV: SUM(total_amount) per lead_id.';
    CREATE INDEX IF NOT EXISTS idx_sales_activities_lead_id ON public.sales_activities(lead_id);
  END IF;
END $$;

-- 3. Unified auto-resolve: set status to Closed when last_inbound_at > 24h for In Progress / Converted / Qualified
-- lead_statuses are per organization_id; update conversations using their org's Closed status
CREATE OR REPLACE FUNCTION public.auto_resolve_conversations_after_24h()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_wa INTEGER := 0;
  updated_email INTEGER := 0;
BEGIN
  -- WhatsApp conversations: set lead_status_id to Closed for same org where status is In Progress/Converted/Qualified and last_inbound_at < 24h
  WITH target AS (
    SELECT w.id, w.organization_id
    FROM whatsapp_conversations w
    JOIN lead_statuses ls ON ls.id = w.lead_status_id AND ls.organization_id = w.organization_id
    WHERE ls.name IN ('In Progress', 'Converted', 'Qualified')
      AND w.last_inbound_at IS NOT NULL
      AND w.last_inbound_at < (NOW() - INTERVAL '24 hours')
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE whatsapp_conversations w
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE w.id = c.id
    RETURNING w.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_wa FROM updated;

  -- Email conversations: same logic
  WITH target AS (
    SELECT e.id, e.organization_id
    FROM email_conversations e
    JOIN lead_statuses ls ON ls.id = e.lead_status_id AND ls.organization_id = e.organization_id
    WHERE ls.name IN ('In Progress', 'Converted', 'Qualified')
      AND e.last_inbound_at IS NOT NULL
      AND e.last_inbound_at < (NOW() - INTERVAL '24 hours')
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE email_conversations e
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE e.id = c.id
    RETURNING e.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_email FROM updated;

  RETURN updated_wa + updated_email;
END;
$$;

COMMENT ON FUNCTION public.auto_resolve_conversations_after_24h() IS
  'Sets lead_status_id to Closed for whatsapp_conversations and email_conversations when status is In Progress/Converted/Qualified and last_inbound_at is older than 24 hours. Schedule with pg_cron or call from a scheduled job.';


-- === 20250216000000_sales_activities_allow_lead_conversion.sql ===

-- Allow activity_type 'Lead Conversion' for auto-created entries when lead status becomes Converted
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_activities'
  ) THEN
    ALTER TABLE public.sales_activities DROP CONSTRAINT IF EXISTS sales_activities_activity_type_check;
    ALTER TABLE public.sales_activities
      ADD CONSTRAINT sales_activities_activity_type_check CHECK (
        activity_type IN (
          'Demo',
          'Meeting',
          'Call',
          'Proposal',
          'Closing',
          'visit',
          'Lead Conversion'
        )
      );
  END IF;
END $$;


-- === 20250216000001_sales_activities_allow_status_converted.sql ===

-- Allow status 'Converted' for auto-created sales_activities when lead status becomes Converted
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales_activities'
  ) THEN
    ALTER TABLE public.sales_activities DROP CONSTRAINT IF EXISTS sales_activities_status_check;
    ALTER TABLE public.sales_activities
      ADD CONSTRAINT sales_activities_status_check CHECK (
        status IN (
          'Active',
          'Negotiating',
          'Won',
          'Lost',
          'Follow Up',
          'Converted'
        )
      );
  END IF;
END $$;


-- === 20250220000000_whatsapp_max_5_accounts_per_org.sql ===

-- Update table comment: max 5 WhatsApp accounts per organization (enforced in app).
COMMENT ON TABLE public.organization_whatsapp_accounts IS 'WhatsApp Business API accounts per organization. Max 5 per org (enforced in app).';


-- === 20250221000000_livechat_filter_by_role_assignee.sql ===

-- Livechat: filter conversations by role and assignee.
-- Owner/Admin see all; Employee only see conversations assigned to them (backend-enforced).

DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  channel TEXT,
  phone_number_id TEXT,
  whatsapp_account_display_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    COALESCE(c.channel, 'whatsapp') AS channel,
    c.phone_number_id,
    COALESCE(
      NULLIF(TRIM(a.whatsapp_business_name), ''),
      NULLIF(TRIM(a.display_phone_number), ''),
      a.phone_number_id
    )::TEXT AS whatsapp_account_display_name,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN organization_whatsapp_accounts a
    ON a.organization_id = c.organization_id
   AND a.phone_number_id = c.phone_number_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  AND (
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id LIMIT 1) IN ('owner', 'admin')
    OR (
      (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1) IS NOT NULL
      AND c.assignee_id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1)
    )
  )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_whatsapp_conversations_with_preview(UUID) IS 'WhatsApp/Instagram conversations with preview. Owner/Admin see all; Employee see only assigned.';

DROP FUNCTION IF EXISTS public.get_email_conversations_with_preview(uuid);

CREATE FUNCTION public.get_email_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  email_connection_id UUID,
  from_email TEXT,
  from_display_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  email_connection_display TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  lead_status_id UUID,
  followup INTEGER,
  fu_priority TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.email_connection_id,
    c.from_email,
    c.from_display_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    COALESCE(NULLIF(TRIM(conn.email_address), ''), conn.inbound_address)::TEXT AS email_connection_display,
    c.created_at,
    c.updated_at,
    c.lead_status_id,
    COALESCE(c.followup, 0),
    c.fu_priority
  FROM email_conversations c
  JOIN organization_email_connections conn ON conn.id = c.email_connection_id AND conn.organization_id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction
    FROM email_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  AND (
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id LIMIT 1) IN ('owner', 'admin')
    OR (
      (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.organization_id = c.organization_id
          AND l.ticket_id = 'EMAIL-' || UPPER(SUBSTRING(REPLACE(c.id::TEXT, '-', ''), 1, 8))
          AND l.assignee_id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1)
      )
    )
  )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_email_conversations_with_preview(uuid) IS 'Email conversations with preview. Owner/Admin see all; Employee see only where lead is assigned to them.';


-- === 20250222000000_whatsapp_conversations_preview_instagram_display_name.sql ===

-- Add Instagram account display name from organization_meta_config to get_whatsapp_conversations_with_preview.
-- WhatsApp: keep organization_whatsapp_accounts; Instagram: use organization_meta_config (instagram_username / instagram_name).

DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  channel TEXT,
  phone_number_id TEXT,
  whatsapp_account_display_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    COALESCE(c.channel, 'whatsapp') AS channel,
    c.phone_number_id,
    (
      CASE WHEN COALESCE(c.channel, 'whatsapp') = 'instagram' THEN
        COALESCE(
          CASE WHEN meta.instagram_username IS NOT NULL AND TRIM(meta.instagram_username) <> '' THEN '@' || TRIM(meta.instagram_username) END,
          NULLIF(TRIM(COALESCE(meta.instagram_name, '')), '')
        )
      ELSE
        COALESCE(
          NULLIF(TRIM(a.whatsapp_business_name), ''),
          NULLIF(TRIM(a.display_phone_number), ''),
          a.phone_number_id
        )
      END
    )::TEXT AS whatsapp_account_display_name,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN organization_meta_config meta ON meta.organization_id = c.organization_id AND meta.is_active = true
  LEFT JOIN organization_whatsapp_accounts a
    ON a.organization_id = c.organization_id
   AND a.phone_number_id = c.phone_number_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  AND (
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id LIMIT 1) IN ('owner', 'admin')
    OR (
      (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1) IS NOT NULL
      AND c.assignee_id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1)
    )
  )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_whatsapp_conversations_with_preview(UUID) IS 'WhatsApp/Instagram conversations with preview. WhatsApp account from organization_whatsapp_accounts; Instagram from organization_meta_config. Owner/Admin see all; Employee see only assigned.';


-- === 20250222000001_backfill_leads_created_by_name.sql ===

-- Backfill leads.created_by_name from connected account (WhatsApp/Instagram/Email) where it is currently 'System'.
-- Only touches rows with created_by = zero UUID (auto-created from channel).

-- 1) WhatsApp: from organization_whatsapp_accounts
UPDATE leads l
SET created_by_name = COALESCE(
  NULLIF(TRIM(a.whatsapp_business_name), ''),
  NULLIF(TRIM(a.display_phone_number), ''),
  a.phone_number_id,
  'WhatsApp'
)
FROM whatsapp_conversations w
JOIN organization_whatsapp_accounts a
  ON a.organization_id = w.organization_id
 AND a.phone_number_id = w.phone_number_id
 AND a.is_active = true
WHERE l.ticket_id = w.ticket_id
  AND l.organization_id = w.organization_id
  AND COALESCE(w.channel, 'whatsapp') = 'whatsapp'
  AND l.created_by_name = 'System'
  AND l.created_by = '00000000-0000-0000-0000-000000000000'::UUID;

-- 2) Instagram: from organization_meta_config
UPDATE leads l
SET created_by_name = COALESCE(
  NULLIF(TRIM(meta.instagram_username), ''),
  NULLIF(TRIM(meta.instagram_name), ''),
  'Instagram'
)
FROM whatsapp_conversations w
JOIN organization_meta_config meta
  ON meta.organization_id = w.organization_id
 AND meta.is_active = true
WHERE l.ticket_id = w.ticket_id
  AND l.organization_id = w.organization_id
  AND COALESCE(w.channel, 'whatsapp') = 'instagram'
  AND l.created_by_name = 'System'
  AND l.created_by = '00000000-0000-0000-0000-000000000000'::UUID;

-- 3) Email: from organization_email_connections
UPDATE leads l
SET created_by_name = COALESCE(
  NULLIF(TRIM(conn.email_address), ''),
  NULLIF(TRIM(conn.inbound_address), ''),
  'Email'
)
FROM email_conversations c
JOIN organization_email_connections conn
  ON conn.id = c.email_connection_id
 AND conn.organization_id = c.organization_id
WHERE l.ticket_id = 'EMAIL-' || UPPER(SUBSTRING(REPLACE(c.id::TEXT, '-', ''), 1, 8))
  AND l.organization_id = c.organization_id
  AND l.created_by_name = 'System'
  AND l.created_by = '00000000-0000-0000-0000-000000000000'::UUID;

-- 4) Fallback: any remaining System by source column
UPDATE leads
SET created_by_name = CASE source
  WHEN 'WhatsApp' THEN 'WhatsApp'
  WHEN 'Email' THEN 'Email'
  WHEN 'Instagram' THEN 'Instagram'
  ELSE created_by_name
END
WHERE created_by_name = 'System'
  AND created_by = '00000000-0000-0000-0000-000000000000'::UUID;


-- === 20260211000000_create_instagram_tables.sql ===

-- Instagram: separate tables for DM (no mixing with whatsapp_conversations).
-- organization_instagram_accounts: multi-account per org
-- instagram_conversations, instagram_messages: Instagram DM only

-- 1) organization_instagram_accounts
CREATE TABLE IF NOT EXISTS public.organization_instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instagram_business_account_id TEXT NOT NULL,
  facebook_page_id TEXT,
  page_access_token TEXT,
  instagram_username TEXT,
  instagram_name TEXT,
  verify_token TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_org_instagram_account UNIQUE (organization_id, instagram_business_account_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_instagram_accounts_organization_id
  ON public.organization_instagram_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_instagram_accounts_ig_business_id
  ON public.organization_instagram_accounts(instagram_business_account_id);

ALTER TABLE public.organization_instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org instagram accounts"
  ON public.organization_instagram_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_instagram_accounts.organization_id
    )
  );

CREATE POLICY "Users can insert own org instagram accounts"
  ON public.organization_instagram_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "Users can update own org instagram accounts"
  ON public.organization_instagram_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_instagram_accounts.organization_id
    )
  );

CREATE POLICY "Users can delete own org instagram accounts"
  ON public.organization_instagram_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_instagram_accounts.organization_id
    )
  );

CREATE OR REPLACE FUNCTION update_organization_instagram_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_instagram_accounts_updated_at
  BEFORE UPDATE ON public.organization_instagram_accounts
  FOR EACH ROW EXECUTE FUNCTION update_organization_instagram_accounts_updated_at();

COMMENT ON TABLE public.organization_instagram_accounts IS 'Instagram Business/Creator accounts per organization. Used for DM and webhook.';

-- 2) instagram_conversations
CREATE TABLE IF NOT EXISTS public.instagram_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instagram_business_account_id TEXT NOT NULL,
  customer_ig_id TEXT NOT NULL,
  customer_name TEXT,
  customer_external_id TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID REFERENCES public.lead_statuses(id) ON DELETE SET NULL,
  first_inbound_at TIMESTAMP WITH TIME ZONE,
  last_inbound_at TIMESTAMP WITH TIME ZONE,
  assignee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ticket_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_instagram_conv_org_account_customer UNIQUE (organization_id, instagram_business_account_id, customer_ig_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_organization_id
  ON public.instagram_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_last_message_at
  ON public.instagram_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_ig_business_id
  ON public.instagram_conversations(instagram_business_account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_assignee_id
  ON public.instagram_conversations(assignee_id);

ALTER TABLE public.instagram_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org instagram conversations"
  ON public.instagram_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = instagram_conversations.organization_id
    )
  );

CREATE POLICY "Users can insert own org instagram conversations"
  ON public.instagram_conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "Users can update own org instagram conversations"
  ON public.instagram_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = instagram_conversations.organization_id
    )
  );

CREATE POLICY "Users can delete own org instagram conversations"
  ON public.instagram_conversations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = instagram_conversations.organization_id
    )
  );

CREATE OR REPLACE FUNCTION update_instagram_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_instagram_conversations_updated_at
  BEFORE UPDATE ON public.instagram_conversations
  FOR EACH ROW EXECUTE FUNCTION update_instagram_conversations_updated_at();

COMMENT ON TABLE public.instagram_conversations IS 'Instagram DM conversations. One per (org, instagram_business_account_id, customer_ig_id).';

-- 3) instagram_messages
CREATE TABLE IF NOT EXISTS public.instagram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.instagram_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  platform_message_id TEXT,
  body TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  raw_metadata JSONB,
  status TEXT,
  status_updated_at TIMESTAMP WITH TIME ZONE,
  reply_to_platform_message_id TEXT,
  reply_to_body TEXT,
  reply_to_message_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_messages_conversation_id
  ON public.instagram_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_created_at
  ON public.instagram_messages(created_at);

ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org instagram messages"
  ON public.instagram_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM instagram_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = instagram_messages.conversation_id
    )
  );

CREATE POLICY "Users can insert own org instagram messages"
  ON public.instagram_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM instagram_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = conversation_id
    )
  );

CREATE POLICY "Users can update own org instagram messages"
  ON public.instagram_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM instagram_conversations c
      JOIN profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = instagram_messages.conversation_id
    )
  );

COMMENT ON TABLE public.instagram_messages IS 'Instagram DM messages.';

-- 4) Enable Realtime for instagram_conversations and instagram_messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'instagram_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_conversations;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'instagram_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_messages;
    END IF;
  END IF;
END $$;


-- === 20260211000001_whatsapp_conversations_preview_whatsapp_only.sql ===

-- get_whatsapp_conversations_with_preview: WhatsApp only (no Instagram).
-- Instagram conversations now live in instagram_conversations and use get_instagram_conversations_with_preview.

DROP FUNCTION IF EXISTS public.get_whatsapp_conversations_with_preview(UUID);

CREATE FUNCTION public.get_whatsapp_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_wa_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  channel TEXT,
  phone_number_id TEXT,
  whatsapp_account_display_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_wa_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    COALESCE(c.channel, 'whatsapp') AS channel,
    c.phone_number_id,
    COALESCE(
      NULLIF(TRIM(a.whatsapp_business_name), ''),
      NULLIF(TRIM(a.display_phone_number), ''),
      a.phone_number_id
    )::TEXT AS whatsapp_account_display_name,
    c.created_at,
    c.updated_at
  FROM whatsapp_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN organization_whatsapp_accounts a
    ON a.organization_id = c.organization_id
   AND a.phone_number_id = c.phone_number_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  AND COALESCE(c.channel, 'whatsapp') = 'whatsapp'
  AND (
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id LIMIT 1) IN ('owner', 'admin')
    OR (
      (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1) IS NOT NULL
      AND c.assignee_id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1)
    )
  )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_whatsapp_conversations_with_preview(UUID) IS 'WhatsApp conversations with preview only. Owner/Admin see all; Employee see only assigned. Instagram uses get_instagram_conversations_with_preview.';


-- === 20260211000002_get_instagram_conversations_with_preview.sql ===

-- RPC: get_instagram_conversations_with_preview (Owner/Admin see all; Employee see only assigned)

CREATE OR REPLACE FUNCTION public.get_instagram_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_ig_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  instagram_business_account_id TEXT,
  instagram_account_display_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_ig_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.instagram_business_account_id,
    COALESCE(
      CASE WHEN a.instagram_username IS NOT NULL AND TRIM(a.instagram_username) <> '' THEN '@' || TRIM(a.instagram_username) END,
      NULLIF(TRIM(COALESCE(a.instagram_name, '')), ''),
      a.instagram_business_account_id
    )::TEXT AS instagram_account_display_name,
    c.created_at,
    c.updated_at
  FROM instagram_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN organization_instagram_accounts a
    ON a.organization_id = c.organization_id
   AND a.instagram_business_account_id = c.instagram_business_account_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM instagram_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  AND (
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id LIMIT 1) IN ('owner', 'admin')
    OR (
      (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1) IS NOT NULL
      AND c.assignee_id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1)
    )
  )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_instagram_conversations_with_preview(UUID) IS 'Instagram DM conversations with preview. Owner/Admin see all; Employee see only assigned.';


-- === 20260212000000_instagram_conversations_employees_see_unassigned.sql ===

-- Allow employees to see unassigned Instagram conversations (new DMs appear in livechat for everyone)
CREATE OR REPLACE FUNCTION public.get_instagram_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  customer_ig_id TEXT,
  customer_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  last_message_status TEXT,
  lead_status_id UUID,
  lead_status_name TEXT,
  instagram_business_account_id TEXT,
  instagram_account_display_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.customer_ig_id,
    c.customer_name,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    c.lead_status_id,
    ls.name AS lead_status_name,
    c.instagram_business_account_id,
    COALESCE(
      CASE WHEN a.instagram_username IS NOT NULL AND TRIM(a.instagram_username) <> '' THEN '@' || TRIM(a.instagram_username) END,
      NULLIF(TRIM(COALESCE(a.instagram_name, '')), ''),
      a.instagram_business_account_id
    )::TEXT AS instagram_account_display_name,
    c.created_at,
    c.updated_at
  FROM instagram_conversations c
  LEFT JOIN lead_statuses ls ON ls.id = c.lead_status_id
  LEFT JOIN organization_instagram_accounts a
    ON a.organization_id = c.organization_id
   AND a.instagram_business_account_id = c.instagram_business_account_id
   AND a.is_active = true
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction, status
    FROM instagram_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  AND (
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id LIMIT 1) IN ('owner', 'admin')
    OR (
      (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1) IS NOT NULL
      AND (c.assignee_id IS NULL OR c.assignee_id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1))
    )
  )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_instagram_conversations_with_preview(UUID) IS 'Instagram DM conversations with preview. Owner/Admin see all; Employee see unassigned + assigned to them.';


-- === 20260215000000_schedule_auto_resolve_livechat_24h.sql ===

-- Schedule auto-resolve livechat: run auto_resolve_conversations_after_24h() every hour.
-- Without this schedule, the function is never called and tickets stay open past 24h.
-- Requires pg_cron (schema "cron"). Skip on local / DBs where extension is not installed.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('auto-resolve-livechat-24h');
    EXCEPTION
      WHEN OTHERS THEN NULL; -- job may not exist yet
    END;
    PERFORM cron.schedule(
      'auto-resolve-livechat-24h',
      '0 * * * *',  -- every hour at minute 0
      'SELECT auto_resolve_conversations_after_24h()'
    );
  END IF;
END $$;


-- === 20260215000001_auto_resolve_handle_orphan_status_and_instagram.sql ===

-- Auto-resolve: handle orphan/NULL lead_status_id and add instagram_conversations.
-- Conversations with last_inbound_at > 24h are resolved to Closed when:
-- - status is In Progress/Converted/Qualified, OR
-- - lead_status_id is NULL or points to missing/different-org status (orphan).
-- Only orgs that have a "Closed" lead_status are updated.

CREATE OR REPLACE FUNCTION public.auto_resolve_conversations_after_24h()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_wa INTEGER := 0;
  updated_email INTEGER := 0;
  updated_ig INTEGER := 0;
BEGIN
  -- WhatsApp: resolve when last_inbound_at > 24h and (active status OR orphan/NULL)
  WITH target AS (
    SELECT w.id, w.organization_id
    FROM whatsapp_conversations w
    LEFT JOIN lead_statuses ls ON ls.id = w.lead_status_id AND ls.organization_id = w.organization_id
    WHERE w.last_inbound_at IS NOT NULL
      AND w.last_inbound_at < (NOW() - INTERVAL '24 hours')
      AND (
        ls.name IN ('In Progress', 'Converted', 'Qualified')
        OR w.lead_status_id IS NULL
        OR ls.id IS NULL
      )
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE whatsapp_conversations w
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE w.id = c.id
    RETURNING w.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_wa FROM updated;

  -- Email: same logic
  WITH target AS (
    SELECT e.id, e.organization_id
    FROM email_conversations e
    LEFT JOIN lead_statuses ls ON ls.id = e.lead_status_id AND ls.organization_id = e.organization_id
    WHERE e.last_inbound_at IS NOT NULL
      AND e.last_inbound_at < (NOW() - INTERVAL '24 hours')
      AND (
        ls.name IN ('In Progress', 'Converted', 'Qualified')
        OR e.lead_status_id IS NULL
        OR ls.id IS NULL
      )
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE email_conversations e
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE e.id = c.id
    RETURNING e.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_email FROM updated;

  -- Instagram: same logic
  WITH target AS (
    SELECT i.id, i.organization_id
    FROM instagram_conversations i
    LEFT JOIN lead_statuses ls ON ls.id = i.lead_status_id AND ls.organization_id = i.organization_id
    WHERE i.last_inbound_at IS NOT NULL
      AND i.last_inbound_at < (NOW() - INTERVAL '24 hours')
      AND (
        ls.name IN ('In Progress', 'Converted', 'Qualified')
        OR i.lead_status_id IS NULL
        OR ls.id IS NULL
      )
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE instagram_conversations i
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE i.id = c.id
    RETURNING i.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_ig FROM updated;

  RETURN updated_wa + updated_email + updated_ig;
END;
$$;

COMMENT ON FUNCTION public.auto_resolve_conversations_after_24h() IS
  'Sets lead_status_id to Closed for whatsapp_conversations, email_conversations, and instagram_conversations when last_inbound_at is older than 24 hours and status is In Progress/Converted/Qualified or lead_status_id is NULL/orphan. Schedule with pg_cron.';


-- === 20260215000002_ensure_default_lead_statuses_for_orgs.sql ===

-- Ensure every org that has livechat conversations has at least default lead_statuses
-- (Open, In Progress, Converted, Qualified, Closed) so auto-resolve and UI work.
-- Only inserts for orgs that currently have zero lead_statuses.

INSERT INTO public.lead_statuses (id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  s.name,
  NULL,
  NULL,
  TRUE,
  s.sort_order,
  o.id,
  NOW(),
  NOW()
FROM (
  SELECT 1 AS sort_order, 'Open' AS name
  UNION ALL SELECT 2, 'In Progress'
  UNION ALL SELECT 3, 'Converted'
  UNION ALL SELECT 4, 'Qualified'
  UNION ALL SELECT 5, 'Closed'
) s
CROSS JOIN (
  SELECT DISTINCT o.id
  FROM public.organizations o
  WHERE EXISTS (
    SELECT 1 FROM public.whatsapp_conversations w WHERE w.organization_id = o.id
    UNION
    SELECT 1 FROM public.email_conversations e WHERE e.organization_id = o.id
    UNION
    SELECT 1 FROM public.instagram_conversations i WHERE i.organization_id = o.id
  )
  AND NOT EXISTS (SELECT 1 FROM public.lead_statuses ls WHERE ls.organization_id = o.id)
) o;

-- We only select orgs that have ZERO lead_statuses, then insert 5 rows per org.
-- If migration runs twice, second run: NOT EXISTS will be false for those orgs, so no rows to insert.

COMMENT ON TABLE public.lead_statuses IS 'Lead statuses per organization. Default set (Open, In Progress, Converted, Qualified, Closed) can be ensured by migration 20260215000002 for orgs with conversations.';


-- === 20260225000000_auto_resolve_use_created_at_fallback.sql ===

-- Auto-resolve: use COALESCE(last_inbound_at, created_at) so conversations with no inbound
-- messages also qualify for 24h rule (effective_at = created_at when last_inbound_at is NULL).
-- Existing logic unchanged: only In Progress/Converted/Qualified or NULL/orphan status; already Closed skipped.

CREATE OR REPLACE FUNCTION public.auto_resolve_conversations_after_24h()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_wa INTEGER := 0;
  updated_email INTEGER := 0;
  updated_ig INTEGER := 0;
BEGIN
  -- WhatsApp: resolve when effective_at > 24h and (active status OR orphan/NULL)
  WITH target AS (
    SELECT w.id, w.organization_id
    FROM whatsapp_conversations w
    LEFT JOIN lead_statuses ls ON ls.id = w.lead_status_id AND ls.organization_id = w.organization_id
    WHERE (COALESCE(w.last_inbound_at, w.created_at)) < (NOW() - INTERVAL '24 hours')
      AND (
        ls.name IN ('In Progress', 'Converted', 'Qualified')
        OR w.lead_status_id IS NULL
        OR ls.id IS NULL
      )
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE whatsapp_conversations w
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE w.id = c.id
    RETURNING w.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_wa FROM updated;

  -- Email: same logic
  WITH target AS (
    SELECT e.id, e.organization_id
    FROM email_conversations e
    LEFT JOIN lead_statuses ls ON ls.id = e.lead_status_id AND ls.organization_id = e.organization_id
    WHERE (COALESCE(e.last_inbound_at, e.created_at)) < (NOW() - INTERVAL '24 hours')
      AND (
        ls.name IN ('In Progress', 'Converted', 'Qualified')
        OR e.lead_status_id IS NULL
        OR ls.id IS NULL
      )
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE email_conversations e
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE e.id = c.id
    RETURNING e.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_email FROM updated;

  -- Instagram: same logic
  WITH target AS (
    SELECT i.id, i.organization_id
    FROM instagram_conversations i
    LEFT JOIN lead_statuses ls ON ls.id = i.lead_status_id AND ls.organization_id = i.organization_id
    WHERE (COALESCE(i.last_inbound_at, i.created_at)) < (NOW() - INTERVAL '24 hours')
      AND (
        ls.name IN ('In Progress', 'Converted', 'Qualified')
        OR i.lead_status_id IS NULL
        OR ls.id IS NULL
      )
  ),
  closed AS (
    SELECT t.id, ls_closed.id AS closed_id
    FROM target t
    JOIN lead_statuses ls_closed ON ls_closed.organization_id = t.organization_id AND ls_closed.name = 'Closed'
  ),
  updated AS (
    UPDATE instagram_conversations i
    SET lead_status_id = c.closed_id, updated_at = NOW()
    FROM closed c
    WHERE i.id = c.id
    RETURNING i.id
  )
  SELECT COUNT(*)::INTEGER INTO updated_ig FROM updated;

  RETURN updated_wa + updated_email + updated_ig;
END;
$$;

COMMENT ON FUNCTION public.auto_resolve_conversations_after_24h() IS
  'Sets lead_status_id to Closed for whatsapp_conversations, email_conversations, and instagram_conversations when effective_at = COALESCE(last_inbound_at, created_at) is older than 24 hours and status is In Progress/Converted/Qualified or lead_status_id is NULL/orphan. Schedule with pg_cron.';


-- === 20260303140000_add_thread_subject_to_email_conversations_preview.sql ===

-- Include thread_subject in email conversations preview so list can show Subject when body preview is empty (e.g. HTML-only).
DROP FUNCTION IF EXISTS public.get_email_conversations_with_preview(uuid);

CREATE FUNCTION public.get_email_conversations_with_preview(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  email_connection_id UUID,
  from_email TEXT,
  from_display_name TEXT,
  thread_subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,
  last_message_direction TEXT,
  email_connection_display TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  lead_status_id UUID,
  followup INTEGER,
  fu_priority TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.organization_id,
    c.email_connection_id,
    c.from_email,
    c.from_display_name,
    c.thread_subject,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    COALESCE(NULLIF(TRIM(conn.email_address), ''), conn.inbound_address)::TEXT AS email_connection_display,
    c.created_at,
    c.updated_at,
    c.lead_status_id,
    COALESCE(c.followup, 0),
    c.fu_priority
  FROM email_conversations c
  JOIN organization_email_connections conn ON conn.id = c.email_connection_id AND conn.organization_id = c.organization_id
  LEFT JOIN LATERAL (
    SELECT created_at, body, direction
    FROM email_messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.organization_id = p_organization_id
  AND (
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id LIMIT 1) IN ('owner', 'admin')
    OR (
      (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.organization_id = c.organization_id
          AND l.ticket_id = 'EMAIL-' || UPPER(SUBSTRING(REPLACE(c.id::TEXT, '-', ''), 1, 8))
          AND l.assignee_id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() AND e.organization_id = p_organization_id LIMIT 1)
      )
    )
  )
  ORDER BY m.created_at DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_email_conversations_with_preview(uuid) IS 'Email conversations with preview and thread_subject. Owner/Admin see all; Employee see only where lead is assigned to them.';


-- === 20260305100000_sync_wa_conv_status_to_leads_trigger.sql ===

-- Sync lead_status_id and assignee_id from whatsapp_conversations to leads when conversation is updated.
-- Email and Instagram have the same sync via 20260305110000_sync_email_instagram_conv_status_to_leads_trigger.sql.

CREATE OR REPLACE FUNCTION public.sync_wa_conv_status_to_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id text;
BEGIN
  -- Use conversation ticket_id (generated column for WA is always set)
  v_ticket_id := COALESCE(TRIM(NEW.ticket_id), '');
  IF v_ticket_id = '' OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.leads
  SET
    status_id = NEW.lead_status_id,
    assignee_id = NEW.assignee_id,
    updated_at = now()
  WHERE
    organization_id = NEW.organization_id
    AND ticket_id IS NOT NULL
    AND TRIM(ticket_id) <> ''
    AND (ticket_id = v_ticket_id OR UPPER(TRIM(ticket_id)) = UPPER(v_ticket_id));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_wa_conv_status_to_lead_trigger ON public.whatsapp_conversations;

CREATE TRIGGER sync_wa_conv_status_to_lead_trigger
  AFTER UPDATE OF lead_status_id, assignee_id ON public.whatsapp_conversations
  FOR EACH ROW
  WHEN (
    OLD.lead_status_id IS DISTINCT FROM NEW.lead_status_id
    OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
  )
  EXECUTE FUNCTION public.sync_wa_conv_status_to_lead();

COMMENT ON FUNCTION public.sync_wa_conv_status_to_lead() IS 'Syncs lead_status_id and assignee_id from whatsapp_conversations to leads by ticket_id so leads-management table stays in sync with quick action.';


-- === 20260305110000_sync_email_instagram_conv_status_to_leads_trigger.sql ===

-- Sync lead_status_id (and assignee_id where applicable) from email_conversations and instagram_conversations
-- to leads when conversation is updated. Same behavior as whatsapp_conversations trigger.

-- -------- Email: lead_status_id only (email_conversations has no assignee_id) --------
-- Ticket format in app: EMAIL- + first 8 chars of id (uppercase, no dashes)

CREATE OR REPLACE FUNCTION public.sync_email_conv_status_to_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id text;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_ticket_id := 'EMAIL-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));

  UPDATE public.leads
  SET
    status_id = NEW.lead_status_id,
    updated_at = now()
  WHERE
    organization_id = NEW.organization_id
    AND ticket_id IS NOT NULL
    AND TRIM(ticket_id) <> ''
    AND (ticket_id = v_ticket_id OR UPPER(TRIM(ticket_id)) = v_ticket_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_email_conv_status_to_lead_trigger ON public.email_conversations;

CREATE TRIGGER sync_email_conv_status_to_lead_trigger
  AFTER UPDATE OF lead_status_id ON public.email_conversations
  FOR EACH ROW
  WHEN (OLD.lead_status_id IS DISTINCT FROM NEW.lead_status_id)
  EXECUTE FUNCTION public.sync_email_conv_status_to_lead();

COMMENT ON FUNCTION public.sync_email_conv_status_to_lead() IS 'Syncs lead_status_id from email_conversations to leads by ticket_id (EMAIL-xxxxxxxx) so leads-management table stays in sync with quick action.';


-- -------- Instagram: lead_status_id and assignee_id --------
-- ticket_id in instagram_conversations can be stored or derived as IG- + 8 chars from id

CREATE OR REPLACE FUNCTION public.sync_instagram_conv_status_to_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id text;
BEGIN
  v_ticket_id := COALESCE(NULLIF(TRIM(NEW.ticket_id), ''), 'IG-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8)));
  IF v_ticket_id = '' OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.leads
  SET
    status_id = NEW.lead_status_id,
    assignee_id = NEW.assignee_id,
    updated_at = now()
  WHERE
    organization_id = NEW.organization_id
    AND ticket_id IS NOT NULL
    AND TRIM(ticket_id) <> ''
    AND (ticket_id = v_ticket_id OR UPPER(TRIM(ticket_id)) = UPPER(v_ticket_id));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_instagram_conv_status_to_lead_trigger ON public.instagram_conversations;

CREATE TRIGGER sync_instagram_conv_status_to_lead_trigger
  AFTER UPDATE OF lead_status_id, assignee_id ON public.instagram_conversations
  FOR EACH ROW
  WHEN (
    OLD.lead_status_id IS DISTINCT FROM NEW.lead_status_id
    OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
  )
  EXECUTE FUNCTION public.sync_instagram_conv_status_to_lead();

COMMENT ON FUNCTION public.sync_instagram_conv_status_to_lead() IS 'Syncs lead_status_id and assignee_id from instagram_conversations to leads by ticket_id so leads-management table stays in sync with quick action.';


-- === ensure_lead_status_history.sql ===

-- Tabel riwayat perubahan status lead. Dipakai oleh modal Status History di Leads Management.
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  notes TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id
  ON public.lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at
  ON public.lead_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_organization_id
  ON public.lead_status_history(organization_id);

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can view own org lead status history"
  ON public.lead_status_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id)
  );

DROP POLICY IF EXISTS "Users can insert own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can insert own org lead status history"
  ON public.lead_status_history FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id)
  );

COMMENT ON TABLE public.lead_status_history IS 'Status change history for leads; shown in Leads Management Status History modal.';


-- === enable_realtime_leads.sql ===

-- Enable Realtime for leads so Leads Management table updates when status/assignee etc change (sama seperti tab live chat)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;


-- === add_sync_conversation_last_message_rpc.sql ===

-- RPC: sync conversation last_message_at and last_message_body from the actual latest message
-- Call from webhook after inserting a message so preview is always correct
CREATE OR REPLACE FUNCTION public.sync_conversation_last_message(p_conversation_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_conversations c
  SET
    last_message_at = m.created_at,
    last_message_body = LEFT(m.body, 200),
    updated_at = NOW()
  FROM (
    SELECT conversation_id, created_at, body
    FROM public.whatsapp_messages
    WHERE conversation_id = p_conversation_id
    ORDER BY created_at DESC
    LIMIT 1
  ) m
  WHERE c.id = p_conversation_id AND c.id = m.conversation_id;
$$;

