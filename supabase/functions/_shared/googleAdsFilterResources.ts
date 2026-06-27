import { parseGoogleAdsResourceId } from "./googleAdsMetricsCatalog.ts";

export type GoogleAdsCampaignListItem = {
  id: string;
  campaign_id: string;
  customer_id: string;
  name: string;
  status: string;
};

export type GoogleAdsAdGroupListItem = {
  id: string;
  ad_group_id: string;
  campaign_id: string;
  customer_id: string;
  name: string;
  status: string;
};

/** `{customerId}-{resourceId}` from MCC lists, or plain numeric resource id. */
export function parseCompositeResourceFilter(raw: string | undefined): {
  metricsCustomerId: string | null;
  resourceId: string;
} {
  const s = String(raw ?? "").trim();
  if (!s) return { metricsCustomerId: null, resourceId: "" };
  const mcc = /^(\d{10})-(\d+)$/.exec(s);
  if (mcc) {
    return { metricsCustomerId: mcc[1]!, resourceId: mcc[2]! };
  }
  return { metricsCustomerId: null, resourceId: parseGoogleAdsResourceId(s) };
}

export function compositeResourceId(customerId: string, resourceId: string): string {
  return `${customerId}-${resourceId}`;
}

export function buildListCampaignsGaql(statusFilter: "all" | "enabled_only"): string {
  return buildCampaignInventoryGaqlQuery({ statusFilter, pageSize: 10000 });
}

/** Campaign rows without date segment — for zero-metric inventory merge (matches listCampaigns scope). */
export function buildCampaignInventoryGaqlQuery(opts: {
  statusFilter: "all" | "enabled_only";
  campaignFilterId?: string;
  pageSize?: number;
}): string {
  const parts = [
    "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type",
    "FROM campaign",
  ];
  const clauses: string[] = [];
  const campaignId = parseGoogleAdsResourceId(opts.campaignFilterId);
  if (campaignId) clauses.push(`campaign.id = '${campaignId}'`);
  if (opts.statusFilter === "enabled_only") clauses.push("campaign.status = 'ENABLED'");
  if (clauses.length > 0) parts.push(`WHERE ${clauses.join(" AND ")}`);
  parts.push("ORDER BY campaign.name");
  parts.push(`LIMIT ${opts.pageSize ?? 10000}`);
  return parts.join("\n");
}

export function buildListAdGroupsGaql(
  campaignId: string,
  statusFilter: "all" | "enabled_only",
): string {
  const parts = [
    "SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id",
    "FROM ad_group",
    `WHERE campaign.id = '${campaignId}'`,
  ];
  if (statusFilter === "enabled_only") {
    parts.push("AND ad_group.status = 'ENABLED'");
  }
  parts.push("ORDER BY ad_group.name");
  parts.push("LIMIT 1000");
  return parts.join("\n");
}

export function normalizeCampaignListRow(
  raw: Record<string, unknown>,
  metricsCustomerId: string,
  clientLabel?: string,
): GoogleAdsCampaignListItem | null {
  const campaign = raw.campaign as Record<string, unknown> | undefined;
  if (!campaign) return null;
  const campaignId = parseGoogleAdsResourceId(String(campaign.id ?? ""));
  if (!campaignId) return null;
  const name = String(campaign.name ?? "").trim() || `Campaign ${campaignId}`;
  const displayName = clientLabel ? `${clientLabel} · ${name}` : name;
  return {
    id: compositeResourceId(metricsCustomerId, campaignId),
    campaign_id: campaignId,
    customer_id: metricsCustomerId,
    name: displayName,
    status: String(campaign.status ?? ""),
  };
}

export function normalizeAdGroupListRow(
  raw: Record<string, unknown>,
  metricsCustomerId: string,
): GoogleAdsAdGroupListItem | null {
  const adGroup = raw.adGroup as Record<string, unknown> | undefined;
  const campaign = raw.campaign as Record<string, unknown> | undefined;
  if (!adGroup) return null;
  const adGroupId = parseGoogleAdsResourceId(String(adGroup.id ?? ""));
  if (!adGroupId) return null;
  const campaignId = parseGoogleAdsResourceId(String(campaign?.id ?? ""));
  return {
    id: compositeResourceId(metricsCustomerId, adGroupId),
    ad_group_id: adGroupId,
    campaign_id: campaignId,
    customer_id: metricsCustomerId,
    name: String(adGroup.name ?? "").trim() || `Ad group ${adGroupId}`,
    status: String(adGroup.status ?? ""),
  };
}
