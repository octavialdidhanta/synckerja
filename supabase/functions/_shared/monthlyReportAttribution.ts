import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeCampaignMatchKey,
  parseEligibleMetaConvertedLeads,
  utmMatchesMetaCampaign,
  type MetaConvertedLeadRow,
} from "./metaConvertedLeadRules.ts";

export type MonthWindow = { month: number; start: string; end: string };

export type MonthlyMetricsBucket = {
  month: number;
  spend: number;
  converted_leads: number;
  cpa: number | null;
};

export type MetaCampaignRef = { id: string; name: string };

function normalizeCampaignNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function computeMonthlyCpa(spend: number, convertedLeads: number): number | null {
  if (!Number.isFinite(spend) || spend <= 0) return null;
  if (!Number.isFinite(convertedLeads) || convertedLeads <= 0) return null;
  return spend / convertedLeads;
}

export function enrichSpendBucketsWithAttribution(
  buckets: { month: number; spend: number }[],
  leadsByMonth: Map<number, number>,
): MonthlyMetricsBucket[] {
  return buckets.map((b) => {
    const converted_leads = leadsByMonth.get(b.month) ?? 0;
    return {
      month: b.month,
      spend: b.spend,
      converted_leads,
      cpa: computeMonthlyCpa(b.spend, converted_leads),
    };
  });
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
    console.warn("monthlyReportAttribution loadConvertedStatusIds:", error.message);
    return [];
  }

  const ids: string[] = [];
  for (const row of data ?? []) {
    const name = String((row as { name?: string }).name ?? "").trim().toLowerCase();
    if (name === "converted") ids.push(String((row as { id: string }).id));
  }
  return ids;
}

function utmKeyFromAttribution(attribution: unknown): string {
  if (attribution == null || typeof attribution !== "object" || Array.isArray(attribution)) {
    return "";
  }
  const utmRaw = String((attribution as Record<string, unknown>).utm_campaign ?? "");
  return normalizeCampaignNameKey(utmRaw);
}

/** Local calendar YMD for converted_at (matches month window boundaries from buildMonthWindowsInRange). */
function convertedAtLocalYmd(convertedAt: string): string | null {
  const d = new Date(convertedAt);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function leadConvertedAtInWindow(
  convertedAt: string | null,
  window: MonthWindow,
): boolean {
  if (!convertedAt) return false;
  const ymd = convertedAtLocalYmd(convertedAt);
  if (!ymd) return false;
  return ymd >= window.start && ymd <= window.end;
}

function resolveMonthForLead(
  convertedAt: string | null,
  monthWindows: MonthWindow[],
): number | null {
  if (!convertedAt || monthWindows.length === 0) return null;
  for (const win of monthWindows) {
    if (leadConvertedAtInWindow(convertedAt, win)) return win.month;
  }
  const ymd = convertedAtLocalYmd(convertedAt);
  if (!ymd) return null;
  const first = monthWindows[0]!;
  const last = monthWindows[monthWindows.length - 1]!;
  if (ymd < first.start || ymd > last.end) return null;
  for (const win of monthWindows) {
    if (ymd >= win.start && ymd <= win.end) return win.month;
  }
  return null;
}

export function sumAttributedLeadsByMonth(leadsByMonth: Map<number, number>): number {
  let total = 0;
  for (const n of leadsByMonth.values()) {
    total += Number.isFinite(n) ? n : 0;
  }
  return total;
}

/** Distinct Google-channel converted leads per calendar month (UTM matches any campaign key). */
export async function countGoogleAttributedLeadsByMonth(
  admin: SupabaseClient,
  organizationId: string,
  dateStart: string,
  dateEnd: string,
  monthWindows: MonthWindow[],
  campaignUtmKeys: Set<string>,
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  for (const win of monthWindows) {
    counts.set(win.month, 0);
  }
  if (monthWindows.length === 0 || campaignUtmKeys.size === 0) return counts;

  const statusIds = await loadConvertedStatusIds(admin, organizationId);
  if (statusIds.length === 0) return counts;

  const startIso = `${dateStart}T00:00:00.000Z`;
  const endIso = `${dateEnd}T23:59:59.999Z`;

  const { data, error } = await admin
    .from("leads")
    .select("id, attribution, gclid, converted_at")
    .eq("organization_id", organizationId)
    .in("status_id", statusIds)
    .not("gclid", "is", null)
    .gte("converted_at", startIso)
    .lte("converted_at", endIso);

  if (error) {
    console.warn("monthlyReportAttribution countGoogle:", error.message);
    return counts;
  }

  const seenByMonth = new Map<number, Set<string>>();
  for (const win of monthWindows) {
    seenByMonth.set(win.month, new Set());
  }

  for (const row of data ?? []) {
    const gclid = String((row as { gclid?: string | null }).gclid ?? "").trim();
    if (!gclid) continue;
    const utmKey = utmKeyFromAttribution(
      (row as { attribution?: unknown }).attribution,
    );
    if (!utmKey || !campaignUtmKeys.has(utmKey)) continue;
    const month = resolveMonthForLead(
      String((row as { converted_at?: string | null }).converted_at ?? ""),
      monthWindows,
    );
    if (month == null) continue;
    const id = String((row as { id: string }).id);
    const seen = seenByMonth.get(month)!;
    if (seen.has(id)) continue;
    seen.add(id);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return counts;
}

/** Distinct Google-channel converted leads for a date range (not summed by month). */
export async function countGoogleAttributedLeadsForPeriod(
  admin: SupabaseClient,
  organizationId: string,
  dateStart: string,
  dateEnd: string,
  campaignUtmKeys: Set<string>,
): Promise<number> {
  if (campaignUtmKeys.size === 0) return 0;

  const statusIds = await loadConvertedStatusIds(admin, organizationId);
  if (statusIds.length === 0) return 0;

  const startIso = `${dateStart}T00:00:00.000Z`;
  const endIso = `${dateEnd}T23:59:59.999Z`;

  const { data, error } = await admin
    .from("leads")
    .select("id, attribution, gclid, converted_at")
    .eq("organization_id", organizationId)
    .in("status_id", statusIds)
    .not("gclid", "is", null)
    .gte("converted_at", startIso)
    .lte("converted_at", endIso);

  if (error) {
    console.warn("monthlyReportAttribution countGoogle period:", error.message);
    return 0;
  }

  const seen = new Set<string>();
  let count = 0;
  for (const row of data ?? []) {
    const gclid = String((row as { gclid?: string | null }).gclid ?? "").trim();
    if (!gclid) continue;
    const utmKey = utmKeyFromAttribution(
      (row as { attribution?: unknown }).attribution,
    );
    if (!utmKey || !campaignUtmKeys.has(utmKey)) continue;
    const id = String((row as { id: string }).id);
    if (seen.has(id)) continue;
    seen.add(id);
    count++;
  }
  return count;
}

/** Distinct Meta-channel converted leads per calendar month (UTM matches any account campaign). */
export async function countMetaAttributedLeadsByMonth(
  admin: SupabaseClient,
  organizationId: string,
  dateStart: string,
  dateEnd: string,
  monthWindows: MonthWindow[],
  campaigns: MetaCampaignRef[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  for (const win of monthWindows) {
    counts.set(win.month, 0);
  }
  if (monthWindows.length === 0 || campaigns.length === 0) return counts;

  const statusIds = await loadConvertedStatusIds(admin, organizationId);
  if (statusIds.length === 0) return counts;

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
    console.warn("monthlyReportAttribution countMeta:", error.message);
    return counts;
  }

  const eligible = parseEligibleMetaConvertedLeads((data ?? []) as MetaConvertedLeadRow[]);
  const convertedAtById = new Map<string, string>();
  for (const row of data ?? []) {
    const id = String((row as { id: string }).id);
    const at = String((row as { converted_at?: string | null }).converted_at ?? "");
    if (at) convertedAtById.set(id, at);
  }

  const seenByMonth = new Map<number, Set<string>>();
  for (const win of monthWindows) {
    seenByMonth.set(win.month, new Set());
  }

  for (const lead of eligible) {
    let matched = false;
    for (const camp of campaigns) {
      if (utmMatchesMetaCampaign(lead.utmKey, camp.id, camp.name)) {
        matched = true;
        break;
      }
    }
    if (!matched) continue;

    const convertedAt = convertedAtById.get(lead.id) ?? null;
    const month = resolveMonthForLead(convertedAt, monthWindows);
    if (month == null) continue;

    const seen = seenByMonth.get(month)!;
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return counts;
}

/** Distinct Meta-channel converted leads for a date range (not summed by month). */
export async function countMetaAttributedLeadsForPeriod(
  admin: SupabaseClient,
  organizationId: string,
  dateStart: string,
  dateEnd: string,
  campaigns: MetaCampaignRef[],
): Promise<number> {
  if (campaigns.length === 0) return 0;

  const statusIds = await loadConvertedStatusIds(admin, organizationId);
  if (statusIds.length === 0) return 0;

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
    console.warn("monthlyReportAttribution countMeta period:", error.message);
    return 0;
  }

  const eligible = parseEligibleMetaConvertedLeads((data ?? []) as MetaConvertedLeadRow[]);
  const seen = new Set<string>();
  let count = 0;

  for (const lead of eligible) {
    let matched = false;
    for (const camp of campaigns) {
      if (utmMatchesMetaCampaign(lead.utmKey, camp.id, camp.name)) {
        matched = true;
        break;
      }
    }
    if (!matched) continue;
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    count++;
  }

  return count;
}

export type ChannelPeriodSummary = {
  spend: number;
  converted_leads: number;
  cpa: number | null;
};

export function buildChannelPeriodSummary(
  months: { spend: number }[],
  periodConvertedLeads: number,
): ChannelPeriodSummary {
  const spend = months.reduce((total, row) => total + (Number.isFinite(row.spend) ? row.spend : 0), 0);
  return {
    spend,
    converted_leads: periodConvertedLeads,
    cpa: computeMonthlyCpa(spend, periodConvertedLeads),
  };
}

/** Build UTM match keys from Google campaign list items (name + numeric id). */
export function buildGoogleCampaignUtmKeys(
  campaigns: { name: string; id?: string }[],
): Set<string> {
  const keys = new Set<string>();
  for (const c of campaigns) {
    const nameKey = normalizeCampaignNameKey(String(c.name ?? ""));
    if (nameKey) keys.add(nameKey);
    const id = String(c.id ?? "").trim();
    if (id) {
      keys.add(normalizeCampaignMatchKey(id));
      const digits = id.replace(/\D/g, "");
      if (digits) keys.add(normalizeCampaignMatchKey(digits));
    }
  }
  return keys;
}
