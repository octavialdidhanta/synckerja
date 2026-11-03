/**
 * Segment buckets (age, gender, region, placement, device, hour, day) for the MCP ads tools.
 * Results per bucket follow the same campaign objective and ad set goal as the campaign tab,
 * so a chat campaign counts messaging conversations started in every segment.
 */
import { actionCounts, metaCampaignResult } from "./metaResults.ts";

export type SegmentBucket = {
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  results: number | null;
  results_label: string | null;
};

export type SegmentGoal = { objective?: unknown; optimization_goals?: unknown } | null;

function num(value: unknown): number {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function segmentKey(dimension: string, row: Record<string, unknown>): string | null {
  if (dimension === "placement") {
    const publisher = text(row.publisher_platform).toLowerCase();
    const position = text(row.platform_position).toLowerCase();
    if (!publisher) return null;
    return position ? `${publisher} / ${position}` : publisher;
  }
  if (dimension === "device") return text(row.device_platform).toLowerCase() || null;
  if (dimension === "hour") {
    const match = /^(\d{1,2})/.exec(text(row.hourly_stats_aggregated_by_advertiser_time_zone));
    if (!match) return null;
    const hour = Number(match[1]);
    return hour >= 0 && hour <= 23 ? `${String(hour).padStart(2, "0")}:00` : null;
  }
  if (dimension === "day") return /^\d{4}-\d{2}-\d{2}/.test(text(row.date_start)) ? text(row.date_start).slice(0, 10) : null;
  const key = text(row[dimension]);
  if (!key) return null;
  return key.toLowerCase() === "unknown" ? "unknown" : key;
}

/** Purchases from the standard actions list; omni rows already include the parts. */
function purchaseCount(counts: Map<string, number>): number {
  for (const type of ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_conversion.purchase"]) {
    if (counts.has(type)) return counts.get(type) ?? 0;
  }
  return 0;
}

/**
 * The single result label all campaigns in scope agree on, with the goal used to count it.
 * Mixed labels return null: a segment cannot add chats to link clicks.
 */
export function scopeGoal(
  campaignRows: Record<string, unknown>[],
  campaignIds: Set<string> | null,
): { goal: SegmentGoal; label: string | null; mixed: boolean } {
  const inScope = campaignRows.filter((row) => {
    const id = text(row.campaign_id);
    if (campaignIds) return campaignIds.has(id);
    return num(row.spend) > 0;
  });
  const labels = new Map<string, SegmentGoal>();
  for (const row of inScope) {
    const result = metaCampaignResult(row);
    if (!labels.has(result.results_label)) {
      labels.set(result.results_label, { objective: row.objective, optimization_goals: row.optimization_goals });
    }
  }
  if (labels.size === 1) {
    const [[label, goal]] = [...labels.entries()];
    return { goal, label, mixed: false };
  }
  return { goal: null, label: null, mixed: labels.size > 1 };
}

export function segmentBuckets(
  dimension: string,
  rows: Record<string, unknown>[],
  goal: SegmentGoal,
): SegmentBucket[] {
  const totals = new Map<string, { spend: number; impressions: number; clicks: number; reach: number; actions: Map<string, number> }>();
  for (const row of rows) {
    const key = segmentKey(dimension, row);
    if (!key) continue;
    const current = totals.get(key) ?? { spend: 0, impressions: 0, clicks: 0, reach: 0, actions: new Map<string, number>() };
    current.spend += num(row.spend);
    current.impressions += num(row.impressions);
    current.clicks += num(row.inline_link_clicks);
    // Reach is not additive across rows; it is only summed for daily rows of one segment, so keep the largest.
    current.reach = Math.max(current.reach, num(row.reach));
    for (const [type, count] of actionCounts(row.actions)) {
      current.actions.set(type, (current.actions.get(type) ?? 0) + count);
    }
    totals.set(key, current);
  }
  return [...totals.entries()].map(([key, value]) => {
    let results: number | null = null;
    let label: string | null = null;
    if (goal) {
      const actions = [...value.actions.entries()].map(([action_type, count]) => ({ action_type, value: count }));
      const result = metaCampaignResult({
        objective: goal.objective,
        optimization_goals: goal.optimization_goals,
        actions,
        reach: value.reach,
        impressions: value.impressions,
        purchases: purchaseCount(value.actions),
      });
      results = result.results;
      label = result.results_label;
    }
    return {
      key,
      spend: value.spend,
      impressions: value.impressions,
      clicks: value.clicks,
      reach: value.reach,
      results,
      results_label: label,
    };
  });
}
