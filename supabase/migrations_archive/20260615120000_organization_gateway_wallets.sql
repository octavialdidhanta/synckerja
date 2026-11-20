-- Gateway wallet snapshots (Brick platform wallet + Xendit sub-account balance) per organization.

CREATE TABLE IF NOT EXISTS public.organization_gateway_wallets (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  provider text NOT NULL,
  usable_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  total_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IDR',
  synced_at timestamptz NULL,
  sync_error text NULL,
  raw_payload jsonb NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_gateway_wallets_pkey PRIMARY KEY (organization_id, provider),
  CONSTRAINT organization_gateway_wallets_provider_check CHECK (
    provider = ANY (ARRAY['brick'::text, 'xendit'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_organization_gateway_wallets_org
  ON public.organization_gateway_wallets (organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_gateway_wallets_synced_at
  ON public.organization_gateway_wallets (synced_at DESC NULLS LAST);

ALTER TABLE public.organization_gateway_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_gateway_wallets_org_select ON public.organization_gateway_wallets;
CREATE POLICY organization_gateway_wallets_org_select
  ON public.organization_gateway_wallets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Writes only via service_role (edge functions).
