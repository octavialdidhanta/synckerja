ALTER TABLE public.meta_ads_interest_lists
  ADD COLUMN IF NOT EXISTS ad_account_id text NULL;

COMMENT ON COLUMN public.meta_ads_interest_lists.ad_account_id IS
  'Owning Meta ad account (digits). Saved lists are scoped per ad account, not the whole org.';

UPDATE public.meta_ads_interest_lists
SET ad_account_id = regexp_replace(meta_ad_account_id, '[^0-9]', '', 'g')
WHERE (ad_account_id IS NULL OR btrim(ad_account_id) = '')
  AND meta_ad_account_id IS NOT NULL
  AND regexp_replace(meta_ad_account_id, '[^0-9]', '', 'g') <> '';

UPDATE public.meta_ads_interest_lists AS l
SET ad_account_id = d.digits
FROM (
  SELECT DISTINCT ON (organization_id)
    organization_id,
    regexp_replace(ad_account_id, '[^0-9]', '', 'g') AS digits
  FROM public.organization_meta_ads_accounts
  WHERE is_active = true
    AND regexp_replace(ad_account_id, '[^0-9]', '', 'g') <> ''
  ORDER BY organization_id, is_default DESC, sort_order ASC NULLS LAST
) AS d
WHERE l.organization_id = d.organization_id
  AND (l.ad_account_id IS NULL OR btrim(l.ad_account_id) = '');

CREATE INDEX IF NOT EXISTS idx_meta_ads_interest_lists_org_account
  ON public.meta_ads_interest_lists (organization_id, ad_account_id, updated_at DESC);
