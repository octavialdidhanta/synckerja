import type { NewLead } from "@/shared/types/leads";
import type { OrganizationOmnichannelStaffRow } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import type { PresenceByUserId } from "@/5-3-dashboard/hooks/useOmnichannelStaffPresence";
import type { OmnichannelStaffRole } from "@/shared/hooks/useOrganizationOmnichannelStaff";

export type IdleAgentPresenceStatus = "online" | "idle" | "offline";

export type IdleAgentRow = {
  rosterId: string;
  employeeId: string;
  fullName: string;
  role: OmnichannelStaffRole;
  userId: string | null;
  presenceStatus: IdleAgentPresenceStatus;
  /** Assigned chats not yet in progress (shared via Leads Management). */
  sharedChatCount: number;
  activeChatCount: number;
  idleSinceMs: number | null;
};

export function isWhatsAppLead(lead: NewLead): boolean {
  const id = String(lead.id ?? "");
  const ch = (lead.channel ?? "").toLowerCase();
  if (id.startsWith("wa-")) return true;
  if (ch === "instagram" || id.startsWith("email-")) return false;
  return ch === "whatsapp" || ch === "";
}

export function isInProgressLead(lead: NewLead): boolean {
  return (lead.lead_status?.name?.trim().toLowerCase() ?? "") === "in progress";
}

function isTerminalLeadStatus(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return n === "closed" || n === "resolve" || n === "expired" || n === "lost" || n === "converted";
}

/** Active operational assignee only — not `last_handling_assignee_id` (post-resolve visibility). */
export function leadAssigneeId(lead: NewLead): string | null {
  const id = (lead as NewLead & { assignee_id?: string | null }).assignee_id;
  return id ? String(id) : null;
}

export function countActiveChatsByAssignee(
  filteredLeads: ReadonlyArray<NewLead>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const lead of filteredLeads) {
    if (!isWhatsAppLead(lead) || !isInProgressLead(lead)) continue;
    const assigneeId = leadAssigneeId(lead);
    if (!assigneeId) continue;
    map.set(assigneeId, (map.get(assigneeId) ?? 0) + 1);
  }
  return map;
}

export function countSharedChatsByAssignee(
  filteredLeads: ReadonlyArray<NewLead>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const lead of filteredLeads) {
    if (!isWhatsAppLead(lead)) continue;
    if (isInProgressLead(lead)) continue;
    if (isTerminalLeadStatus(lead.lead_status?.name)) continue;
    const assigneeId = leadAssigneeId(lead);
    if (!assigneeId) continue;
    map.set(assigneeId, (map.get(assigneeId) ?? 0) + 1);
  }
  return map;
}

export function derivePresenceStatus(
  online: boolean,
  activeCount: number,
): IdleAgentPresenceStatus {
  if (!online) return "offline";
  if (activeCount === 0) return "idle";
  return "online";
}

const STATUS_SORT_ORDER: Record<IdleAgentPresenceStatus, number> = {
  idle: 0,
  online: 1,
  offline: 2,
};

const IDLE_SINCE_STORAGE_PREFIX = "omnichannel-idle-since:";

export function idleSinceStorageKey(organizationId: string): string {
  return `${IDLE_SINCE_STORAGE_PREFIX}${organizationId}`;
}

export function readPersistedIdleSinceMap(organizationId: string | null | undefined): Record<string, number> {
  if (!organizationId || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(idleSinceStorageKey(organizationId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function writePersistedIdleSinceMap(
  organizationId: string | null | undefined,
  map: Record<string, number>,
): void {
  if (!organizationId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(idleSinceStorageKey(organizationId), JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Earliest timestamp when the agent became idle (online + no WA In Progress assigned).
 * Uses lead `updated_at`, presence `online_at`, and localStorage — survives page refresh.
 */
export function computeIdleSinceTimestamp(
  employeeId: string,
  allLeads: ReadonlyArray<NewLead>,
  presenceOnlineAt: string | undefined,
  persistedSinceMs: number | undefined,
  nowMs: number,
): number {
  const candidates: number[] = [];

  if (persistedSinceMs != null && persistedSinceMs > 0) {
    candidates.push(persistedSinceMs);
  }

  let lastNonInProgressUpdate = 0;
  for (const lead of allLeads) {
    if (!isWhatsAppLead(lead)) continue;
    if (leadAssigneeId(lead) !== employeeId) continue;
    if (isInProgressLead(lead)) continue;
    const ts = new Date(lead.updated_at).getTime();
    if (Number.isFinite(ts) && ts > lastNonInProgressUpdate) {
      lastNonInProgressUpdate = ts;
    }
  }
  if (lastNonInProgressUpdate > 0) {
    candidates.push(lastNonInProgressUpdate);
  }

  if (presenceOnlineAt) {
    const presenceTs = new Date(presenceOnlineAt).getTime();
    if (Number.isFinite(presenceTs) && presenceTs > 0) {
      candidates.push(presenceTs);
    }
  }

  if (candidates.length === 0) return nowMs;
  return Math.min(...candidates);
}

export function buildIdleSinceMapForRoster(
  roster: ReadonlyArray<OrganizationOmnichannelStaffRow>,
  filteredLeads: ReadonlyArray<NewLead>,
  allLeads: ReadonlyArray<NewLead>,
  presenceByUserId: PresenceByUserId,
  organizationId: string | null | undefined,
  nowMs: number,
): Record<string, number> {
  const persistedMap = readPersistedIdleSinceMap(organizationId);
  const activeByAssignee = countActiveChatsByAssignee(filteredLeads);
  const next: Record<string, number> = {};

  for (const member of roster) {
    const userId = member.employees?.user_id ?? null;
    const online = Boolean(userId && presenceByUserId[userId]);
    const activeCount = activeByAssignee.get(member.employee_id) ?? 0;
    const status = derivePresenceStatus(online, activeCount);
    if (status !== "idle") continue;

    const presenceOnlineAt = userId ? presenceByUserId[userId]?.online_at : undefined;
    next[member.employee_id] = computeIdleSinceTimestamp(
      member.employee_id,
      allLeads,
      presenceOnlineAt,
      persistedMap[member.employee_id],
      nowMs,
    );
  }

  return next;
}

export function buildIdleAgentRows(
  roster: ReadonlyArray<OrganizationOmnichannelStaffRow>,
  filteredLeads: ReadonlyArray<NewLead>,
  presenceByUserId: PresenceByUserId,
  idleSinceByEmployeeId: Readonly<Record<string, number>>,
  nowMs: number,
): IdleAgentRow[] {
  const activeByAssignee = countActiveChatsByAssignee(filteredLeads);
  const sharedByAssignee = countSharedChatsByAssignee(filteredLeads);

  const rows: IdleAgentRow[] = roster.map((r) => {
    const userId = r.employees?.user_id ?? null;
    const online = Boolean(userId && presenceByUserId[userId]);
    const sharedChatCount = sharedByAssignee.get(r.employee_id) ?? 0;
    const activeChatCount = activeByAssignee.get(r.employee_id) ?? 0;
    const presenceStatus = derivePresenceStatus(online, activeChatCount);
    const idleSince = idleSinceByEmployeeId[r.employee_id];
    const idleSinceMs =
      presenceStatus === "idle" && idleSince != null
        ? Math.max(0, nowMs - idleSince)
        : null;

    return {
      rosterId: r.id,
      employeeId: r.employee_id,
      fullName: r.employees?.full_name ?? "",
      role: r.role,
      userId,
      presenceStatus,
      sharedChatCount,
      activeChatCount,
      idleSinceMs,
    };
  });

  return rows.sort((a, b) => {
    const orderDiff = STATUS_SORT_ORDER[a.presenceStatus] - STATUS_SORT_ORDER[b.presenceStatus];
    if (orderDiff !== 0) return orderDiff;
    return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
  });
}

export function formatIdleDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  const h = Math.floor(ms / 3600_000);
  const m = Math.round((ms % 3600_000) / 60_000);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function summarizeIdleAgentRows(rows: ReadonlyArray<IdleAgentRow>) {
  let idle = 0;
  let online = 0;
  let offline = 0;
  for (const row of rows) {
    if (row.presenceStatus === "idle") idle += 1;
    else if (row.presenceStatus === "online") online += 1;
    else offline += 1;
  }
  return { idle, online, offline, total: rows.length };
}
