/**
 * Meta ad set and ad rows for the MCP ads breakdown.
 *
 * The dashboard's meta-ads-metrics function already returns ad set and ad insight rows,
 * but only campaign rows carry the objective and ad set optimization goals that decide
 * which action counts as a Result. Each ad set or ad row borrows them from its campaign,
 * so its Results match the campaign tab and Ads Manager.
 */
import { metaCampaignResult } from "./metaResults.ts";

export type BreakdownLevel = "adset" | "ad";

export type BreakdownRow = {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string | null;
  adset_name: string | null;
  delivery: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  results: number;
  results_label: string;
  result_value: number | null;
};

export const MAX_BREAKDOWN_ROWS = 50;

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

/** Objective and ad set goals per campaign id, read from campaign rows of the same period. */
export function campaignGoals(campaignRows: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const goals = new Map<string, Record<string, unknown>>();
  for (const row of campaignRows) {
    const id = text(row.campaign_id);
    if (!id) continue;
    const entry: Record<string, unknown> = {};
    if (text(row.objective)) entry.objective = row.objective;
    if (Array.isArray(row.optimization_goals)) entry.optimization_goals = row.optimization_goals;
    goals.set(id, entry);
  }
  return goals;
}

export function breakdownRow(
  level: BreakdownLevel,
  raw: Record<string, unknown>,
  goals: Map<string, Record<string, unknown>>,
): BreakdownRow {
  const campaignId = text(raw.campaign_id);
  const result = metaCampaignResult({ ...raw, ...(goals.get(campaignId) ?? {}) });
  const adsetId = text(raw.adset_id);
  const adsetName = text(raw.adset_name);
  const id = level === "ad" ? text(raw.ad_id) : adsetId;
  const name = level === "ad" ? text(raw.ad_name) : adsetName;
  return {
    id,
    name: name || (level === "ad" ? "Ad" : "Ad set"),
    campaign_id: campaignId,
    campaign_name: text(raw.campaign_name) || "Campaign",
    adset_id: level === "ad" ? adsetId || null : null,
    adset_name: level === "ad" ? adsetName || null : null,
    delivery: text(raw.delivery) || null,
    spend: asNumber(raw.spend),
    impressions: asNumber(raw.impressions),
    clicks: asNumber(raw.clicks),
    reach: asNumber(raw.reach),
    results: result.results,
    results_label: result.results_label,
    result_value: result.result_value,
  };
}

/** Rows for one level, optionally inside one campaign, highest spend first and capped. */
export function breakdownRows(
  level: BreakdownLevel,
  entityRows: Record<string, unknown>[],
  campaignRows: Record<string, unknown>[],
  campaignId: string | null,
): { rows: BreakdownRow[]; truncated: boolean } {
  const goals = campaignGoals(campaignRows);
  const rows = entityRows
    .filter((raw) => !campaignId || text(raw.campaign_id) === campaignId)
    .map((raw) => breakdownRow(level, raw, goals))
    .filter((row) => row.id)
    .sort((left, right) => right.spend - left.spend || right.impressions - left.impressions);
  return {
    rows: rows.slice(0, MAX_BREAKDOWN_ROWS),
    truncated: rows.length > MAX_BREAKDOWN_ROWS,
  };
}
