/** Pure helpers for Lead Magnet list metrics (date-scoped). */

export type CampaignListMetrics = {
  new_leads: number;
  offline_visits: number;
  new_followers: number;
  new_emails: number;
  new_phones: number;
  transactions: number;
  revenue: number;
  aov: number;
  non_follower_at_start: number;
  total_enrollments: number;
};

export type CampaignListMetricTotals = {
  new_leads: number;
  offline_visits: number;
  new_followers: number;
  new_emails: number;
  new_phones: number;
  transactions: number;
  revenue: number;
  aov: number;
};

export type UniquePaidSalesTotals = {
  transactions: number;
  revenue: number;
};

export const EMPTY_CAMPAIGN_LIST_METRICS: CampaignListMetrics = {
  new_leads: 0,
  offline_visits: 0,
  new_followers: 0,
  new_emails: 0,
  new_phones: 0,
  transactions: 0,
  revenue: 0,
  aov: 0,
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
  lead_id: string | null;
  created_at: string | null;
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
 * All-time enrollment base counters + date-scoped new_followers / unique new_leads.
 */
export function applyEnrollmentRowsToMetrics(
  map: Map<string, CampaignListMetrics>,
  rows: EnrollmentMetricRow[],
  range: { startIso: string; endIso: string },
): void {
  const seenLeads = new Set<string>();

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

    const leadId = row.lead_id?.trim() || null;
    const createdAt = row.created_at;
    if (
      leadId &&
      createdAt != null &&
      createdAt >= range.startIso &&
      createdAt <= range.endIso
    ) {
      const key = `${campaignId}:${leadId}`;
      if (seenLeads.has(key)) continue;
      seenLeads.add(key);
      current.new_leads += 1;
    }
  }
}

export type OfflineVisitMetricRow = {
  lead_id: string | null;
  visit_date: string | null;
  status: string | null;
};

/**
 * Date-scoped unique completed offline visits per campaign (via enrollment lead_id).
 * Visit date uses YYYY-MM-DD; enrollment may be outside the range. Dual-campaign: 1 and 1.
 */
export function applyOfflineVisitRowsToMetrics(
  map: Map<string, CampaignListMetrics>,
  visits: OfflineVisitMetricRow[],
  enrollments: EnrollmentMetricRow[],
  range: { dateStart: string; dateEnd: string },
): void {
  const campaignsByLead = new Map<string, Set<string>>();
  for (const row of enrollments) {
    const leadId = row.lead_id?.trim() || null;
    if (!leadId) continue;
    const campaignId = String(row.campaign_id);
    let set = campaignsByLead.get(leadId);
    if (!set) {
      set = new Set();
      campaignsByLead.set(leadId, set);
    }
    set.add(campaignId);
  }

  const seen = new Set<string>();
  for (const visit of visits) {
    if (String(visit.status ?? "").toLowerCase() !== "completed") continue;
    const leadId = visit.lead_id?.trim() || null;
    if (!leadId) continue;
    const visitDate = String(visit.visit_date ?? "").slice(0, 10);
    if (!isValidYmd(visitDate)) continue;
    if (visitDate < range.dateStart || visitDate > range.dateEnd) continue;
    const campaignIds = campaignsByLead.get(leadId);
    if (!campaignIds) continue;
    for (const campaignId of campaignIds) {
      const key = `${campaignId}:${leadId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ensureMetrics(map, campaignId).offline_visits += 1;
    }
  }
}

/**
 * Date-scoped new_emails / new_phones from contact_collected funnel events.
 * Distinct enrollment_id per campaign per kind; skips supplemental collects.
 */
export type PaidSalesActivityMetricRow = {
  id: string | null;
  lead_id: string | null;
  date: string | null;
  payment_status: string | null;
  is_paid: boolean | null;
  total_amount: number | null;
  total_paid_amount: number | null;
};

function isPaidSalesActivity(row: PaidSalesActivityMetricRow): boolean {
  const total = Number(row.total_amount);
  if (!Number.isFinite(total) || total <= 0) return false;
  if (String(row.payment_status ?? "").toLowerCase() === "paid") return true;
  const paid = Number(row.total_paid_amount);
  return row.is_paid === true && Number.isFinite(paid) && paid >= total;
}

/**
 * Date-scoped paid sales activities per campaign (via enrollment lead_id).
 * Per campaign: full credit (dual-enroll counts on both). Org unique totals de-dupe activity id.
 */
export function applyPaidSalesActivitiesToMetrics(
  map: Map<string, CampaignListMetrics>,
  activities: PaidSalesActivityMetricRow[],
  enrollments: EnrollmentMetricRow[],
  range: { dateStart: string; dateEnd: string },
): UniquePaidSalesTotals {
  const campaignsByLead = new Map<string, Set<string>>();
  for (const row of enrollments) {
    const leadId = row.lead_id?.trim() || null;
    if (!leadId) continue;
    const campaignId = String(row.campaign_id);
    let set = campaignsByLead.get(leadId);
    if (!set) {
      set = new Set();
      campaignsByLead.set(leadId, set);
    }
    set.add(campaignId);
  }

  const seenCampaignActivity = new Set<string>();
  const uniqueActivityIds = new Set<string>();
  let uniqueRevenue = 0;

  for (const activity of activities) {
    if (!isPaidSalesActivity(activity)) continue;
    const leadId = activity.lead_id?.trim() || null;
    if (!leadId) continue;
    const activityDate = String(activity.date ?? "").slice(0, 10);
    if (!isValidYmd(activityDate)) continue;
    if (activityDate < range.dateStart || activityDate > range.dateEnd) continue;
    const campaignIds = campaignsByLead.get(leadId);
    if (!campaignIds) continue;
    const activityId = String(activity.id ?? "").trim();
    if (!activityId) continue;
    const amount = Number(activity.total_amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (!uniqueActivityIds.has(activityId)) {
      uniqueActivityIds.add(activityId);
      uniqueRevenue += amount;
    }

    for (const campaignId of campaignIds) {
      const key = `${campaignId}:${activityId}`;
      if (seenCampaignActivity.has(key)) continue;
      seenCampaignActivity.add(key);
      const current = ensureMetrics(map, campaignId);
      current.transactions += 1;
      current.revenue += amount;
      current.aov = current.transactions > 0 ? Math.round(current.revenue / current.transactions) : 0;
    }
  }

  return {
    transactions: uniqueActivityIds.size,
    revenue: uniqueRevenue,
  };
}

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
  uniquePaid?: UniquePaidSalesTotals | null,
): CampaignListMetricTotals {
  const totals: CampaignListMetricTotals = {
    new_leads: 0,
    offline_visits: 0,
    new_followers: 0,
    new_emails: 0,
    new_phones: 0,
    transactions: uniquePaid?.transactions ?? 0,
    revenue: uniquePaid?.revenue ?? 0,
    aov: 0,
  };
  for (const m of map.values()) {
    totals.new_leads += m.new_leads;
    totals.offline_visits += m.offline_visits;
    totals.new_followers += m.new_followers;
    totals.new_emails += m.new_emails;
    totals.new_phones += m.new_phones;
  }
  totals.aov = totals.transactions > 0 ? Math.round(totals.revenue / totals.transactions) : 0;
  return totals;
}
