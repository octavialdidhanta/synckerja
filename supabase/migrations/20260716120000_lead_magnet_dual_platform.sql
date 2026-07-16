-- Dual-platform Lead Magnet: campaign can bind Instagram + Facebook Page accounts.

-- ---------------------------------------------------------------------------
-- 1) lead_magnet_campaign_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_magnet_campaign_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.lead_magnet_campaigns (id) ON DELETE CASCADE,
  platform text NOT NULL
    CONSTRAINT lead_magnet_campaign_accounts_platform_chk CHECK (platform IN ('instagram', 'facebook')),
  account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lead_magnet_campaign_accounts_platform UNIQUE (campaign_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_campaign_accounts_lookup
  ON public.lead_magnet_campaign_accounts (platform, account_id);

COMMENT ON TABLE public.lead_magnet_campaign_accounts IS
  'Per-platform account bindings for a lead magnet campaign (max one IG + one FB per campaign).';

-- ---------------------------------------------------------------------------
-- 2) platform column on lead_magnet_campaign_posts
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_magnet_campaign_posts
  ADD COLUMN IF NOT EXISTS platform text NULL
    CONSTRAINT lead_magnet_campaign_posts_platform_chk CHECK (platform IN ('instagram', 'facebook'));

-- Backfill from parent campaign before NOT NULL
UPDATE public.lead_magnet_campaign_posts p
SET platform = c.platform
FROM public.lead_magnet_campaigns c
WHERE p.campaign_id = c.id
  AND p.platform IS NULL;

ALTER TABLE public.lead_magnet_campaign_posts
  ALTER COLUMN platform SET DEFAULT 'instagram';

UPDATE public.lead_magnet_campaign_posts
SET platform = 'instagram'
WHERE platform IS NULL;

ALTER TABLE public.lead_magnet_campaign_posts
  ALTER COLUMN platform SET NOT NULL;

ALTER TABLE public.lead_magnet_campaign_posts
  DROP CONSTRAINT IF EXISTS uq_lead_magnet_campaign_posts;

ALTER TABLE public.lead_magnet_campaign_posts
  ADD CONSTRAINT uq_lead_magnet_campaign_posts
  UNIQUE (campaign_id, platform, media_id);

CREATE INDEX IF NOT EXISTS idx_lead_magnet_campaign_posts_platform_media
  ON public.lead_magnet_campaign_posts (platform, media_id);

-- ---------------------------------------------------------------------------
-- 3) Backfill campaign_accounts from legacy columns
-- ---------------------------------------------------------------------------
INSERT INTO public.lead_magnet_campaign_accounts (campaign_id, platform, account_id)
SELECT c.id, c.platform, c.account_id
FROM public.lead_magnet_campaigns c
WHERE c.platform IS NOT NULL
  AND TRIM(c.account_id) <> ''
ON CONFLICT (campaign_id, platform) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Deprecate legacy single-platform columns (nullable mirror)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_magnet_campaigns
  ALTER COLUMN platform DROP NOT NULL,
  ALTER COLUMN account_id DROP NOT NULL;

DROP INDEX IF EXISTS idx_lead_magnet_campaigns_org_account_active;

CREATE INDEX IF NOT EXISTS idx_lead_magnet_campaign_accounts_active_lookup
  ON public.lead_magnet_campaign_accounts (platform, account_id);

-- ---------------------------------------------------------------------------
-- 5) RLS for lead_magnet_campaign_accounts
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_magnet_campaign_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_magnet_campaign_accounts_select_org ON public.lead_magnet_campaign_accounts;
CREATE POLICY lead_magnet_campaign_accounts_select_org
  ON public.lead_magnet_campaign_accounts FOR SELECT TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.lead_magnet_campaigns
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS lead_magnet_campaign_accounts_mutate_org ON public.lead_magnet_campaign_accounts;
CREATE POLICY lead_magnet_campaign_accounts_mutate_org
  ON public.lead_magnet_campaign_accounts FOR ALL TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.lead_magnet_campaigns
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.lead_magnet_campaigns
      WHERE organization_id IN (SELECT public.user_organization_ids())
    )
  );
