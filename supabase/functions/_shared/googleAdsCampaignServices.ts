import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseGoogleAdsResourceId } from "./googleAdsMetricsCatalog.ts";

export type CampaignServiceMappingRow = {
  campaign_id: string;
  service_id: string;
  services: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type NormalizedMetricsRowLike = {
  id: string;
  identity: Record<string, unknown>;
  metrics: Record<string, number | null>;
};

function digitsOnly(value: string, len?: number): string {
  const d = value.replace(/\D/g, "");
  if (len != null && d.length !== len) return "";
  return d;
}

function normalizeCampaignNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolve Google customer id + campaign resource id from a metrics row. */
export function resolveRowCustomerAndCampaignId(
  row: NormalizedMetricsRowLike,
  defaultCustomerId: string,
): { customerId: string; campaignId: string } | null {
  const rawId = String(row.id ?? "").trim();
  const m = /^(\d{10})-(\d+)$/.exec(rawId);
  if (m) {
    return { customerId: m[1], campaignId: m[2] };
  }
  const customerId = digitsOnly(defaultCustomerId, 10);
  const campaignId = parseGoogleAdsResourceId(
    String(row.identity.campaign_id ?? row.id ?? ""),
  );
  if (!customerId || !campaignId) return null;
  return { customerId, campaignId };
}

export async function loadCampaignServiceMappings(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<Map<string, { serviceId: string; serviceName: string }>> {
  const { data, error } = await admin
    .from("organization_google_ads_campaign_services")
    .select("campaign_id, service_id, services!inner(id, name)")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId);

  if (error) {
    console.warn("loadCampaignServiceMappings:", error.message);
    return new Map();
  }

  const map = new Map<string, { serviceId: string; serviceName: string }>();
  for (const row of (data ?? []) as CampaignServiceMappingRow[]) {
    const cid = String(row.campaign_id ?? "").trim();
    const svc = row.services;
    const service = Array.isArray(svc) ? svc[0] : svc;
    if (!cid || !service?.id) continue;
    map.set(cid, {
      serviceId: String(service.id),
      serviceName: String(service.name ?? ""),
    });
  }
  return map;
}

async function loadConvertedStatusIds(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("lead_statuses")
    .select("id, name, organization_id")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);

  if (error) {
    console.warn("loadConvertedStatusIds:", error.message);
    return [];
  }

  const ids: string[] = [];
  for (const row of data ?? []) {
    const name = String((row as { name?: string }).name ?? "").trim().toLowerCase();
    if (name === "converted") {
      ids.push(String((row as { id: string }).id));
    }
  }
  return ids;
}

async function loadConvertedLeadsForPeriod(
  admin: SupabaseClient,
  organizationId: string,
  dateStart: string,
  dateEnd: string,
): Promise<{ utmKey: string }[]> {
  const statusIds = await loadConvertedStatusIds(admin, organizationId);
  if (statusIds.length === 0) return [];

  const startIso = `${dateStart}T00:00:00.000Z`;
  const endIso = `${dateEnd}T23:59:59.999Z`;

  const { data, error } = await admin
    .from("leads")
    .select("attribution, gclid")
    .eq("organization_id", organizationId)
    .in("status_id", statusIds)
    .not("gclid", "is", null)
    .gte("converted_at", startIso)
    .lte("converted_at", endIso);

  if (error) {
    console.warn("loadConvertedLeadsForPeriod:", error.message);
    return [];
  }

  const out: { utmKey: string }[] = [];
  for (const row of data ?? []) {
    const gclid = String((row as { gclid?: string | null }).gclid ?? "").trim();
    if (!gclid) continue;
    const attribution = (row as { attribution?: Record<string, unknown> | null }).attribution;
    const utmRaw = attribution && typeof attribution === "object"
      ? String(attribution.utm_campaign ?? "")
      : "";
    const utm = normalizeCampaignNameKey(utmRaw);
    if (utm) out.push({ utmKey: utm });
  }
  return out;
}

/** Count converted leads per UTM campaign key (attribution.utm_campaign). */
function countConvertedLeadsByUtmCampaign(
  convertedLeads: { utmKey: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lead of convertedLeads) {
    if (!lead.utmKey) continue;
    counts.set(lead.utmKey, (counts.get(lead.utmKey) ?? 0) + 1);
  }
  return counts;
}

/**
 * Enrich campaign rows with service mapping + per-campaign CPA
 * (campaign spent ÷ leads where UTM campaign matches this row's Google campaign name).
 */
export async function enrichCampaignRowsWithServiceEconomics(
  admin: SupabaseClient,
  organizationId: string,
  defaultCustomerId: string,
  dateStart: string,
  dateEnd: string,
  rows: NormalizedMetricsRowLike[],
  mappingsByCustomer: Map<string, Map<string, { serviceId: string; serviceName: string }>>,
): Promise<void> {
  if (rows.length === 0) return;

  const convertedLeads = await loadConvertedLeadsForPeriod(
    admin,
    organizationId,
    dateStart,
    dateEnd,
  );
  const leadsByUtmCampaign = countConvertedLeadsByUtmCampaign(convertedLeads);

  for (const row of rows) {
    const resolved = resolveRowCustomerAndCampaignId(row, defaultCustomerId);
    if (!resolved) {
      row.identity.service_name = null;
      row.identity.service_id = null;
      row.identity.service_cpl = null;
      row.identity.service_converted_leads = null;
      continue;
    }

    const mappingMap = mappingsByCustomer.get(resolved.customerId) ??
      await loadMappingsForCustomer(
        admin,
        organizationId,
        resolved.customerId,
        mappingsByCustomer,
      );
    const mapping = mappingMap.get(resolved.campaignId);
    if (!mapping) {
      row.identity.service_name = null;
      row.identity.service_id = null;
      row.identity.service_cpl = null;
      row.identity.service_converted_leads = null;
      continue;
    }

    row.identity.service_id = mapping.serviceId;
    row.identity.service_name = mapping.serviceName;

    const campaignNameKey = normalizeCampaignNameKey(String(row.identity.name ?? ""));
    const converted = campaignNameKey
      ? (leadsByUtmCampaign.get(campaignNameKey) ?? 0)
      : 0;
    row.identity.service_converted_leads = converted;

    const spent = row.metrics.spent;
    row.identity.service_cpl = converted > 0 &&
        spent != null &&
        Number.isFinite(spent)
      ? spent / converted
      : null;
  }
}

async function loadMappingsForCustomer(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
  cache: Map<string, Map<string, { serviceId: string; serviceName: string }>>,
): Promise<Map<string, { serviceId: string; serviceName: string }>> {
  let map = cache.get(customerId);
  if (!map) {
    map = await loadCampaignServiceMappings(admin, organizationId, customerId);
    cache.set(customerId, map);
  }
  return map;
}

export async function preloadMappingsForRows(
  admin: SupabaseClient,
  organizationId: string,
  defaultCustomerId: string,
  rows: NormalizedMetricsRowLike[],
): Promise<Map<string, Map<string, { serviceId: string; serviceName: string }>>> {
  const customerIds = new Set<string>();
  for (const row of rows) {
    const resolved = resolveRowCustomerAndCampaignId(row, defaultCustomerId);
    if (resolved) customerIds.add(resolved.customerId);
  }
  if (customerIds.size === 0) {
    customerIds.add(digitsOnly(defaultCustomerId, 10));
  }

  const cache = new Map<string, Map<string, { serviceId: string; serviceName: string }>>();
  for (const cid of customerIds) {
    if (!cid) continue;
    cache.set(cid, await loadCampaignServiceMappings(admin, organizationId, cid));
  }
  return cache;
}
