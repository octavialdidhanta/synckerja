import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  POS_TABLE_SESSIONS_QUERY_KEY,
  usePosOpenTableSessions,
} from "@/8-2-9-table-management/hooks/usePosTableSessions";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";

export type PosBillListRow = {
  session: PosTableSession;
  groupName: string;
  waiterName: string;
  /** Soft-refund status of linked sales activity (paid tab). */
  refundStatus?: "none" | "full";
};

async function loadProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  if (error) throw error;
  for (const row of data ?? []) {
    const name = String((row as { full_name?: string | null }).full_name ?? "").trim();
    if (row.user_id) map.set(String(row.user_id), name || "—");
  }
  return map;
}

async function loadGroupNames(
  organizationId: string,
  groupIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(groupIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("pos_table_groups")
    .select("id, name")
    .eq("organization_id", organizationId)
    .in("id", ids);
  if (error) throw error;
  for (const row of data ?? []) {
    map.set(String(row.id), String(row.name ?? "").trim() || "—");
  }
  return map;
}

function waiterUserId(session: PosTableSession): string | null {
  return session.waiter_id || session.opened_by || null;
}

function enrichSessions(
  sessions: PosTableSession[],
  groupNames: Map<string, string>,
  waiterNames: Map<string, string>,
): PosBillListRow[] {
  return sessions.map((session) => {
    const waiterId = waiterUserId(session);
    return {
      session,
      groupName: session.group_id
        ? (groupNames.get(session.group_id) ?? "—")
        : "—",
      waiterName: waiterId ? (waiterNames.get(waiterId) ?? "—") : "—",
    };
  });
}

export function usePosBillListOpenSessions(outletId: string | null | undefined) {
  const open = usePosOpenTableSessions(outletId);
  const { organizationId } = useCurrentOrg();

  const enriched = useQuery({
    queryKey: [
      POS_TABLE_SESSIONS_QUERY_KEY,
      "open-enriched",
      organizationId,
      outletId,
      open.sessions.map((s) => `${s.id}:${s.waiter_id ?? ""}`).join(","),
    ],
    enabled: Boolean(organizationId && outletId),
    queryFn: async (): Promise<PosBillListRow[]> => {
      if (!organizationId) return [];
      const sessions = open.sessions;
      const [groupNames, waiterNames] = await Promise.all([
        loadGroupNames(
          organizationId,
          sessions.map((s) => s.group_id),
        ),
        loadProfileNames(sessions.map((s) => waiterUserId(s) ?? "")),
      ]);
      return enrichSessions(sessions, groupNames, waiterNames);
    },
  });

  return {
    rows: enriched.data ?? [],
    isLoading: open.isLoading || (Boolean(organizationId && outletId) && enriched.isLoading),
    refetch: async () => {
      await open.refetch();
      await enriched.refetch();
    },
  };
}

export function usePosBillListCancelledSessions(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(organizationId && outletId);

  return useQuery({
    queryKey: [POS_TABLE_SESSIONS_QUERY_KEY, "cancelled", organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosBillListRow[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_table_sessions")
        .select(
          "id, organization_id, outlet_id, group_id, pos_table_id, table_name, pax, seated_at, closed_at, status, opened_by, closed_by, waiter_id, sales_activity_id, cart_snapshot, cancel_reason, customer_name, customer_phone, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("status", "cancelled")
        .order("closed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const sessions = (data ?? []).map((row) => {
        const r = row as PosTableSession;
        return {
          ...r,
          group_id: r.group_id ?? null,
          pos_table_id: r.pos_table_id ?? null,
          waiter_id: r.waiter_id ?? null,
          cancel_reason: r.cancel_reason ?? null,
          customer_name: r.customer_name ?? null,
          customer_phone: r.customer_phone ?? null,
          cart_snapshot: Array.isArray(r.cart_snapshot) ? r.cart_snapshot : [],
        };
      });
      const [groupNames, waiterNames] = await Promise.all([
        loadGroupNames(
          organizationId,
          sessions.map((s) => s.group_id),
        ),
        loadProfileNames(sessions.map((s) => waiterUserId(s) ?? "")),
      ]);
      return enrichSessions(sessions, groupNames, waiterNames);
    },
  });
}

export function usePosBillListPaidSessions(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(organizationId && outletId);

  return useQuery({
    queryKey: [POS_TABLE_SESSIONS_QUERY_KEY, "paid", organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosBillListRow[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_table_sessions")
        .select(
          "id, organization_id, outlet_id, group_id, pos_table_id, table_name, pax, seated_at, closed_at, status, opened_by, closed_by, waiter_id, sales_activity_id, cart_snapshot, cancel_reason, customer_name, customer_phone, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("status", "paid")
        .not("sales_activity_id", "is", null)
        .order("closed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const sessions = (data ?? []).map((row) => {
        const r = row as PosTableSession;
        return {
          ...r,
          group_id: r.group_id ?? null,
          pos_table_id: r.pos_table_id ?? null,
          waiter_id: r.waiter_id ?? null,
          cancel_reason: r.cancel_reason ?? null,
          customer_name: r.customer_name ?? null,
          customer_phone: r.customer_phone ?? null,
          cart_snapshot: Array.isArray(r.cart_snapshot) ? r.cart_snapshot : [],
        };
      });
      const [groupNames, waiterNames] = await Promise.all([
        loadGroupNames(
          organizationId,
          sessions.map((s) => s.group_id),
        ),
        loadProfileNames(sessions.map((s) => waiterUserId(s) ?? "")),
      ]);
      const activityIds = sessions
        .map((s) => s.sales_activity_id)
        .filter((id): id is string => Boolean(id));
      const refundByActivity = new Map<string, "none" | "full">();
      if (activityIds.length > 0) {
        const { data: acts, error: actsErr } = await supabase
          .from("sales_activities")
          .select("id, refund_status")
          .in("id", activityIds);
        if (actsErr) throw actsErr;
        for (const row of acts ?? []) {
          const id = String((row as { id?: string }).id ?? "");
          if (!id) continue;
          refundByActivity.set(
            id,
            (row as { refund_status?: string }).refund_status === "full" ? "full" : "none",
          );
        }
      }
      return enrichSessions(sessions, groupNames, waiterNames).map((row) => ({
        ...row,
        refundStatus: row.session.sales_activity_id
          ? (refundByActivity.get(row.session.sales_activity_id) ?? "none")
          : "none",
      }));
    },
  });
}
