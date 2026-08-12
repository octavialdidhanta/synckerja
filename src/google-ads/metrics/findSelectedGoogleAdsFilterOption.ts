import { GOOGLE_ADS_FILTER_ALL } from "@/google-ads/metrics/filterTypes";
import { parseGoogleAdsResourceId } from "@/google-ads/metrics/parseGoogleAdsResourceId";

export type GoogleAdsFilterOptionMatch = {
  id: string;
  name: string;
  status?: string;
  campaign_id?: string;
  ad_group_id?: string;
};

/** Resolve selected filter id against list options (resource id / campaign_id / ad_group_id). */
export function findSelectedGoogleAdsFilterOption(
  value: string | null,
  options: GoogleAdsFilterOptionMatch[],
): GoogleAdsFilterOptionMatch | undefined {
  if (!value || value === GOOGLE_ADS_FILTER_ALL) return undefined;
  const direct = options.find((o) => o.id === value);
  if (direct) return direct;
  const resourceId = parseGoogleAdsResourceId(value);
  if (!resourceId) return undefined;
  return options.find((o) => {
    if (parseGoogleAdsResourceId(o.id) === resourceId) return true;
    if (o.campaign_id && o.campaign_id === resourceId) return true;
    if (o.ad_group_id && o.ad_group_id === resourceId) return true;
    return false;
  });
}
