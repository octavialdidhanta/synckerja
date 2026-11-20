-- IMAP direct connect for email (Hostinger etc.) — no Resend forwarder required.

ALTER TABLE public.organization_email_connections
  ADD COLUMN IF NOT EXISTS connection_method TEXT NOT NULL DEFAULT 'forwarding'
    CHECK (connection_method IN ('forwarding', 'imap')),
  ADD COLUMN IF NOT EXISTS imap_host TEXT,
  ADD COLUMN IF NOT EXISTS imap_port INTEGER NOT NULL DEFAULT 993,
  ADD COLUMN IF NOT EXISTS smtp_host TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port INTEGER NOT NULL DEFAULT 465,
  ADD COLUMN IF NOT EXISTS imap_last_uid BIGINT,
  ADD COLUMN IF NOT EXISTS imap_last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imap_sync_error TEXT;

COMMENT ON COLUMN public.organization_email_connections.connection_method IS
  'forwarding = Resend inbound address + Gmail/Hostinger forwarder; imap = direct IMAP poll + SMTP send.';
COMMENT ON COLUMN public.organization_email_connections.imap_last_uid IS
  'Last processed IMAP UID in INBOX; email-imap-sync fetches UID > this value.';

CREATE TABLE IF NOT EXISTS public.organization_email_connection_secrets (
  connection_id UUID PRIMARY KEY
    REFERENCES public.organization_email_connections(id) ON DELETE CASCADE,
  password_enc TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organization_email_connection_secrets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.organization_email_connection_secrets IS
  'Encrypted mailbox password for IMAP/SMTP. Service role only — no RLS policies for authenticated users.';

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_external_message_id
  ON public.email_messages (conversation_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

COMMENT ON COLUMN public.email_messages.external_message_id IS
  'RFC Message-ID or imap:uid for deduplication on IMAP sync.';

CREATE OR REPLACE FUNCTION public.update_organization_email_connection_secrets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_organization_email_connection_secrets_updated_at
  ON public.organization_email_connection_secrets;
CREATE TRIGGER trigger_organization_email_connection_secrets_updated_at
  BEFORE UPDATE ON public.organization_email_connection_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_organization_email_connection_secrets_updated_at();

CREATE INDEX IF NOT EXISTS idx_organization_email_connections_imap_sync
  ON public.organization_email_connections (connection_method, status)
  WHERE connection_method = 'imap';
