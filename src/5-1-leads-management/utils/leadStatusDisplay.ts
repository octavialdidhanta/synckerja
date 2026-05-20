/**
 * Display name untuk status lead.
 * - Nilai di DB "Open", tampilan di UI "Unread" (chat pertama masuk / setelah resolve).
 * - Nilai di DB "In Progress", tampilan di UI "In Progress".
 * - Nilai di DB "Closed", tampilan di UI "Resolve".
 * - Nilai di DB "Expired", tampilan di UI "Expired" (sesi Meta berakhir; bukan resolve manual).
 */
export function getLeadStatusDisplayName(name: string | null | undefined): string {
  if (name == null || name === '') return '';
  if (name === 'Open') return 'Unread';
  if (name === 'In Progress') return 'In Progress';
  if (name === 'Closed') return 'Resolve';
  return name;
}

/** Same statuses hidden in Livechat Quick Action status dropdown (`LeadStatusSelect`). */
const QUICK_ACTION_HIDDEN_STATUS_NAMES = new Set(['lost', 'qualified']);

export function isLeadStatusHiddenInQuickAction(name: string | null | undefined): boolean {
  if (name == null || name === '') return false;
  return QUICK_ACTION_HIDDEN_STATUS_NAMES.has(name.trim().toLowerCase());
}

/** DB status Closed / Resolve — shown in dedicated Resolve column on leads table, not Status. */
export function isResolvedLeadStatusName(name: string | null | undefined): boolean {
  if (name == null || name === '') return false;
  const n = name.trim().toLowerCase();
  return n === 'closed' || n === 'resolve';
}

export type LeadResolveOutcome = 'with_converted' | 'without_converted';

/** When lead is resolved: distinguish path via `converted_at` (set when status became Converted). */
export function getLeadResolveOutcome(lead: {
  lead_status?: { name?: string | null } | null;
  converted_at?: string | null;
}): LeadResolveOutcome | null {
  const name = lead.lead_status?.name ?? '';
  if (!isResolvedLeadStatusName(name)) return null;
  return lead.converted_at ? 'with_converted' : 'without_converted';
}

/**
 * Status column on leads table: workflow status only (Unread / In Progress / Converted / Expired).
 * When DB status is Closed/Resolve, show Converted if `converted_at` exists, else In Progress (resolve tanpa converted).
 */
export function getLeadTableStatusPresentation(lead: {
  lead_status?: { name?: string | null } | null;
  converted_at?: string | null;
}): { displayName: string; colorStatusName: string } {
  const raw = (lead.lead_status?.name ?? '').trim();
  if (isResolvedLeadStatusName(raw)) {
    if (lead.converted_at) {
      return { displayName: getLeadStatusDisplayName('Converted'), colorStatusName: 'Converted' };
    }
    return { displayName: getLeadStatusDisplayName('In Progress'), colorStatusName: 'In Progress' };
  }
  const name = raw || 'Open';
  return { displayName: getLeadStatusDisplayName(name), colorStatusName: name };
}

export type LeadStatusReportRow = {
  /** Representative DB status name (first in `sort_order` for merged display labels). */
  status: string;
  displayName: string;
  count: number;
};

/**
 * Status breakdown for Report Summary — mirrors Quick Action dropdown:
 * DB `sort_order`, dedupe by display label (Open + Unread → one "Unread" row), hide Lost/Qualified.
 */
export function buildLeadStatusReportAnalysis(
  leads: ReadonlyArray<{ lead_status?: { name?: string | null } | null }>,
  leadStatusesFromDb: ReadonlyArray<{ name: string }>,
): LeadStatusReportRow[] {
  const countForDisplayKey = (displayKey: string) =>
    leads.filter((lead) => {
      const leadName = (lead.lead_status?.name ?? '').trim();
      if (!leadName) return false;
      return getLeadStatusDisplayName(leadName).trim().toLowerCase() === displayKey;
    }).length;

  if (leadStatusesFromDb.length > 0) {
    const seen = new Set<string>();
    const rows: LeadStatusReportRow[] = [];

    for (const s of leadStatusesFromDb) {
      if (isLeadStatusHiddenInQuickAction(s.name)) continue;

      const displayName = getLeadStatusDisplayName(s.name);
      const labelKey = displayName.trim().toLowerCase();
      if (!labelKey || seen.has(labelKey)) continue;
      seen.add(labelKey);

      rows.push({
        status: s.name,
        displayName,
        count: countForDisplayKey(labelKey),
      });
    }

    const notSpecifiedCount = leads.filter((lead) => !(lead.lead_status?.name ?? '').trim()).length;
    if (notSpecifiedCount > 0) {
      rows.push({ status: 'Not Specified', displayName: 'Not Specified', count: notSpecifiedCount });
    }
    return rows;
  }

  const byDisplay = new Map<string, LeadStatusReportRow>();
  for (const lead of leads) {
    const raw = (lead.lead_status?.name ?? '').trim();
    if (!raw || isLeadStatusHiddenInQuickAction(raw)) continue;
    const displayName = getLeadStatusDisplayName(raw);
    const labelKey = displayName.trim().toLowerCase();
    if (!labelKey) continue;
    const existing = byDisplay.get(labelKey);
    if (existing) existing.count += 1;
    else byDisplay.set(labelKey, { status: raw, displayName, count: 1 });
  }

  const rows = [...byDisplay.values()].sort((a, b) => b.count - a.count);
  const notSpecifiedCount = leads.filter((lead) => !(lead.lead_status?.name ?? '').trim()).length;
  if (notSpecifiedCount > 0) {
    rows.push({ status: 'Not Specified', displayName: 'Not Specified', count: notSpecifiedCount });
  }
  return rows;
}
