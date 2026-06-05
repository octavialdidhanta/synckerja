import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { NormalizedMetricsRowLike } from "./googleAdsCampaignTraffic.ts";
import { maybeEnrichCampaignTrafficRows } from "./googleAdsCampaignTraffic.ts";
import { maybeEnrichCampaignLeadsRows } from "./googleAdsCampaignLeads.ts";
import {
  LEADS_COST_PER_LEAD_KEY,
  LEADS_TOTAL_KEY,
  LEADS_VISIT_RATE_KEY,
} from "./googleAdsSynckerjaLeadsMetrics.ts";
import {
  TRAFFIC_TOTAL_VISIT_PAGE_KEY,
  TRAFFIC_VISIT_CLICK_RATE_KEY,
} from "./googleAdsSynckerjaTrafficMetrics.ts";

const ALL_SYNCKERJA_METRIC_KEYS = [
  TRAFFIC_TOTAL_VISIT_PAGE_KEY,
  TRAFFIC_VISIT_CLICK_RATE_KEY,
  LEADS_TOTAL_KEY,
  LEADS_VISIT_RATE_KEY,
  LEADS_COST_PER_LEAD_KEY,
];

function parseNumField(value: unknown): number {
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function metaRowToNormalized(row: Record<string, unknown>): NormalizedMetricsRowLike {
  const campaignId = String(row.campaign_id ?? "").trim();
  const campaignName = String(row.campaign_name ?? "").trim();
  return {
    id: campaignId || `meta-${campaignName}`,
    identity: { name: campaignName, campaign_id: campaignId },
    metrics: {
      clicks: parseNumField(row.clicks),
      spent: parseNumField(row.spend),
    },
  };
}

function copySynckerjaMetricsBack(
  metaRow: Record<string, unknown>,
  normalized: NormalizedMetricsRowLike,
): void {
  for (const key of ALL_SYNCKERJA_METRIC_KEYS) {
    const v = normalized.metrics[key];
    if (v != null && Number.isFinite(v)) {
      metaRow[key] = v;
    } else {
      metaRow[key] = null;
    }
  }
}

/** Enrich Meta campaign insight rows with Synckerja traffic + leads metrics. */
export async function maybeEnrichMetaCampaignRowsWithSynckerja(
  admin: SupabaseClient,
  organizationId: string,
  dateStart: string,
  dateEnd: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;

  const wrappers = rows.map(metaRowToNormalized);

  await maybeEnrichCampaignTrafficRows(
    admin,
    organizationId,
    "campaign",
    dateStart,
    dateEnd,
    wrappers,
    ALL_SYNCKERJA_METRIC_KEYS,
  );

  await maybeEnrichCampaignLeadsRows(
    admin,
    organizationId,
    "campaign",
    dateStart,
    dateEnd,
    wrappers,
    ALL_SYNCKERJA_METRIC_KEYS,
  );

  for (let i = 0; i < rows.length; i++) {
    copySynckerjaMetricsBack(rows[i]!, wrappers[i]!);
  }
}
