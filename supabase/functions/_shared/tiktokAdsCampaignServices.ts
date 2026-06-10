import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type TikTokMetricsRowLike = Record<string, unknown>;

function normalizeCampaignMatchKey(value: string): string {
  return value.trim().toLowerCase();
}

function utmCampaignKeyFromAttribution(attribution: unknown): string {
  if (attribution == null || typeof attribution !== "object" || Array.isArray(attribution)) {
    return "";
  }
  return normalizeCampaignMatchKey(String((attribution as Record<string, unknown>).utm_campaign ?? ""));
}

function utmSourceFromAttribution(attribution: unknown): string {
  if (attribution == null || typeof attribution !== "object" || Array.isArray(attribution)) {
    return "";
  }
  return normalizeCampaignMatchKey(String((attribution as Record<string, unknown>).utm_source ?? ""));
}

function isTikTokChannelLead(attribution: unknown): boolean {
  const source = utmSourceFromAttribution(attribution);
  return source.includes("tiktok");
}

export function resolveTikTokCampaignId(row: TikTokMetricsRowLike): string {
  return String(row.campaign_id ?? "").trim();
}

export async function loadTikTokCampaignServiceMappings(
  admin: SupabaseClient,
  organizationId: string,
  advertiserId: string,
): Promise<Map<string, { serviceId: string; serviceName: string }>> {
  const { data, error } = await admin
    .from("organization_tiktok_ads_campaign_services")
    .select("campaign_id, service_id, services!inner(id, name)")
    .eq("organization_id", organizationId)
    .eq("advertiser_id", advertiserId);

  if (error) {
    console.warn("tiktok loadCampaignServiceMappings:", error.message);
    return new Map();
  }

  const map = new Map<string, { serviceId: string; serviceName: string }>();
  for (const row of data ?? []) {
    const cid = String((row as { campaign_id?: string }).campaign_id ?? "").trim();
    const svc = (row as { services?: { id: string; name: string } | { id: string; name: string }[] }).services;
    const service = Array.isArray(svc) ? svc[0] : svc;
    if (!cid || !service?.id) continue;
    map.set(cid, { serviceId: String(service.id), serviceName: String(service.name ?? "") });
  }
  return map;
}

async function loadConvertedStatusIds(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("lead_statuses")
    .select("id, name, organization_id")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);

  const ids: string[] = [];
  for (const row of data ?? []) {
    const name = String((row as { name?: string }).name ?? "").trim().toLowerCase();
    if (name === "converted") ids.push(String((row as { id: string }).id));
  }
  return ids;
}

function utmMatchesCampaign(utmKey: string, campaignId: string, campaignName: string): boolean {
  if (!utmKey) return false;
  const idKey = normalizeCampaignMatchKey(campaignId);
  const nameKey = normalizeCampaignMatchKey(campaignName);
  if (idKey && utmKey === idKey) return true;
  if (nameKey && utmKey === nameKey) return true;
  return false;
}

export async function enrichTikTokCampaignRowsWithServiceEconomics(
  admin: SupabaseClient,
  organizationId: string,
  advertiserId: string,
  rows: TikTokMetricsRowLike[],
  dateStart: string,
  dateEnd: string,
): Promise<void> {
  const mappings = await loadTikTokCampaignServiceMappings(admin, organizationId, advertiserId);
  const statusIds = await loadConvertedStatusIds(admin, organizationId);

  let convertedLeads: Array<{ attribution: unknown }> = [];
  if (statusIds.length > 0) {
    const { data } = await admin
      .from("leads")
      .select("id, attribution")
      .eq("organization_id", organizationId)
      .in("status_id", statusIds)
      .not("converted_at", "is", null)
      .gte("converted_at", `${dateStart}T00:00:00.000Z`)
      .lte("converted_at", `${dateEnd}T23:59:59.999Z`);
    convertedLeads = (data ?? []).filter((l) => isTikTokChannelLead((l as { attribution: unknown }).attribution));
  }

  for (const row of rows) {
    const campaignId = resolveTikTokCampaignId(row);
    const campaignName = String(row.campaign_name ?? "");
    const mapping = mappings.get(campaignId);
    if (mapping) {
      row.service_id = mapping.serviceId;
      row.service_name = mapping.serviceName;
    }

    let leadCount = 0;
    for (const lead of convertedLeads) {
      const utmKey = utmCampaignKeyFromAttribution(lead.attribution);
      if (utmMatchesCampaign(utmKey, campaignId, campaignName)) leadCount += 1;
    }
    if (mapping) {
      row.service_converted_leads = leadCount;
      const spend = parseFloat(String(row.spend ?? 0)) || 0;
      row.service_cost_per_lead = leadCount > 0 ? spend / leadCount : null;
    }
  }
}

export async function handleUpsertTikTokCampaignServiceMapping(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  advertiserId: string,
  campaignId: string,
  serviceId: string | null,
): Promise<{ ok: boolean; mapping?: unknown }> {
  const digits = advertiserId.replace(/\D/g, "");
  const cid = campaignId.trim();
  if (!cid) throw new Error("Missing campaign_id");

  if (!serviceId) {
    await admin
      .from("organization_tiktok_ads_campaign_services")
      .delete()
      .eq("organization_id", organizationId)
      .eq("advertiser_id", digits)
      .eq("campaign_id", cid);
    return { ok: true, mapping: null };
  }

  const { data, error } = await admin
    .from("organization_tiktok_ads_campaign_services")
    .upsert(
      {
        organization_id: organizationId,
        advertiser_id: digits,
        campaign_id: cid,
        service_id: serviceId,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,advertiser_id,campaign_id" },
    )
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { ok: true, mapping: data };
}

export function aggregateTikTokRowsByService(
  rows: Record<string, unknown>[],
  unmappedLabel: string,
) {
  const buckets = new Map<string, {
    service_id: string | null;
    service_name: string;
    amount: number;
    impressions: number;
    clicks: number;
    converted_leads: number | null;
    cost_per_lead: number | null;
  }>();

  for (const row of rows) {
    const serviceId = String(row.service_id ?? "").trim();
    const key = serviceId || "__unmapped__";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        service_id: serviceId || null,
        service_name: serviceId ? String(row.service_name ?? serviceId) : unmappedLabel,
        amount: 0,
        impressions: 0,
        clicks: 0,
        converted_leads: serviceId ? 0 : null,
        cost_per_lead: null,
      };
      buckets.set(key, bucket);
    }
    bucket.amount += parseFloat(String(row.spend ?? 0)) || 0;
    bucket.impressions += parseFloat(String(row.impressions ?? 0)) || 0;
    bucket.clicks += parseFloat(String(row.clicks ?? 0)) || 0;
    if (serviceId) {
      const cl = row.service_converted_leads;
      if (cl != null && Number.isFinite(Number(cl))) {
        bucket.converted_leads = (bucket.converted_leads ?? 0) + Number(cl);
      }
    }
  }

  const result = [...buckets.values()];
  for (const b of result) {
    if (b.service_id && b.converted_leads != null && b.converted_leads > 0) {
      b.cost_per_lead = b.amount / b.converted_leads;
    }
  }
  return result.sort((a, b) => b.amount - a.amount);
}
