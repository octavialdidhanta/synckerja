import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  countMetaConvertedLeadsForCampaign,
  parseEligibleMetaConvertedLeads,
  type MetaConvertedLeadRow,
} from "./metaConvertedLeadRules.ts";

export type MetaCampaignServiceMappingRow = {
  campaign_id: string;
  service_id: string;
  services: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type MetaMetricsRowLike = Record<string, unknown>;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function resolveMetaCampaignId(row: MetaMetricsRowLike): string {
  return String(row.campaign_id ?? "").trim();
}

export async function loadCampaignServiceMappings(
  admin: SupabaseClient,
  organizationId: string,
  adAccountId: string,
): Promise<Map<string, { serviceId: string; serviceName: string }>> {
  const { data, error } = await admin
    .from("organization_meta_ads_campaign_services")
    .select("campaign_id, service_id, services!inner(id, name)")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", adAccountId);

  if (error) {
    console.warn("meta loadCampaignServiceMappings:", error.message);
    return new Map();
  }

  const map = new Map<string, { serviceId: string; serviceName: string }>();
  for (const row of (data ?? []) as MetaCampaignServiceMappingRow[]) {
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
    console.warn("meta loadConvertedStatusIds:", error.message);
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
): Promise<ReturnType<typeof parseEligibleMetaConvertedLeads>> {
  const statusIds = await loadConvertedStatusIds(admin, organizationId);
  if (statusIds.length === 0) return [];

  const startIso = `${dateStart}T00:00:00.000Z`;
  const endIso = `${dateEnd}T23:59:59.999Z`;

  const { data, error } = await admin
    .from("leads")
    .select("id, attribution, fbclid, gclid, converted_at")
    .eq("organization_id", organizationId)
    .in("status_id", statusIds)
    .not("converted_at", "is", null)
    .gte("converted_at", startIso)
    .lte("converted_at", endIso);

  if (error) {
    console.warn("meta loadConvertedLeadsForPeriod:", error.message);
    return [];
  }

  return parseEligibleMetaConvertedLeads((data ?? []) as MetaConvertedLeadRow[]);
}

function parseSpend(row: MetaMetricsRowLike): number | null {
  const n = parseFloat(String(row.spend ?? ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Enrich Meta campaign insight rows with service mapping + per-campaign CPA.
 */
export async function enrichMetaCampaignRowsWithServiceEconomics(
  admin: SupabaseClient,
  organizationId: string,
  adAccountId: string,
  dateStart: string,
  dateEnd: string,
  rows: MetaMetricsRowLike[],
): Promise<void> {
  if (rows.length === 0) return;

  const accountDigits = digitsOnly(adAccountId);
  if (!accountDigits) return;

  const mappingMap = await loadCampaignServiceMappings(admin, organizationId, accountDigits);
  const eligibleLeads = await loadConvertedLeadsForPeriod(
    admin,
    organizationId,
    dateStart,
    dateEnd,
  );

  for (const row of rows) {
    const campaignId = resolveMetaCampaignId(row);
    if (!campaignId) {
      row.service_id = null;
      row.service_name = null;
      row.service_cpl = null;
      row.service_converted_leads = null;
      continue;
    }

    const mapping = mappingMap.get(campaignId);
    if (!mapping) {
      row.service_id = null;
      row.service_name = null;
      row.service_cpl = null;
      row.service_converted_leads = null;
      continue;
    }

    row.service_id = mapping.serviceId;
    row.service_name = mapping.serviceName;

    const campaignName = String(row.campaign_name ?? "");
    const converted = countMetaConvertedLeadsForCampaign(
      eligibleLeads,
      campaignId,
      campaignName,
    );
    row.service_converted_leads = converted;

    const spend = parseSpend(row);
    row.service_cpl = converted > 0 && spend != null ? spend / converted : null;
  }
}

export async function handleUpsertMetaCampaignServiceMapping(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  organizationId: string,
  userId: string,
): Promise<{ ok: true; mapping: Record<string, string> | null } | { error: string; status: number }> {
  const adAccountId = digitsOnly(String(body.ad_account_id ?? ""));
  const campaignId = String(body.campaign_id ?? "").trim();
  const serviceId = String(body.service_id ?? "").trim();

  if (!adAccountId) {
    return { error: "ad_account_id required (digits)", status: 400 };
  }
  if (!campaignId) {
    return { error: "campaign_id required", status: 400 };
  }

  if (!serviceId) {
    const { error } = await admin
      .from("organization_meta_ads_campaign_services")
      .delete()
      .eq("organization_id", organizationId)
      .eq("ad_account_id", adAccountId)
      .eq("campaign_id", campaignId);
    if (error) return { error: error.message, status: 500 };
    return { ok: true, mapping: null };
  }

  const { data: serviceRow, error: svcErr } = await admin
    .from("services")
    .select("id, name")
    .eq("id", serviceId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (svcErr) return { error: svcErr.message, status: 500 };
  if (!serviceRow) {
    return { error: "Service not found for this organization", status: 400 };
  }

  const { data: row, error } = await admin
    .from("organization_meta_ads_campaign_services")
    .upsert(
      {
        organization_id: organizationId,
        ad_account_id: adAccountId,
        campaign_id: campaignId,
        service_id: serviceId,
        created_by: userId,
      },
      { onConflict: "organization_id,ad_account_id,campaign_id" },
    )
    .select("campaign_id, service_id, services!inner(id, name)")
    .single();

  if (error) return { error: error.message, status: 500 };

  const svc = (row as { services?: { id: string; name: string } | { id: string; name: string }[] })
    ?.services;
  const service = Array.isArray(svc) ? svc[0] : svc;

  return {
    ok: true,
    mapping: {
      campaign_id: campaignId,
      ad_account_id: adAccountId,
      service_id: service?.id ?? serviceId,
      service_name: service?.name ?? String(serviceRow.name ?? ""),
    },
  };
}
