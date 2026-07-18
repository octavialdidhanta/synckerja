/** Pure helpers for Lead Magnet list metrics (date-scoped). */

export type CampaignListMetrics = {
  new_followers: number;
  new_emails: number;
  new_phones: number;
  non_follower_at_start: number;
  total_enrollments: number;
};

export type CampaignListMetricTotals = {
  new_followers: number;
  new_emails: number;
  new_phones: number;
};

export const EMPTY_CAMPAIGN_LIST_METRICS: CampaignListMetrics = {
  new_followers: 0,
  new_emails: 0,
  new_phones: 0,
  non_follower_at_start: 0,
  total_enrollments: 0,
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Inclusive UTC day bounds for YYYY-MM-DD calendar dates. */
export function ymdRangeToInclusiveIsoBounds(
  dateStart: string,
  dateEnd: string,
): { startIso: string; endIso: string } {
  return {
    startIso: `${dateStart}T00:00:00.000Z`,
    endIso: `${dateEnd}T23:59:59.999Z`,
  };
}

/** Default last-30-days window in UTC YMD (server fallback when query params missing). */
export function defaultLast30DaysYmd(now: Date = new Date()): { dateStart: string; dateEnd: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateStart: fmt(start), dateEnd: fmt(end) };
}

export function parseListMetricsDateRange(
  dateStartRaw: string | null,
  dateEndRaw: string | null,
  now: Date = new Date(),
): { dateStart: string; dateEnd: string; startIso: string; endIso: string } {
  let dateStart = (dateStartRaw ?? "").trim();
  let dateEnd = (dateEndRaw ?? "").trim();
  if (!isValidYmd(dateStart) || !isValidYmd(dateEnd)) {
    const fallback = defaultLast30DaysYmd(now);
    dateStart = fallback.dateStart;
    dateEnd = fallback.dateEnd;
  }
  if (dateStart > dateEnd) {
    const tmp = dateStart;
    dateStart = dateEnd;
    dateEnd = tmp;
  }
  const { startIso, endIso } = ymdRangeToInclusiveIsoBounds(dateStart, dateEnd);
  return { dateStart, dateEnd, startIso, endIso };
}

export type EnrollmentMetricRow = {
  campaign_id: string;
  is_follower_at_start: boolean | null;
  became_follower_at: string | null;
};

export type ContactCollectedEventRow = {
  campaign_id: string;
  enrollment_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function ensureMetrics(
  map: Map<string, CampaignListMetrics>,
  campaignId: string,
): CampaignListMetrics {
  const current = map.get(campaignId);
  if (current) return current;
  const created = { ...EMPTY_CAMPAIGN_LIST_METRICS };
  map.set(campaignId, created);
  return created;
}

/**
 * All-time enrollment base counters + date-scoped new_followers.
 */
export function applyEnrollmentRowsToMetrics(
  map: Map<string, CampaignListMetrics>,
  rows: EnrollmentMetricRow[],
  range: { startIso: string; endIso: string },
): void {
  for (const row of rows) {
    const campaignId = String(row.campaign_id);
    const current = ensureMetrics(map, campaignId);
    current.total_enrollments += 1;
    if (row.is_follower_at_start === false) {
      current.non_follower_at_start += 1;
    }
    const at = row.became_follower_at;
    if (at != null && at >= range.startIso && at <= range.endIso) {
      current.new_followers += 1;
    }
  }
}

/**
 * Date-scoped new_emails / new_phones from contact_collected funnel events.
 * Distinct enrollment_id per campaign per kind; skips supplemental collects.
 */
export function applyContactCollectedEventsToMetrics(
  map: Map<string, CampaignListMetrics>,
  rows: ContactCollectedEventRow[],
): void {
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();

  for (const row of rows) {
    const meta = row.metadata ?? {};
    if (meta.supplemental === true) continue;
    const kind = String(meta.kind ?? "");
    if (kind !== "email" && kind !== "phone") continue;

    const campaignId = String(row.campaign_id);
    const enrollmentId = String(row.enrollment_id);
    const key = `${campaignId}:${enrollmentId}:${kind}`;
    const current = ensureMetrics(map, campaignId);

    if (kind === "email") {
      if (seenEmail.has(key)) continue;
      seenEmail.add(key);
      current.new_emails += 1;
    } else {
      if (seenPhone.has(key)) continue;
      seenPhone.add(key);
      current.new_phones += 1;
    }
  }
}

export function sumCampaignListMetricTotals(
  map: Map<string, CampaignListMetrics>,
): CampaignListMetricTotals {
  const totals: CampaignListMetricTotals = {
    new_followers: 0,
    new_emails: 0,
    new_phones: 0,
  };
  for (const m of map.values()) {
    totals.new_followers += m.new_followers;
    totals.new_emails += m.new_emails;
    totals.new_phones += m.new_phones;
  }
  return totals;
}
