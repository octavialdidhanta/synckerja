import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseGoogleAdsResourceId } from "./googleAdsMetricsCatalog.ts";
import {
  TRAFFIC_TOTAL_VISIT_PAGE_KEY,
  TRAFFIC_VISIT_CLICK_RATE_KEY,
  normalizeCampaignNameKey,
} from "./googleAdsSynckerjaTrafficMetrics.ts";

export type NormalizedMetricsRowLike = {
  id: string;
  identity: Record<string, unknown>;
  metrics: Record<string, number | null>;
};

type TrafficIngestionStatus = {
  daily_rollups_exist?: boolean;
  aggregate_day_min?: string | null;
  aggregate_day_max?: string | null;
};

export async function loadOrgDefaultWebId(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("organization_traffic_web_preferences")
    .select("default_web_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    console.warn("loadOrgDefaultWebId:", error.message);
    return null;
  }
  const raw = data?.default_web_id;
  return raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
}

export async function resolveTrafficWebIdForOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const preferred = await loadOrgDefaultWebId(admin, organizationId);
  if (preferred) return preferred;

  const { data, error } = await admin
    .from("analytics_web_access")
    .select("web_id")
    .eq("organization_id", organizationId)
    .eq("is_approved", true)
    .order("web_id", { ascending: true })
    .limit(1);
  if (error) {
    console.warn("resolveTrafficWebIdForOrg:", error.message);
    return null;
  }
  const row = data?.[0] as { web_id?: string } | undefined;
  return row?.web_id ? String(row.web_id).trim() : null;
}

export async function assertOrgApprovedWebId(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("analytics_web_access")
    .select("web_id,is_approved")
    .eq("organization_id", organizationId)
    .eq("web_id", webId)
    .maybeSingle();
  if (error) {
    console.warn("assertOrgApprovedWebId:", error.message);
    return false;
  }
  return data?.web_id != null && data.is_approved === true;
}

export async function trafficRollupsAvailable(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("service_get_traffic_ingestion_status", {
    p_organization_id: organizationId,
    p_web_id: webId,
  });
  if (error) {
    console.warn("trafficRollupsAvailable:", error.message);
    return false;
  }
  const row = data as TrafficIngestionStatus | null;
  return Boolean(row?.daily_rollups_exist);
}

export async function loadTrafficSessionsByUtmCampaign(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
  dateStart: string,
  dateEnd: string,
): Promise<Map<string, number>> {
  const { data, error } = await admin.rpc("service_get_traffic_sessions_by_utm_campaign", {
    p_organization_id: organizationId,
    p_web_id: webId,
    p_from: dateStart,
    p_to: dateEnd,
  });
  if (error) {
    console.warn("loadTrafficSessionsByUtmCampaign:", error.message);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = String((row as { utm_campaign_key?: string }).utm_campaign_key ?? "").trim();
    const count = Number((row as { sessions_count?: number }).sessions_count ?? 0);
    if (!key || !Number.isFinite(count)) continue;
    map.set(key, count);
  }
  return map;
}

export async function loadTrafficSessionsByGadCampaignId(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
  dateStart: string,
  dateEnd: string,
): Promise<Map<string, number>> {
  const { data, error } = await admin.rpc("service_get_traffic_sessions_by_gad_campaign_id", {
    p_organization_id: organizationId,
    p_web_id: webId,
    p_from: dateStart,
    p_to: dateEnd,
  });
  if (error) {
    console.warn("loadTrafficSessionsByGadCampaignId:", error.message);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = String((row as { gad_campaign_id?: string }).gad_campaign_id ?? "").trim();
    const count = Number((row as { sessions_count?: number }).sessions_count ?? 0);
    if (!key || !Number.isFinite(count)) continue;
    map.set(key, count);
  }
  return map;
}

function resolveVisitsForCampaignRow(
  row: NormalizedMetricsRowLike,
  sessionsByUtm: Map<string, number>,
  sessionsByGadId: Map<string, number>,
): number {
  const campaignNameKey = normalizeCampaignNameKey(String(row.identity.name ?? ""));
  if (campaignNameKey) {
    const byName = sessionsByUtm.get(campaignNameKey);
    if (byName != null && byName > 0) return byName;
  }

  const campaignId = parseGoogleAdsResourceId(row.id);
  if (campaignId) {
    const byGad = sessionsByGadId.get(campaignId);
    if (byGad != null && byGad > 0) return byGad;
  }

  if (campaignNameKey) {
    const byNameZero = sessionsByUtm.get(campaignNameKey);
    if (byNameZero != null) return byNameZero;
  }
  if (campaignId) {
    const byGadZero = sessionsByGadId.get(campaignId);
    if (byGadZero != null) return byGadZero;
  }

  return 0;
}

export function enrichCampaignRowsWithTrafficMetrics(
  rows: NormalizedMetricsRowLike[],
  sessionsByUtm: Map<string, number>,
  sessionsByGadId: Map<string, number>,
  requestedKeys: string[],
  rollupsAvailable: boolean,
): void {
  const wantVisits = requestedKeys.includes(TRAFFIC_TOTAL_VISIT_PAGE_KEY);
  const wantRate = requestedKeys.includes(TRAFFIC_VISIT_CLICK_RATE_KEY);
  if (!wantVisits && !wantRate) return;

  for (const row of rows) {
    const campaignNameKey = normalizeCampaignNameKey(String(row.identity.name ?? ""));
    const campaignId = parseGoogleAdsResourceId(row.id);

    if (!rollupsAvailable || (!campaignNameKey && !campaignId)) {
      if (wantVisits) row.metrics[TRAFFIC_TOTAL_VISIT_PAGE_KEY] = null;
      if (wantRate) row.metrics[TRAFFIC_VISIT_CLICK_RATE_KEY] = null;
      continue;
    }

    const visits = resolveVisitsForCampaignRow(row, sessionsByUtm, sessionsByGadId);

    if (wantVisits) {
      row.metrics[TRAFFIC_TOTAL_VISIT_PAGE_KEY] = visits;
    }

    if (wantRate) {
      const clicks = row.metrics.clicks;
      if (clicks != null && Number.isFinite(clicks) && clicks > 0) {
        row.metrics[TRAFFIC_VISIT_CLICK_RATE_KEY] = (visits / clicks) * 100;
      } else {
        row.metrics[TRAFFIC_VISIT_CLICK_RATE_KEY] = null;
      }
    }
  }
}

export async function maybeEnrichCampaignTrafficRows(
  admin: SupabaseClient,
  organizationId: string,
  entity: string,
  dateStart: string,
  dateEnd: string,
  rows: NormalizedMetricsRowLike[],
  requestedKeys: string[],
): Promise<void> {
  if (entity !== "campaign" || rows.length === 0) return;

  const trafficRequested = requestedKeys.some(
    (k) => k === TRAFFIC_TOTAL_VISIT_PAGE_KEY || k === TRAFFIC_VISIT_CLICK_RATE_KEY,
  );
  if (!trafficRequested) return;

  const emptyMap = new Map<string, number>();
  const webId = await resolveTrafficWebIdForOrg(admin, organizationId);
  if (!webId) {
    enrichCampaignRowsWithTrafficMetrics(rows, emptyMap, emptyMap, requestedKeys, false);
    return;
  }

  const webAccessOk = await assertOrgApprovedWebId(admin, organizationId, webId);
  if (!webAccessOk) {
    console.warn(
      "maybeEnrichCampaignTrafficRows: web_id not approved for org",
      { organizationId, webId },
    );
    enrichCampaignRowsWithTrafficMetrics(rows, emptyMap, emptyMap, requestedKeys, false);
    return;
  }

  const rollupsAvailable = await trafficRollupsAvailable(admin, organizationId, webId);
  if (!rollupsAvailable) {
    enrichCampaignRowsWithTrafficMetrics(rows, emptyMap, emptyMap, requestedKeys, false);
    return;
  }

  const [sessionsByUtm, sessionsByGadId] = await Promise.all([
    loadTrafficSessionsByUtmCampaign(admin, organizationId, webId, dateStart, dateEnd),
    loadTrafficSessionsByGadCampaignId(admin, organizationId, webId, dateStart, dateEnd),
  ]);
  enrichCampaignRowsWithTrafficMetrics(
    rows,
    sessionsByUtm,
    sessionsByGadId,
    requestedKeys,
    true,
  );
}
