import type { McpAuthContext } from "../../authz/context";
import { calendarDay, monthPattern } from "../inputs";
import { resolveAdsPerformancePeriod } from "./performanceSummary";
import { z } from "zod";

const metaId = z.string().trim().regex(/^(act_)?\d{1,30}$/);

export const adsAudienceInput = z
  .object({
    month: z.string().regex(monthPattern).optional(),
    date_start: calendarDay.optional(),
    date_end: calendarDay.optional(),
    account_id: metaId.optional(),
    campaign_id: metaId.optional(),
    adset_id: metaId.optional(),
  })
  .strict();

export type AdsAudienceQuery = {
  month: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  accountId: string | null;
  campaignId: string | null;
  adsetId: string | null;
};

export type AudienceLocation = {
  type: string;
  name: string;
  radius: number | null;
  unit: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type AudienceSummary = {
  locations: AudienceLocation[];
  excluded_locations: AudienceLocation[];
  location_types: string[];
  age_min: number | null;
  age_max: number | null;
  genders: string;
  interests: string[];
  excluded_interests: string[];
  custom_audiences: string[];
  excluded_custom_audiences: string[];
  advantage_audience: boolean | null;
  placements: string[];
  sentence_lines: string[];
};

export type AudienceRow = {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  delivery: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number | null;
  results_label: string | null;
  audience: AudienceSummary | null;
  error: string | null;
};

export type AdsAudienceSourceAccount = {
  platform: string;
  label: string | null;
  account_id: string;
  currency: string | null;
  audiences?: AudienceRow[];
  audiences_truncated?: boolean;
  error: string | null;
  note: string | null;
};

export type AdsAudienceSource = {
  period: { start: string; end: string; clipped: boolean };
  truncated: boolean;
  accounts: AdsAudienceSourceAccount[];
};

export type AdsAudienceAccount = {
  label: string | null;
  account_id: string;
  status: "ok" | "unavailable";
  currency: string | null;
  adsets: Array<AudienceRow & { cost_per_result: number | null; where: string | null; who: string | null }>;
  adsets_truncated: boolean;
  note: string | null;
  error: string | null;
};

export type AdsAudience = {
  period: { start: string; end: string; clipped: boolean };
  how_to_read: string;
  accounts: AdsAudienceAccount[];
  readings: string[];
  notes: string[];
};

const HOW_TO_READ =
  "Targeting of Meta ad sets that delivered in the period, highest spend first, as set in Ads Manager. locations are where the ad set is aimed: radius pins with their distance, cities, regions, or countries; location_types home and recent mean people living or recently there. where and who are short readings of the same settings. advantage_audience true means Meta may go beyond the age and interests as suggestions. sentence_lines are Meta's own description of the audience. Spend and results are for the period. This is the setup, not where delivery actually landed; use ads.performance.segments for delivery by age, gender, region, placement, device, hour, and day.";

function stripAct(value: string): string {
  return value.replace(/^act_/, "");
}

export function parseAdsAudienceQuery(args: unknown): AdsAudienceQuery | null {
  const parsed = adsAudienceInput.safeParse(args ?? {});
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
    accountId: parsed.data.account_id ? stripAct(parsed.data.account_id) : null,
    campaignId: parsed.data.campaign_id ? stripAct(parsed.data.campaign_id) : null,
    adsetId: parsed.data.adset_id ? stripAct(parsed.data.adset_id) : null,
  };
}

export function resolveAdsAudiencePeriod(query: AdsAudienceQuery, now = new Date()) {
  return resolveAdsPerformancePeriod({ month: query.month, dateStart: query.dateStart, dateEnd: query.dateEnd, platform: "meta" }, now);
}

function radiusText(location: AudienceLocation): string {
  if (location.radius == null) return location.name;
  const unit = location.unit === "mile" ? "mi" : "km";
  return `${location.radius} ${unit} around ${location.name}`;
}

export function whereText(audience: AudienceSummary | null): string | null {
  if (!audience) return null;
  if (audience.locations.length === 0) return null;
  const parts = audience.locations.slice(0, 6).map(radiusText);
  const more = audience.locations.length > 6 ? ` and ${audience.locations.length - 6} more` : "";
  const excluded = audience.excluded_locations.length > 0
    ? `, excluding ${audience.excluded_locations.slice(0, 3).map(radiusText).join("; ")}`
    : "";
  return `${parts.join("; ")}${more}${excluded}`;
}

export function whoText(audience: AudienceSummary | null): string | null {
  if (!audience) return null;
  const age = audience.age_min != null || audience.age_max != null
    ? `age ${audience.age_min ?? 18}-${audience.age_max != null && audience.age_max < 65 ? audience.age_max : "65+"}`
    : "all ages";
  const gender = audience.genders === "all" ? "all genders" : audience.genders;
  const interests = audience.interests.length > 0
    ? `, interests: ${audience.interests.slice(0, 5).join(", ")}${audience.interests.length > 5 ? "…" : ""}`
    : ", no interest targeting";
  const advantage = audience.advantage_audience ? " (Advantage+ audience on)" : "";
  return `${age}, ${gender}${interests}${advantage}`;
}

export function presentAdsAudience(source: AdsAudienceSource): AdsAudience {
  const accounts: AdsAudienceAccount[] = source.accounts
    .filter((row) => row.platform === "meta")
    .map((row) => ({
      label: row.label,
      account_id: row.account_id,
      status: row.error ? "unavailable" as const : "ok" as const,
      currency: row.error ? null : row.currency,
      adsets: (row.audiences ?? []).map((item) => ({
        ...item,
        cost_per_result: item.results != null && item.results > 0 ? Math.round((item.spend / item.results) * 100) / 100 : null,
        where: whereText(item.audience),
        who: whoText(item.audience),
      })),
      adsets_truncated: row.audiences_truncated === true,
      note: row.note,
      error: row.error,
    }));

  const readings: string[] = [];
  for (const account of accounts) {
    const who = account.label ?? account.account_id;
    if (account.status !== "ok") continue;
    if (account.adsets.length === 0) {
      readings.push(`${who} has no ad set with delivery in this period.`);
      continue;
    }
    for (const adset of account.adsets) {
      if (adset.error) {
        readings.push(`${who}: targeting for ${adset.adset_name} could not be read.`);
        continue;
      }
      readings.push(`${who}: ${adset.adset_name} targets ${adset.where ?? "no set location"}; ${adset.who ?? ""}.`.replace(/; \.$/, "."));
    }
  }

  const notes: string[] = [];
  if (source.period.clipped) notes.push("The requested range was longer than 366 days, so it was cut to the latest 366 days.");
  for (const account of accounts) {
    if (account.note) notes.push(`${account.label ?? account.account_id}: ${account.note}`);
  }
  if (accounts.length === 0) notes.push("No active Meta ad account is connected, or none matches account_id.");

  return { period: source.period, how_to_read: HOW_TO_READ, accounts, readings, notes };
}

export function adsAudienceResult(
  ctx: McpAuthContext,
  query: AdsAudienceQuery,
  list: (ctx: McpAuthContext, query: AdsAudienceQuery) => Promise<AdsAudience>,
): Promise<AdsAudience> {
  return list(ctx, query);
}
