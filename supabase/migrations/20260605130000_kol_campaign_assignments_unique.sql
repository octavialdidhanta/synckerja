-- Deduplicate existing campaign-KOL assignments (keep earliest row per pair)
DELETE FROM public.kol_campaign_assignments a
USING public.kol_campaign_assignments b
WHERE a.campaign_id = b.campaign_id
  AND a.kol_profile_id = b.kol_profile_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kol_campaign_assignments_campaign_kol_unique
  ON public.kol_campaign_assignments (campaign_id, kol_profile_id);
