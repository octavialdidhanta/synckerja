import { ADS_PAGE_PATHS, type McpAuthContext } from "../../authz/context";
import { calendarDay, monthPattern } from "../inputs";
import { z } from "zod";

export const adsPerformanceInput = z
  .object({
    month: z.string().regex(monthPattern).optional(),
    date_start: calendarDay.optional(),
    date_end: calendarDay.optional(),
    platform: z.enum(["google", "meta", "tiktok"]).optional(),
  })
  .strict();

export type AdsPlatform = "google" | "meta" | "tiktok";

export type AdsPerformanceQuery = {
  month: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  platform: AdsPlatform | null;
};

export type AdsCampaignSource = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  results: number | null;
  results_label: "conversions" | "purchases" | null;
  result_value: number | null;
};

export type AdsPerformanceSourceRow = {
  platform: AdsPlatform;
  label: string | null;
  account_id: string;
  currency: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  results: number | null;
  results_label: "conversions" | "purchases" | null;
  result_value: number | null;
  campaigns?: AdsCampaignSource[];
  campaigns_truncated?: boolean;
  error: string | null;
  note: string | null;
};

export type AdsPerformanceSource = {
  period: { start: string; end: string; clipped: boolean };
  matches_dashboard?: boolean;
  truncated: boolean;
  accounts: AdsPerformanceSourceRow[];
};

export type AdsCampaign = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  results_label: "conversions" | "purchases" | null;
  cost_per_result: number | null;
  result_value: number | null;
  roas: number | null;
};

export type AdsPerformanceAccount = {
  platform: AdsPlatform;
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
  results: number | null;
  results_label: "conversions" | "purchases" | null;
  cost_per_result: number | null;
  result_value: number | null;
  roas: number | null;
  campaigns: AdsCampaign[];
  campaigns_truncated: boolean;
  leading_metrics: string[];
  note: string | null;
  error: string | null;
};

export type AdsPerformanceLeader = {
  metric: "roas" | "cost_per_result" | "ctr" | "cpc" | "cpm";
  direction: "higher" | "lower";
  currency: string | null;
  platform: AdsPlatform;
  label: string | null;
  account_id: string;
  value: number;
};

export type AdsPerformanceSummary = {
  period: { start: string; end: string; clipped: boolean };
  how_to_read: string;
  accounts: AdsPerformanceAccount[];
  leaders: AdsPerformanceLeader[];
  performance_leader: {
    platform: AdsPlatform;
    label: string | null;
    account_id: string;
    currency: string | null;
    leading_metrics: string[];
  } | null;
  comparisons: string[];
  readings: string[];
  notes: string[];
};

const HOW_TO_READ_ALIGNED =
  "These numbers are the campaign tab on the Synckerja ads pages for the period above. When no date is requested, the period is the last 30 days in Asia/Jakarta, the same default as those pages. If the date picker on screen is different, pass that date_start and date_end before comparing. Google includes campaigns with delivery and does not limit to Enabled, matching the Delivery and Enabled switches at their defaults. Account spend, impressions, clicks, and results are the summary bar for the whole tab. campaigns lists the highest-spend campaigns from that tab. If campaigns_truncated is true, more campaigns exist and the account total still includes them. Meta account totals can differ from adding the campaign rows; quote the account fields for the summary bar and campaigns for one campaign. TikTok purchases and ROAS are not on that tab, so they are empty. CTR is a percentage. ROAS of 1 or more means return covers spend. Google results are conversions. Meta results are purchases, and Meta clicks are link clicks. A leader is chosen only when at least two accounts with that metric share a currency for money metrics. Do not treat an unavailable account as zero.";

const HOW_TO_READ_ACCOUNT =
  "These are account totals, not the campaign tab on the Synckerja ads pages. Do not present them as campaign performance or as a match for the dashboard until matches_dashboard is true. CTR is a percentage. Do not treat an unavailable account as zero.";

const METRICS = [
  { key: "roas", direction: "higher", money: true },
  { key: "cost_per_result", direction: "lower", money: true },
  { key: "ctr", direction: "higher", money: false },
  { key: "cpc", direction: "lower", money: true },
  { key: "cpm", direction: "lower", money: true },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const MAX_INCLUSIVE_DAYS = 366;

export function parseAdsPerformanceQuery(args: unknown): AdsPerformanceQuery | null {
  const parsed = adsPerformanceInput.safeParse(args ?? {});
  if (!parsed.success) return null;
  const month = parsed.data.month ?? null;
  const dateStart = parsed.data.date_start ?? null;
  const dateEnd = parsed.data.date_end ?? null;
  if (month && (dateStart || dateEnd)) return null;
  if ((dateStart == null) !== (dateEnd == null)) return null;
  if (dateStart && dateEnd && dateStart > dateEnd) return null;
  return {
    month,
    dateStart,
    dateEnd,
    platform: parsed.data.platform ?? null,
  };
}

export function jakartaYmd(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthEnd(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

function inclusiveDays(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000) + 1;
}

export function resolveAdsPerformancePeriod(
  input: AdsPerformanceQuery,
  now = new Date(),
): { start: string; end: string; clipped: boolean } {
  if (input.month && (input.dateStart || input.dateEnd)) throw new Error("invalid_input");
  if ((input.dateStart == null) !== (input.dateEnd == null)) throw new Error("invalid_input");
  if (input.dateStart && input.dateEnd && input.dateStart > input.dateEnd) throw new Error("invalid_input");

  const today = jakartaYmd(now);
  let start: string;
  let end: string;
  if (input.dateStart && input.dateEnd) {
    start = input.dateStart;
    end = input.dateEnd;
  } else if (input.month) {
    start = `${input.month}-01`;
    end = monthEnd(input.month);
    if (end > today) end = today;
  } else {
    end = today;
    start = shiftYmd(today, -29);
  }
  if (start > end || start > today) throw new Error("invalid_input");

  let clipped = false;
  if (inclusiveDays(start, end) > MAX_INCLUSIVE_DAYS) {
    start = shiftYmd(end, -(MAX_INCLUSIVE_DAYS - 1));
    clipped = true;
  }
  return { start, end, clipped };
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundOrNull(value: number | null, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return roundTo(value, digits);
}

function accountName(row: { platform: string; label: string | null; account_id: string }): string {
  const label = row.label?.trim();
  return label ? `${row.platform} ${label}` : `${row.platform} ${row.account_id}`;
}

function metricValue(row: AdsPerformanceAccount, key: MetricKey): number | null {
  return row[key];
}

function deriveRates(input: {
  spend: number;
  impressions: number;
  clicks: number;
  results: number | null;
  resultValue: number | null;
}): Pick<AdsCampaign, "ctr" | "cpc" | "cpm" | "cost_per_result" | "roas"> {
  return {
    ctr: input.impressions > 0 ? roundTo((input.clicks / input.impressions) * 100, 2) : null,
    cpc: input.clicks > 0 ? roundTo(input.spend / input.clicks, 2) : null,
    cpm: input.impressions > 0 ? roundTo((input.spend / input.impressions) * 1000, 2) : null,
    cost_per_result: input.results != null && input.results > 0 ? roundTo(input.spend / input.results, 2) : null,
    roas: input.spend > 0 && input.resultValue != null ? roundTo(input.resultValue / input.spend, 2) : null,
  };
}

function deriveCampaign(row: AdsCampaignSource): AdsCampaign {
  const spend = roundOrNull(row.spend, 2) ?? 0;
  const impressions = roundOrNull(row.impressions, 0) ?? 0;
  const clicks = roundOrNull(row.clicks, 0) ?? 0;
  const results = roundOrNull(row.results, 2);
  const resultValue = row.result_value != null && row.result_value > 0 ? roundTo(row.result_value, 2) : null;
  return {
    id: row.id,
    name: row.name.trim() || "Campaign",
    spend,
    impressions,
    clicks,
    reach: roundOrNull(row.reach, 0),
    results,
    results_label: row.results_label,
    result_value: resultValue,
    ...deriveRates({ spend, impressions, clicks, results, resultValue }),
  };
}

function deriveAccount(row: AdsPerformanceSourceRow): AdsPerformanceAccount {
  if (row.error) {
    return {
      platform: row.platform,
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
      results: null,
      results_label: row.results_label,
      cost_per_result: null,
      result_value: null,
      roas: null,
      campaigns: [],
      campaigns_truncated: false,
      leading_metrics: [],
      note: row.note,
      error: row.error,
    };
  }

  const spend = roundOrNull(row.spend ?? 0, 2) ?? 0;
  const impressions = roundOrNull(row.impressions ?? 0, 0) ?? 0;
  const clicks = roundOrNull(row.clicks ?? 0, 0) ?? 0;
  const results = roundOrNull(row.results, 2);
  const resultValue = row.result_value != null && row.result_value > 0 ? roundTo(row.result_value, 2) : null;
  const campaigns = (row.campaigns ?? [])
    .map(deriveCampaign)
    .sort((left, right) => right.spend - left.spend || right.impressions - left.impressions);

  return {
    platform: row.platform,
    label: row.label,
    account_id: row.account_id,
    status: "ok",
    currency: row.currency,
    spend,
    impressions,
    clicks,
    reach: roundOrNull(row.reach, 0),
    ...deriveRates({ spend, impressions, clicks, results, resultValue }),
    results,
    results_label: row.results_label,
    result_value: resultValue,
    campaigns,
    campaigns_truncated: row.campaigns_truncated === true,
    leading_metrics: [],
    note: row.note,
    error: null,
  };
}

function hasDelivery(row: AdsPerformanceAccount): boolean {
  return row.status === "ok" && ((row.spend ?? 0) > 0 || (row.impressions ?? 0) > 0);
}

function leaderSentence(leader: AdsPerformanceLeader, resultsLabel: "conversions" | "purchases" | null): string {
  const name = accountName(leader);
  if (leader.metric === "roas") return `${name} has the highest ROAS at ${leader.value}.`;
  if (leader.metric === "ctr") return `${name} has the highest CTR at ${leader.value}%.`;
  const money = `${leader.value} ${leader.currency}`;
  if (leader.metric === "cpc") return `${name} has the lowest CPC at ${money}.`;
  if (leader.metric === "cpm") return `${name} has the lowest CPM at ${money}.`;
  const resultName = resultsLabel === "purchases" ? "purchase" : "conversion";
  return `${name} has the lowest cost per ${resultName} at ${money}.`;
}

export function presentAdsPerformance(source: AdsPerformanceSource): AdsPerformanceSummary {
  const accounts = [...source.accounts]
    .map(deriveAccount)
    .sort((a, b) => {
      const platform = a.platform.localeCompare(b.platform);
      if (platform !== 0) return platform;
      return (a.label ?? a.account_id).localeCompare(b.label ?? b.account_id);
    });

  const leaders: AdsPerformanceLeader[] = [];
  for (const metric of METRICS) {
    const eligible = accounts.filter((row) => metricValue(row, metric.key) != null && hasDelivery(row));
    const groups = metric.money
      ? [...new Map(
          eligible
            .filter((row) => row.currency)
            .map((row) => [row.currency as string, eligible.filter((item) => item.currency === row.currency)] as const),
        ).values()]
      : [eligible];

    for (const group of groups) {
      if (group.length < 2) continue;
      const ranked = [...group].sort((a, b) => {
        const left = metricValue(a, metric.key) ?? 0;
        const right = metricValue(b, metric.key) ?? 0;
        return metric.direction === "higher" ? right - left : left - right;
      });
      const winner = ranked[0];
      const best = metricValue(winner, metric.key);
      if (best == null) continue;
      const tied = group.filter((row) => metricValue(row, metric.key) === best);
      if (tied.length !== 1) continue;
      leaders.push({
        metric: metric.key,
        direction: metric.direction,
        currency: metric.money ? winner.currency : null,
        platform: winner.platform,
        label: winner.label,
        account_id: winner.account_id,
        value: best,
      });
    }
  }

  for (const account of accounts) {
    account.leading_metrics = leaders
      .filter((leader) => leader.platform === account.platform && leader.account_id === account.account_id)
      .map((leader) => leader.metric);
  }

  const scores = new Map<string, { account: AdsPerformanceAccount; metrics: string[] }>();
  for (const leader of leaders) {
    const key = `${leader.platform}:${leader.account_id}`;
    const current = scores.get(key) ?? {
      account: accounts.find((row) => row.platform === leader.platform && row.account_id === leader.account_id)!,
      metrics: [],
    };
    current.metrics.push(leader.metric);
    scores.set(key, current);
  }
  const rankedScores = [...scores.values()].sort((a, b) => b.metrics.length - a.metrics.length);
  const top = rankedScores[0];
  const tiedForLead = top != null && rankedScores.filter((row) => row.metrics.length === top.metrics.length).length > 1;
  const performanceLeader = top && !tiedForLead
    ? {
        platform: top.account.platform,
        label: top.account.label,
        account_id: top.account.account_id,
        currency: top.account.currency,
        leading_metrics: top.metrics,
      }
    : null;

  const comparisons: string[] = [];
  if (performanceLeader) {
    comparisons.push(
      `${accountName(performanceLeader)} is the performance leader because it leads ${performanceLeader.leading_metrics.join(", ")}.`,
    );
  }
  for (const leader of leaders) {
    const account = accounts.find((row) => row.platform === leader.platform && row.account_id === leader.account_id);
    comparisons.push(leaderSentence(leader, account?.results_label ?? null));
  }

  const readings: string[] = [];
  for (const account of accounts) {
    if (account.status !== "ok" || !hasDelivery(account)) continue;
    const name = accountName(account);
    if (account.roas != null) {
      readings.push(
        account.roas >= 1
          ? `${name} ROAS ${account.roas} covers spend.`
          : `${name} ROAS ${account.roas} is below spend.`,
      );
    } else if ((account.results ?? 0) > 0) {
      readings.push(`${name} recorded ${account.results} ${account.results_label ?? "results"} but no result value, so ROAS is unavailable.`);
    } else if ((account.spend ?? 0) > 0) {
      const noun = account.results_label === "purchases" ? "purchases" : "conversions";
      readings.push(`${name} spent ${account.spend} ${account.currency ?? ""}`.trim() + ` and recorded no ${noun}.`);
    }
  }

  const notes: string[] = [];
  if (source.period.clipped) {
    notes.push("The requested range was longer than 366 days, so it was cut to the latest 366 days.");
  }
  if (source.truncated) notes.push("Only the first 12 active ad accounts are included.");
  for (const account of accounts) {
    if (account.note) notes.push(`${accountName(account)}: ${account.note}`);
  }
  const comparable = accounts.filter(hasDelivery);
  const unavailable = accounts.filter((row) => row.status === "unavailable");
  if (unavailable.length > 0 && unavailable.length < accounts.length) {
    notes.push("Some accounts could not be loaded. Do not treat them as zero.");
  }
  const currencies = new Set(comparable.map((row) => row.currency).filter((currency): currency is string => Boolean(currency)));
  if (currencies.size > 1) notes.push("Money metrics are compared only inside the same currency.");
  if (accounts.length === 0) notes.push("No active ad accounts are connected.");
  else if (unavailable.length === accounts.length) notes.push("Ad performance could not be loaded.");
  else if (comparable.length === 0) notes.push("No ad delivery in this period.");
  else if (comparable.length === 1) {
    notes.push("Only one account returned metrics, so this is not a comparison. Read roas on that account: 1 or more means return covers spend.");
  } else if (tiedForLead) {
    notes.push("No single account leads. The leaders list shows the best account for each metric.");
  }

  return {
    period: source.period,
    how_to_read: source.matches_dashboard ? HOW_TO_READ_ALIGNED : HOW_TO_READ_ACCOUNT,
    accounts,
    leaders,
    performance_leader: performanceLeader,
    comparisons,
    readings,
    notes,
  };
}

export function adsPerformanceDenial(ctx: McpAuthContext | null): string {
  if (!ctx?.organizationId || ctx.membershipActive === false) return "forbidden: organization mismatch";
  if (!ctx.scopes.includes("ads:read")) return "forbidden: missing scope ads:read";
  if (!ctx.modules.digitalMarketing) return "forbidden: module digitalMarketing disabled";
  const pageAllowed = ADS_PAGE_PATHS.some((path) => ctx.pages[path] === true);
  if (!pageAllowed) {
    const ownerOrAdmin = ctx.roles.some((role) => {
      const name = role.trim().toLowerCase();
      return name === "owner" || name === "admin";
    });
    return ownerOrAdmin
      ? "forbidden: page access denied"
      : "forbidden: role not allowed (owner/admin required)";
  }
  return "forbidden: organization mismatch";
}

export function adsPerformanceResult(
  ctx: McpAuthContext,
  query: AdsPerformanceQuery,
  list: (ctx: McpAuthContext, query: AdsPerformanceQuery) => Promise<AdsPerformanceSummary>,
): Promise<AdsPerformanceSummary> {
  return list(ctx, query);
}
