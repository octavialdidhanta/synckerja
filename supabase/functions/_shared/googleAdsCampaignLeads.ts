import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  exactCampaignNameKey,
  LEADS_COST_PER_LEAD_KEY,
  LEADS_TOTAL_KEY,
  LEADS_VISIT_RATE_KEY,
} from "./googleAdsSynckerjaLeadsMetrics.ts";
import {
  TRAFFIC_TOTAL_VISIT_PAGE_KEY,
} from "./googleAdsSynckerjaTrafficMetrics.ts";
import type { NormalizedMetricsRowLike } from "./googleAdsCampaignTraffic.ts";

export type { NormalizedMetricsRowLike };

export async function loadLeadsByUtmCampaign(
  admin: SupabaseClient,
  organizationId: string,
  dateStart: string,
  dateEnd: string,
): Promise<Map<string, number>> {
  const { data, error } = await admin.rpc("service_get_leads_by_utm_campaign", {
    p_organization_id: organizationId,
    p_from: dateStart,
    p_to: dateEnd,
  });
  if (error) {
    console.warn("loadLeadsByUtmCampaign:", error.message);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = String((row as { utm_campaign_key?: string }).utm_campaign_key ?? "").trim();
    const count = Number((row as { leads_count?: number }).leads_count ?? 0);
    if (!key || !Number.isFinite(count)) continue;
    map.set(key, count);
  }
  return map;
}

function resolveLeadsForCampaignRow(
  row: NormalizedMetricsRowLike,
  leadsByUtm: Map<string, number>,
): number {
  const campaignNameKey = exactCampaignNameKey(String(row.identity.name ?? ""));
  if (!campaignNameKey) return 0;
  return leadsByUtm.get(campaignNameKey) ?? 0;
}

function resolveVisitsForLeadsRate(row: NormalizedMetricsRowLike): number | null {
  const visits = row.metrics[TRAFFIC_TOTAL_VISIT_PAGE_KEY];
  if (visits == null || !Number.isFinite(visits)) return null;
  return visits;
}

export function enrichCampaignRowsWithLeadsMetrics(
  rows: NormalizedMetricsRowLike[],
  leadsByUtm: Map<string, number>,
  requestedKeys: string[],
): void {
  const wantTotal = requestedKeys.includes(LEADS_TOTAL_KEY);
  const wantRate = requestedKeys.includes(LEADS_VISIT_RATE_KEY);
  const wantCpl = requestedKeys.includes(LEADS_COST_PER_LEAD_KEY);
  if (!wantTotal && !wantRate && !wantCpl) return;

  for (const row of rows) {
    const campaignNameKey = exactCampaignNameKey(String(row.identity.name ?? ""));

    if (!campaignNameKey) {
      if (wantTotal) row.metrics[LEADS_TOTAL_KEY] = null;
      if (wantRate) row.metrics[LEADS_VISIT_RATE_KEY] = null;
      if (wantCpl) row.metrics[LEADS_COST_PER_LEAD_KEY] = null;
      continue;
    }

    const leads = resolveLeadsForCampaignRow(row, leadsByUtm);

    if (wantTotal) {
      row.metrics[LEADS_TOTAL_KEY] = leads;
    }

    if (wantRate) {
      const visits = resolveVisitsForLeadsRate(row);
      if (visits != null && visits > 0) {
        row.metrics[LEADS_VISIT_RATE_KEY] = (leads / visits) * 100;
      } else {
        row.metrics[LEADS_VISIT_RATE_KEY] = null;
      }
    }

    if (wantCpl) {
      const spent = row.metrics.spent;
      if (leads > 0 && spent != null && Number.isFinite(spent)) {
        row.metrics[LEADS_COST_PER_LEAD_KEY] = spent / leads;
      } else {
        row.metrics[LEADS_COST_PER_LEAD_KEY] = null;
      }
    }
  }
}

export async function maybeEnrichCampaignLeadsRows(
  admin: SupabaseClient,
  organizationId: string,
  entity: string,
  dateStart: string,
  dateEnd: string,
  rows: NormalizedMetricsRowLike[],
  requestedKeys: string[],
): Promise<void> {
  if (entity !== "campaign" || rows.length === 0) return;

  const leadsRequested = requestedKeys.some(
    (k) => k === LEADS_TOTAL_KEY || k === LEADS_VISIT_RATE_KEY || k === LEADS_COST_PER_LEAD_KEY,
  );
  if (!leadsRequested) return;

  const leadsByUtm = await loadLeadsByUtmCampaign(admin, organizationId, dateStart, dateEnd);
  enrichCampaignRowsWithLeadsMetrics(rows, leadsByUtm, requestedKeys);
}
