import { extractInstagramHandle } from "../instagramAccountDedupe.ts";

export type LeadMagnetChannelKind = "instagram" | "facebook";

export type ScopedEnrollmentRow = {
  lead_id: string | null;
  participant_scoped_id: string | null;
};

export type ScopedProfileRow = {
  canonical_lead_id: string | null;
  participant_scoped_id: string | null;
};

export type LeadMagnetHandleLeadRow = {
  id: string;
  client: string | null;
  source: string | null;
  category: string | null;
};

export function channelLeadTicketId(kind: LeadMagnetChannelKind, conversationId: string): string {
  const prefix = kind === "instagram" ? "IG-" : "FB-";
  return prefix + String(conversationId).replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function isLeadMagnetCrmLead(lead: {
  source?: string | null;
  category?: string | null;
}): boolean {
  const source = (lead.source ?? "").trim();
  const category = (lead.category ?? "").trim();
  return source === "Lead Magnet" || category === "Lead Magnet";
}

export function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function uniqueLeadIdForScopedRows(
  scopedIds: string[],
  rows: Array<{ leadId: string | null; participantScopedId: string | null }>,
): string | null {
  const scoped = new Set(uniqueNonEmpty(scopedIds));
  if (scoped.size === 0) return null;
  const leadIds = new Set<string>();
  for (const row of rows) {
    const sid = (row.participantScopedId ?? "").trim();
    if (!sid || !scoped.has(sid)) continue;
    const leadId = (row.leadId ?? "").trim();
    if (leadId) leadIds.add(leadId);
  }
  if (leadIds.size === 1) return [...leadIds][0]!;
  return null;
}

export function pickCanonicalLeadIdFromScopedEnrollments(
  scopedIds: string[],
  enrollments: ScopedEnrollmentRow[],
): string | null {
  return uniqueLeadIdForScopedRows(
    scopedIds,
    enrollments.map((row) => ({
      leadId: row.lead_id,
      participantScopedId: row.participant_scoped_id,
    })),
  );
}

export function pickCanonicalLeadIdFromProfiles(
  scopedIds: string[],
  profiles: ScopedProfileRow[],
): string | null {
  return uniqueLeadIdForScopedRows(
    scopedIds,
    profiles.map((row) => ({
      leadId: row.canonical_lead_id,
      participantScopedId: row.participant_scoped_id,
    })),
  );
}

export function pickCanonicalLeadIdFromUniqueHandle(
  handle: string | null | undefined,
  leads: LeadMagnetHandleLeadRow[],
): string | null {
  const key = extractInstagramHandle(handle);
  if (!key) return null;
  const matches = leads.filter((lead) => {
    if (!isLeadMagnetCrmLead(lead)) return false;
    return extractInstagramHandle(lead.client) === key;
  });
  if (matches.length === 1) return matches[0]!.id;
  return null;
}

export function resolveCanonicalLeadMagnetLeadId(args: {
  scopedIds: string[];
  enrollments: ScopedEnrollmentRow[];
  profiles: ScopedProfileRow[];
  handle?: string | null;
  leadMagnetLeads?: LeadMagnetHandleLeadRow[];
}): string | null {
  return (
    pickCanonicalLeadIdFromScopedEnrollments(args.scopedIds, args.enrollments) ??
    pickCanonicalLeadIdFromProfiles(args.scopedIds, args.profiles) ??
    pickCanonicalLeadIdFromUniqueHandle(args.handle, args.leadMagnetLeads ?? [])
  );
}
