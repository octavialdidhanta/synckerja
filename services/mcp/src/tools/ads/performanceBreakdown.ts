import type { McpAuthContext } from "../../authz/context";
import { calendarDay, monthPattern } from "../inputs";
import { resolveAdsPerformancePeriod } from "./performanceSummary";
import { z } from "zod";

/** Meta ids are digits; account ids may be written with the act_ prefix. */
const metaId = z.string().trim().regex(/^(act_)?\d{1,30}$/);

export const adsBreakdownInput = z
  .object({
    level: z.enum(["ad", "adset"]).optional(),
    month: z.string().regex(monthPattern).optional(),
    date_start: calendarDay.optional(),
    date_end: calendarDay.optional(),
    account_id: metaId.optional(),
    campaign_id: metaId.optional(),
  })
  .strict();

export type AdsBreakdownLevel = "ad" | "adset";

export type AdsBreakdownQuery = {
  level: AdsBreakdownLevel;
  month: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  accountId: string | null;
  campaignId: string | null;
};

export type AdsBreakdownSourceItem = {
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
  reach: number | null;
  results: number | null;
  results_label: string | null;
  result_value: number | null;
};

export type AdsBreakdownSourceAccount = {
  platform: string;
  label: string | null;
  account_id: string;
  currency: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  rows?: AdsBreakdownSourceItem[];
  rows_truncated?: boolean;
  error: string | null;
  note: string | null;
};

export type AdsBreakdownSource = {
  period: { start: string; end: string; clipped: boolean };
  level?: string;
  truncated: boolean;
  accounts: AdsBreakdownSourceAccount[];
};

export type AdsBreakdownItem = AdsBreakdownSourceItem & {
  rank: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cost_per_result: number | null;
  roas: number | null;
  share_of_spend: number | null;
  share_of_results: number | null;
};

export type AdsBreakdownAccount = {
  platform: "meta";
  label: string | null;
  account_id: string;
  status: "ok" | "unavailable";
  currency: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  rows: AdsBreakdownItem[];
  rows_truncated: boolean;
  best: {
    lowest_cost_per_result: string | null;
    most_results: string | null;
    highest_ctr: string | null;
    lowest_cpm: string | null;
  };
  note: string | null;
  error: string | null;
};

export type AdsBreakdown = {
  period: { start: string; end: string; clipped: boolean };
  level: AdsBreakdownLevel;
  how_to_read: string;
  accounts: AdsBreakdownAccount[];
  readings: string[];
  notes: string[];
};

const HOW_TO_READ =
  "These rows are the Meta Ads or Ad sets tab on the Synckerja Meta ads page for the period above, highest spend first. Account spend, impressions, clicks, and reach are the summary bar for the whole tab. Results follow the campaign objective and ad set goal like Results in Ads Manager, and results_label names them, for example messaging conversations started, purchases, link clicks, or leads. Only purchases have a value, so ROAS is empty for other results. Clicks are link clicks and CTR is a percentage. best names the row id that leads each metric among rows with delivery; cost per result is compared only between rows with the same results_label and at least one result. Small numbers of results in a short period are noisy, so say so before calling a winner. Do not treat an unavailable account as zero.";

/** Rows below this share of the account's spend are too small to call a winner on cost. */
const MIN_SPEND_SHARE = 0.05;

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundOrNull(value: number | null | undefined, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return roundTo(value, digits);
}

function stripAct(value: string): string {
  return value.replace(/^act_/, "");
}

export function parseAdsBreakdownQuery(args: unknown): AdsBreakdownQuery | null {
  const parsed = adsBreakdownInput.safeParse(args ?? {});
  if (!parsed.success) return null;
  const month = parsed.data.month ?? null;
  const dateStart = parsed.data.date_start ?? null;
  const dateEnd = parsed.data.date_end ?? null;
  if (month && (dateStart || dateEnd)) return null;
  if ((dateStart == null) !== (dateEnd == null)) return null;
  if (dateStart && dateEnd && dateStart > dateEnd) return null;
  return {
    level: parsed.data.level ?? "ad",
    month,
    dateStart,
    dateEnd,
    accountId: parsed.data.account_id ? stripAct(parsed.data.account_id) : null,
    campaignId: parsed.data.campaign_id ? stripAct(parsed.data.campaign_id) : null,
  };
}

export function resolveAdsBreakdownPeriod(query: AdsBreakdownQuery, now = new Date()) {
  return resolveAdsPerformancePeriod({
    month: query.month,
    dateStart: query.dateStart,
    dateEnd: query.dateEnd,
    platform: "meta",
  }, now);
}

function rates(spend: number, impressions: number, clicks: number) {
  return {
    ctr: impressions > 0 ? roundTo((clicks / impressions) * 100, 2) : null,
    cpc: clicks > 0 ? roundTo(spend / clicks, 2) : null,
    cpm: impressions > 0 ? roundTo((spend / impressions) * 1000, 2) : null,
  };
}

function deriveItem(row: AdsBreakdownSourceItem, accountSpend: number, labelResults: Map<string, number>): AdsBreakdownItem {
  const spend = roundOrNull(row.spend, 2) ?? 0;
  const impressions = roundOrNull(row.impressions, 0) ?? 0;
  const clicks = roundOrNull(row.clicks, 0) ?? 0;
  const results = roundOrNull(row.results, 2);
  const resultValue = row.result_value != null && row.result_value > 0 ? roundTo(row.result_value, 2) : null;
  const labelTotal = row.results_label ? labelResults.get(row.results_label) ?? 0 : 0;
  return {
    ...row,
    name: row.name.trim() || "Ad",
    spend,
    impressions,
    clicks,
    reach: roundOrNull(row.reach, 0),
    results,
    result_value: resultValue,
    rank: 0,
    ...rates(spend, impressions, clicks),
    cost_per_result: results != null && results > 0 ? roundTo(spend / results, 2) : null,
    roas: spend > 0 && resultValue != null ? roundTo(resultValue / spend, 2) : null,
    share_of_spend: accountSpend > 0 ? roundTo((spend / accountSpend) * 100, 1) : null,
    share_of_results: labelTotal > 0 && results != null ? roundTo((results / labelTotal) * 100, 1) : null,
  };
}

/** The single row id that is strictly best on one metric, or null on a tie or no candidates. */
function bestId(
  rows: AdsBreakdownItem[],
  value: (row: AdsBreakdownItem) => number | null,
  direction: "higher" | "lower",
): string | null {
  const scored = rows
    .map((row) => ({ row, score: value(row) }))
    .filter((item): item is { row: AdsBreakdownItem; score: number } => item.score != null);
  if (scored.length < 2) return null;
  scored.sort((a, b) => (direction === "higher" ? b.score - a.score : a.score - b.score));
  if (scored[0].score === scored[1].score) return null;
  return scored[0].row.id;
}

/** Most common results label among rows with results, used to compare like with like. */
function mainLabel(rows: AdsBreakdownItem[]): string | null {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.results_label || !row.results) continue;
    totals.set(row.results_label, (totals.get(row.results_label) ?? 0) + row.results);
  }
  let best: string | null = null;
  let max = 0;
  for (const [label, total] of totals) {
    if (total > max) {
      best = label;
      max = total;
    }
  }
  return best;
}

function deriveAccount(row: AdsBreakdownSourceAccount): AdsBreakdownAccount {
  const empty = { lowest_cost_per_result: null, most_results: null, highest_ctr: null, lowest_cpm: null };
  if (row.error) {
    return {
      platform: "meta",
      label: row.label,
      account_id: row.account_id,
      status: "unavailable",
      currency: null,
      spend: null,
      impressions: null,
      clicks: null,
      reach: null,
      ctr: null,
      cpc: null,
      cpm: null,
      rows: [],
      rows_truncated: false,
      best: empty,
      note: row.note,
      error: row.error,
    };
  }
  const spend = roundOrNull(row.spend ?? 0, 2) ?? 0;
  const impressions = roundOrNull(row.impressions ?? 0, 0) ?? 0;
  const clicks = roundOrNull(row.clicks ?? 0, 0) ?? 0;
  const source = row.rows ?? [];
  const labelResults = new Map<string, number>();
  for (const item of source) {
    if (!item.results_label || !item.results) continue;
    labelResults.set(item.results_label, (labelResults.get(item.results_label) ?? 0) + item.results);
  }
  const rows = source
    .map((item) => deriveItem(item, spend, labelResults))
    .sort((a, b) => b.spend - a.spend || b.impressions - a.impressions)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const delivered = rows.filter((item) => item.spend > 0 || item.impressions > 0);
  const label = mainLabel(delivered);
  const sameLabel = delivered.filter((item) => item.results_label === label);
  const meaningful = sameLabel.filter((item) => spend <= 0 || item.spend / spend >= MIN_SPEND_SHARE);

  return {
    platform: "meta",
    label: row.label,
    account_id: row.account_id,
    status: "ok",
    currency: row.currency,
    spend,
    impressions,
    clicks,
    reach: roundOrNull(row.reach, 0),
    ...rates(spend, impressions, clicks),
    rows,
    rows_truncated: row.rows_truncated === true,
    best: {
      lowest_cost_per_result: bestId(meaningful, (item) => item.cost_per_result, "lower"),
      most_results: bestId(sameLabel, (item) => item.results && item.results > 0 ? item.results : null, "higher"),
      highest_ctr: bestId(delivered.filter((item) => item.impressions >= 500), (item) => item.ctr, "higher"),
      lowest_cpm: bestId(delivered.filter((item) => item.impressions >= 500), (item) => item.cpm, "lower"),
    },
    note: row.note,
    error: null,
  };
}

function nameOf(account: AdsBreakdownAccount, id: string | null): string | null {
  if (!id) return null;
  return account.rows.find((row) => row.id === id)?.name ?? null;
}

export function presentAdsBreakdown(source: AdsBreakdownSource, level: AdsBreakdownLevel): AdsBreakdown {
  const accounts = source.accounts
    .filter((row) => row.platform === "meta")
    .map(deriveAccount)
    .sort((a, b) => (a.label ?? a.account_id).localeCompare(b.label ?? b.account_id));

  const noun = level === "ad" ? "ad" : "ad set";
  const readings: string[] = [];
  for (const account of accounts) {
    if (account.status !== "ok") continue;
    const who = account.label ?? account.account_id;
    const delivered = account.rows.filter((row) => row.spend > 0 || row.impressions > 0);
    if (delivered.length === 0) {
      readings.push(`${who} has no ${noun} delivery in this period.`);
      continue;
    }
    const cheapest = account.rows.find((row) => row.id === account.best.lowest_cost_per_result);
    if (cheapest) {
      readings.push(
        `${who}: ${cheapest.name} has the lowest cost per ${cheapest.results_label ?? "result"} at ${cheapest.cost_per_result} ${account.currency ?? ""}`.trimEnd()
          + ` from ${cheapest.results} results and ${cheapest.share_of_spend ?? 0}% of spend.`,
      );
    }
    const most = nameOf(account, account.best.most_results);
    if (most && account.best.most_results !== account.best.lowest_cost_per_result) {
      readings.push(`${who}: ${most} brings the most results.`);
    }
    const idle = delivered.filter((row) => (row.results ?? 0) === 0 && row.spend > 0);
    if (idle.length > 0) {
      readings.push(`${who}: ${idle.length} ${noun}${idle.length > 1 ? "s" : ""} spent without a result: ${idle.map((row) => row.name).join(", ")}.`);
    }
    if (delivered.length === 1) {
      readings.push(`${who}: only one ${noun} delivered, so there is nothing to compare it with.`);
    }
  }

  const notes: string[] = [];
  if (source.period.clipped) {
    notes.push("The requested range was longer than 366 days, so it was cut to the latest 366 days.");
  }
  if (source.truncated) notes.push("Only the first 12 active ad accounts are included.");
  for (const account of accounts) {
    const who = account.label ?? account.account_id;
    if (account.note) notes.push(`${who}: ${account.note}`);
    if (account.rows_truncated) notes.push(`${who}: more ${noun}s exist than are listed.`);
  }
  if (accounts.length === 0) notes.push("No active Meta ad account is connected, or none matches account_id.");
  else if (accounts.every((row) => row.status === "unavailable")) notes.push("Meta ad performance could not be loaded.");

  return {
    period: source.period,
    level,
    how_to_read: HOW_TO_READ,
    accounts,
    readings,
    notes,
  };
}

export function adsBreakdownResult(
  ctx: McpAuthContext,
  query: AdsBreakdownQuery,
  list: (ctx: McpAuthContext, query: AdsBreakdownQuery) => Promise<AdsBreakdown>,
): Promise<AdsBreakdown> {
  return list(ctx, query);
}
