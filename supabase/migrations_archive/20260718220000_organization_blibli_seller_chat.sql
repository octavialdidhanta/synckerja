-- Blibli Seller Chat: per-org store connections + encrypted API keys + OTT mint audit.

CREATE TABLE IF NOT EXISTS public.organization_blibli_seller_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  store_code text NOT NULL,
  store_id bigint NOT NULL,
  username text NOT NULL,
  display_name text NULL,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected')),
  last_mint_at timestamptz NULL,
  last_mint_ok boolean NULL,
  last_mint_error text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_blibli_seller_connections_org_store_key
    UNIQUE (organization_id, store_code)
);

COMMENT ON TABLE public.organization_blibli_seller_connections IS
  'Per-org Blibli seller store connection metadata for Seller Chat OTT iframe.';

CREATE INDEX IF NOT EXISTS idx_organization_blibli_seller_connections_org
  ON public.organization_blibli_seller_connections (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_blibli_seller_connections_one_default
  ON public.organization_blibli_seller_connections (organization_id)
  WHERE is_default = true AND status = 'active';

ALTER TABLE public.organization_blibli_seller_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_blibli_seller_connections_select
  ON public.organization_blibli_seller_connections;
CREATE POLICY organization_blibli_seller_connections_select
  ON public.organization_blibli_seller_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT ur.organization_id
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.organization_blibli_seller_connection_tokens (
  connection_id uuid NOT NULL REFERENCES public.organization_blibli_seller_connections (id) ON DELETE CASCADE,
  api_seller_key_enc text NOT NULL,
  signature_key_enc text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id)
);

COMMENT ON TABLE public.organization_blibli_seller_connection_tokens IS
  'Encrypted Blibli Api-Seller-Key / Signature Key. Edge Functions (service role) only.';

ALTER TABLE public.organization_blibli_seller_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_blibli_seller_connection_tokens_deny
  ON public.organization_blibli_seller_connection_tokens;
CREATE POLICY organization_blibli_seller_connection_tokens_deny
  ON public.organization_blibli_seller_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.blibli_seller_chat_ott_mints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.organization_blibli_seller_connections (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blibli_seller_chat_ott_mints IS
  'Audit of Blibli chat OTT mint calls for ~10/hour per store rate limit.';

CREATE INDEX IF NOT EXISTS idx_blibli_seller_chat_ott_mints_conn_created
  ON public.blibli_seller_chat_ott_mints (connection_id, created_at DESC);

ALTER TABLE public.blibli_seller_chat_ott_mints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blibli_seller_chat_ott_mints_deny
  ON public.blibli_seller_chat_ott_mints;
CREATE POLICY blibli_seller_chat_ott_mints_deny
  ON public.blibli_seller_chat_ott_mints
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.is_blibli_seller_chat_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_blibli_seller_connections c
    INNER JOIN public.organization_blibli_seller_connection_tokens t
      ON t.connection_id = c.id
    WHERE c.organization_id = p_organization_id
      AND c.status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_blibli_seller_chat_connected(uuid) TO authenticated;
