CREATE TABLE IF NOT EXISTS public.organization_tiktok_shop_products_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shop_id text NOT NULL,
  status_filter text NOT NULL DEFAULT ''::text,
  page_token text NOT NULL DEFAULT ''::text,
  response_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_tiktok_shop_products_cache
  ADD CONSTRAINT organization_tiktok_shop_products_cache_lookup_key UNIQUE (
    organization_id,
    shop_id,
    status_filter,
    page_token
  );

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_products_cache_expires
  ON public.organization_tiktok_shop_products_cache (expires_at);

ALTER TABLE public.organization_tiktok_shop_products_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_shop_products_cache_deny
  ON public.organization_tiktok_shop_products_cache;
CREATE POLICY organization_tiktok_shop_products_cache_deny
  ON public.organization_tiktok_shop_products_cache
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.organization_tiktok_shop_products_cache IS
  'Short-lived cache for TikTok Shop product search responses.';
