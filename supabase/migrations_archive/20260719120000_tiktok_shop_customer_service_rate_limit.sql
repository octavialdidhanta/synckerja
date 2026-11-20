-- TikTok Shop Customer Service (Get Conversations): rate-limit audit

CREATE TABLE IF NOT EXISTS public.tiktok_shop_cs_api_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.organization_tiktok_shop_accounts (id) ON DELETE SET NULL,
  shop_id text,
  action text NOT NULL DEFAULT 'listConversations',
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tiktok_shop_cs_api_calls IS
  'Audit of TikTok Shop Customer Service API calls for ~60/30min per org rate limit.';

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_cs_api_calls_org_created
  ON public.tiktok_shop_cs_api_calls (organization_id, created_at DESC);

ALTER TABLE public.tiktok_shop_cs_api_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_shop_cs_api_calls_deny
  ON public.tiktok_shop_cs_api_calls;
CREATE POLICY tiktok_shop_cs_api_calls_deny
  ON public.tiktok_shop_cs_api_calls
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
