import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildGoogleCampaignUtmKeys,
  type MetaCampaignRef,
} from "./monthlyReportAttribution.ts";

/** Matches frontend `REPORT_UNMAPPED_SERVICE_KEY`. */
export const REPORT_SERVICE_FILTER_UNMAPPED = "__unmapped__";

export type GoogleCampaignListItem = { id: string; campaign_id: string; name: string };

function campaignKey(c: GoogleCampaignListItem): string {
  return String(c.campaign_id ?? c.id).trim();
}

export type MonthlyServiceCampaignScope = {
  /** Empty = no campaigns in scope (zero spend/leads). */
  googleCampaignIds: Set<string>;
  campaignUtmKeys: Set<string>;
  metaCampaignRefs: MetaCampaignRef[];
};

export function parseMonthlyServiceIdFilter(
  body: Record<string, unknown>,
): string | null {
  if (body.service_id == null) return null;
  const raw = String(body.service_id).trim();
  if (!raw || raw === "all") return null;
  return raw;
}

function metaCampaignRefsFromItems(
  items: GoogleCampaignListItem[],
): MetaCampaignRef[] {
  return items.map((c) => ({ id: campaignKey(c), name: c.name }));
}

function utmKeysFromGoogleCampaigns(items: GoogleCampaignListItem[]): Set<string> {
  return buildGoogleCampaignUtmKeys(
    items.map((c) => ({ id: campaignKey(c), name: c.name })),
  );
}

export function resolveGoogleMonthlyServiceScope(
  allCampaigns: GoogleCampaignListItem[],
  mappingsByCampaignId: Map<string, { serviceId: string; serviceName: string }>,
  serviceIdFilter: string | null,
): MonthlyServiceCampaignScope {
  if (serviceIdFilter == null) {
    return {
      googleCampaignIds: new Set(allCampaigns.map(campaignKey)),
      campaignUtmKeys: utmKeysFromGoogleCampaigns(allCampaigns),
      metaCampaignRefs: metaCampaignRefsFromItems(allCampaigns),
    };
  }

  if (serviceIdFilter === REPORT_SERVICE_FILTER_UNMAPPED) {
    const unmapped = allCampaigns.filter((c) => !mappingsByCampaignId.has(campaignKey(c)));
    return {
      googleCampaignIds: new Set(unmapped.map(campaignKey)),
      campaignUtmKeys: utmKeysFromGoogleCampaigns(unmapped),
      metaCampaignRefs: metaCampaignRefsFromItems(unmapped),
    };
  }

  const mapped = allCampaigns.filter((c) => {
    const m = mappingsByCampaignId.get(campaignKey(c));
    return m?.serviceId === serviceIdFilter;
  });
  return {
    googleCampaignIds: new Set(mapped.map(campaignKey)),
    campaignUtmKeys: utmKeysFromGoogleCampaigns(mapped),
    metaCampaignRefs: metaCampaignRefsFromItems(mapped),
  };
}

export async function loadMetaCampaignServiceMappings(
  admin: SupabaseClient,
  organizationId: string,
  adAccountId: string,
): Promise<Map<string, { serviceId: string; serviceName: string }>> {
  const digits = adAccountId.replace(/\D/g, "");
  if (!digits) return new Map();

  const { data, error } = await admin
    .from("organization_meta_ads_campaign_services")
    .select("campaign_id, service_id, services!inner(id, name)")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", digits);

  if (error) {
    console.warn("loadMetaCampaignServiceMappings:", error.message);
    return new Map();
  }

  const map = new Map<string, { serviceId: string; serviceName: string }>();
  for (const row of data ?? []) {
    const cid = String((row as { campaign_id?: string }).campaign_id ?? "").trim();
    const svc = (row as { services?: { id: string; name: string } | { id: string; name: string }[] })
      .services;
    const service = Array.isArray(svc) ? svc[0] : svc;
    if (!cid || !service?.id) continue;
    map.set(cid, {
      serviceId: String(service.id),
      serviceName: String(service.name ?? ""),
    });
  }
  return map;
}

export function resolveMetaMonthlyServiceScope(
  allCampaigns: MetaCampaignRef[],
  mappingsByCampaignId: Map<string, { serviceId: string; serviceName: string }>,
  serviceIdFilter: string | null,
): MonthlyServiceCampaignScope {
  if (serviceIdFilter == null) {
    return {
      googleCampaignIds: new Set(allCampaigns.map((c) => c.id)),
      campaignUtmKeys: buildGoogleCampaignUtmKeys(allCampaigns),
      metaCampaignRefs: allCampaigns,
    };
  }

  if (serviceIdFilter === REPORT_SERVICE_FILTER_UNMAPPED) {
    const unmapped = allCampaigns.filter((c) => !mappingsByCampaignId.has(c.id));
    return {
      googleCampaignIds: new Set(unmapped.map((c) => c.id)),
      campaignUtmKeys: buildGoogleCampaignUtmKeys(unmapped),
      metaCampaignRefs: unmapped,
    };
  }

  const mapped = allCampaigns.filter((c) => {
    const m = mappingsByCampaignId.get(c.id);
    return m?.serviceId === serviceIdFilter;
  });
  return {
    googleCampaignIds: new Set(mapped.map((c) => c.id)),
    campaignUtmKeys: buildGoogleCampaignUtmKeys(mapped),
    metaCampaignRefs: mapped,
  };
}
