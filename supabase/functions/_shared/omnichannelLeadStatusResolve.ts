import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function normalizeLeadStatusName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isUnreadLeadStatusName(name: string | null | undefined): boolean {
  const n = normalizeLeadStatusName(name);
  return !n || n === "open" || n === "unread";
}

const IN_PROGRESS_ALIASES = new Set([
  "in progress",
  "on going",
  "ongoing",
  "in-progress",
  "inprogress",
]);

const TERMINAL_STATUS_NAMES = new Set([
  "closed",
  "resolve",
  "converted",
  "expired",
  "lost",
  "qualified",
]);

type StatusRow = { id: string; name: string; sort_order: number | null; is_active: boolean | null };

function pickInProgressFromRows(rows: StatusRow[]): StatusRow | null {
  const active = rows.filter((r) => r.is_active !== false);
  const pool = active.length > 0 ? active : rows;

  for (const row of pool) {
    if (IN_PROGRESS_ALIASES.has(normalizeLeadStatusName(row.name))) return row;
  }

  const sort2 = pool.find((r) => r.sort_order === 2);
  if (sort2 && !isUnreadLeadStatusName(sort2.name) && !TERMINAL_STATUS_NAMES.has(normalizeLeadStatusName(sort2.name))) {
    return sort2;
  }

  const workflow = pool
    .filter((r) => {
      const n = normalizeLeadStatusName(r.name);
      return !isUnreadLeadStatusName(r.name) && !TERMINAL_STATUS_NAMES.has(n);
    })
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

  return workflow[0] ?? null;
}

async function loadStatusRows(
  supabase: SupabaseClient,
  organizationId: string | null,
): Promise<StatusRow[]> {
  let q = supabase
    .from("lead_statuses")
    .select("id, name, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (organizationId) {
    q = q.eq("organization_id", organizationId);
  } else {
    q = q.is("organization_id", null);
  }
  const { data, error } = await q;
  if (error) {
    console.error("loadStatusRows:", error.message, { organizationId });
    return [];
  }
  return (data ?? []) as StatusRow[];
}

function computeInProgressSortOrder(rows: StatusRow[]): number {
  const unreadOrders = rows
    .filter((r) => isUnreadLeadStatusName(r.name))
    .map((r) => r.sort_order ?? 1);
  const unreadMax = unreadOrders.length > 0 ? Math.max(...unreadOrders) : 1;

  const terminalOrders = rows
    .filter((r) => TERMINAL_STATUS_NAMES.has(normalizeLeadStatusName(r.name)))
    .map((r) => r.sort_order ?? 999);
  const terminalMin = terminalOrders.length > 0 ? Math.min(...terminalOrders) : unreadMax + 1;

  if (terminalMin > unreadMax + 1) return unreadMax + 1;
  if (terminalMin > unreadMax) return unreadMax + 1;
  const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
  return maxOrder + 1;
}

/** Full livechat status set (Converted, Closed/Resolve, etc.) — same as WhatsApp default org statuses. */
export async function ensureLivechatLeadStatusesForOrg(
  supabase: SupabaseClient,
  organizationId: string | null,
): Promise<void> {
  if (!organizationId) return;
  const { error } = await supabase.rpc("ensure_livechat_lead_statuses_for_org", {
    p_organization_id: organizationId,
  });
  if (error) {
    console.error("ensure_livechat_lead_statuses_for_org:", error.message, { organizationId });
  }
}

/** Create missing workflow status (orgs with only Unread + Expired, etc.). */
async function ensureInProgressLeadStatusForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const rows = await loadStatusRows(supabase, organizationId);
  const sortOrder = computeInProgressSortOrder(rows);

  const { data, error } = await supabase
    .from("lead_statuses")
    .insert({
      organization_id: organizationId,
      name: "In Progress",
      description: "Agent has replied; conversation is active",
      color: "#F59E0B",
      is_active: true,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) {
    console.error("ensureInProgressLeadStatusForOrg insert:", error.message, { organizationId });
    const retry = pickInProgressFromRows(await loadStatusRows(supabase, organizationId));
    return retry?.id ?? null;
  }

  console.log("ensureInProgressLeadStatusForOrg: created In Progress", {
    organizationId,
    sortOrder,
    id: data?.id,
  });
  return (data?.id as string | undefined) ?? null;
}

/**
 * Resolve the lead_status row to use after first agent reply (Unread/Open → active workflow).
 * Tries org statuses, then global (organization_id IS NULL).
 * If org has livechat but only Unread/Expired (no workflow row), creates "In Progress" automatically.
 */
export async function resolveInProgressLeadStatusId(
  supabase: SupabaseClient,
  organizationId: string | null,
): Promise<string | null> {
  if (organizationId) {
    await ensureLivechatLeadStatusesForOrg(supabase, organizationId);
    const orgRows = await loadStatusRows(supabase, organizationId);
    const orgPick = pickInProgressFromRows(orgRows);
    if (orgPick?.id) return orgPick.id;

    const created = await ensureInProgressLeadStatusForOrg(supabase, organizationId);
    if (created) return created;
  }

  const globalRows = await loadStatusRows(supabase, null);
  const globalPick = pickInProgressFromRows(globalRows);
  if (globalPick?.id) return globalPick.id;

  return null;
}

export async function resolveInProgressLeadStatusDebug(
  supabase: SupabaseClient,
  organizationId: string | null,
): Promise<{ id: string | null; names: string[] }> {
  const orgRows = organizationId ? await loadStatusRows(supabase, organizationId) : [];
  const globalRows = await loadStatusRows(supabase, null);
  const id = await resolveInProgressLeadStatusId(supabase, organizationId);
  const names = [...orgRows, ...globalRows].map((r) => r.name);
  return { id, names };
}
