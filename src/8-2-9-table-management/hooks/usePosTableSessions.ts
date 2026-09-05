import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type {
  PosTableSession,
  PosTableSessionStatus,
  PosTableSessionUpsertPayload,
} from "../lib/posTableSessionTypes";
import { normalizeSessionCustomer } from "../lib/posTableSessionTypes";
import {
  markKitchenTicketsDoneForSession,
  voidKitchenTicketsForSession,
} from "@/pos-mobile/8-kitchen/lib/createPosKitchenTickets";
import { planClearSeatedSessionUpdate } from "@/pos-mobile/2-cashier/lib/pay-first-seating";

export const POS_TABLE_SESSIONS_QUERY_KEY = "pos-table-sessions";

type DbRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  group_id: string | null;
  pos_table_id: string | null;
  table_name: string;
  pax: number;
  seated_at: string;
  closed_at: string | null;
  status: PosTableSessionStatus;
  opened_by: string | null;
  closed_by: string | null;
  waiter_id: string | null;
  sales_activity_id: string | null;
  cart_snapshot: unknown;
  cancel_reason: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
};

function mapCartSnapshot(raw: unknown): CustomerVisitCartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw as CustomerVisitCartLine[];
}

function mapRow(row: DbRow): PosTableSession {
  return {
    ...row,
    group_id: row.group_id ?? null,
    pos_table_id: row.pos_table_id ?? null,
    waiter_id: row.waiter_id ?? null,
    cancel_reason: row.cancel_reason ?? null,
    customer_name: row.customer_name ?? null,
    customer_phone: row.customer_phone ?? null,
    cart_snapshot: mapCartSnapshot(row.cart_snapshot),
  };
}

const SELECT_COLS =
  "id, organization_id, outlet_id, group_id, pos_table_id, table_name, pax, seated_at, closed_at, status, opened_by, closed_by, waiter_id, sales_activity_id, cart_snapshot, cancel_reason, customer_name, customer_phone, created_at, updated_at";

/** Open sessions for an outlet (occupancy map). */
export function usePosOpenTableSessions(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && outletId);

  const query = useQuery({
    queryKey: [POS_TABLE_SESSIONS_QUERY_KEY, "open", organizationId, outletId],
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<PosTableSession[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_table_sessions")
        .select(SELECT_COLS)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("status", "open")
        .eq("awaiting_cashier_claim", false)
        .is("closed_at", null)
        .order("seated_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as DbRow[]).map(mapRow);
    },
  });

  useEffect(() => {
    if (!organizationId || !outletId) return;
    const channel = supabase
      .channel(`pos-table-sessions-${outletId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pos_table_sessions",
          filter: `outlet_id=eq.${outletId}`,
        },
        () => {
          // Refresh open occupancy + paid/cancelled/enriched bill lists on all POS devices.
          void queryClient.invalidateQueries({
            queryKey: [POS_TABLE_SESSIONS_QUERY_KEY],
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, outletId, queryClient]);

  const sessionsByTableId = useMemo(() => {
    const map = new Map<string, PosTableSession[]>();
    for (const s of query.data ?? []) {
      if (!s.pos_table_id) continue;
      const list = map.get(s.pos_table_id);
      if (list) list.push(s);
      else map.set(s.pos_table_id, [s]);
    }
    return map;
  }, [query.data]);

  return {
    sessions: query.data ?? [],
    sessionsByTableId,
    /** Alias kept for older map callers / HMR mix. */
    byTableId: sessionsByTableId,
    isLoading: enabled ? query.isLoading : false,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function usePosTableSessionMutations(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (!organizationId || !outletId) return;
    void queryClient.invalidateQueries({
      queryKey: [POS_TABLE_SESSIONS_QUERY_KEY, "open", organizationId, outletId],
    });
    void queryClient.invalidateQueries({
      queryKey: [POS_TABLE_SESSIONS_QUERY_KEY, "open-enriched", organizationId, outletId],
    });
    void queryClient.invalidateQueries({
      queryKey: [POS_TABLE_SESSIONS_QUERY_KEY, "cancelled", organizationId, outletId],
    });
    void queryClient.invalidateQueries({
      queryKey: [POS_TABLE_SESSIONS_QUERY_KEY, "paid", organizationId, outletId],
    });
  };

  const upsertOpen = useMutation({
    mutationFn: async (payload: PosTableSessionUpsertPayload): Promise<PosTableSession> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const waiterId = payload.waiterId ?? user?.id ?? null;
      const guest = normalizeSessionCustomer(
        payload.customerName,
        payload.customerPhone,
      );

      // Always insert a new open session (multi-bill per table; walk-in included).
      // Resume/edit existing bills only via updateOpenCart(sessionId).
      const { data, error } = await supabase
        .from("pos_table_sessions")
        .insert({
          organization_id: organizationId,
          outlet_id: payload.outletId,
          group_id: payload.posTableId ? payload.groupId : null,
          pos_table_id: payload.posTableId,
          table_name: payload.posTableId
            ? payload.tableName
            : payload.tableName.trim() || "Walk-in",
          pax: payload.pax,
          status: "open",
          opened_by: user?.id ?? null,
          waiter_id: waiterId,
          cart_snapshot: payload.cartLines,
          customer_name: guest.customer_name,
          customer_phone: guest.customer_phone,
        })
        .select(SELECT_COLS)
        .single();
      if (error) throw error;
      return mapRow(data as DbRow);
    },
    onSuccess: invalidate,
  });

  const closePaid = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      salesActivityId: string;
      closedBy?: string | null;
      autoDoneKitchen?: boolean;
    }): Promise<PosTableSession> => {
      const closedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("pos_table_sessions")
        .update({
          status: "paid",
          closed_at: closedAt,
          sales_activity_id: args.salesActivityId,
          closed_by: args.closedBy ?? null,
        })
        .eq("id", args.sessionId)
        .eq("status", "open")
        .select(SELECT_COLS)
        .single();
      if (error) throw error;
      if (args.autoDoneKitchen !== false) {
        try {
          await markKitchenTicketsDoneForSession(args.sessionId);
        } catch (kdsErr) {
          console.error("markKitchenTicketsDoneForSession failed", kdsErr);
        }
      }
      return mapRow(data as DbRow);
    },
    onSuccess: invalidate,
  });

  const cancelOpen = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      reason?: string | null;
      organizationId?: string;
      outletId?: string;
    }): Promise<void> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const reason = args.reason?.trim() || null;

      if (args.organizationId) {
        let outletId = args.outletId ?? null;
        if (!outletId) {
          const { data: sessionRow } = await supabase
            .from("pos_table_sessions")
            .select("outlet_id")
            .eq("id", args.sessionId)
            .maybeSingle();
          outletId = sessionRow?.outlet_id ?? null;
        }

        if (outletId) {
          const { cancelSessionStockByPolicy } = await import(
            "@/stock-management/stock-commit/lib/stockCommitOrchestrator"
          );
          try {
            await cancelSessionStockByPolicy({
              organizationId: args.organizationId,
              outletId,
              sessionId: args.sessionId,
              reverseId: `cancel-${args.sessionId}`,
            });
          } catch (reverseErr) {
            console.error("cancelSessionStockByPolicy failed", reverseErr);
          }
        }
      }

      const { error } = await supabase
        .from("pos_table_sessions")
        .update({
          status: "cancelled",
          closed_at: new Date().toISOString(),
          closed_by: user?.id ?? null,
          cancel_reason: reason,
        })
        .eq("id", args.sessionId)
        .eq("status", "open");
      if (error) throw error;
      try {
        await voidKitchenTicketsForSession(args.sessionId);
      } catch (kdsErr) {
        console.error("voidKitchenTicketsForSession failed", kdsErr);
      }
    },
    onSuccess: invalidate,
  });

  const updateOpenCart = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      cartLines: CustomerVisitCartLine[];
    }): Promise<void> => {
      const { error } = await supabase
        .from("pos_table_sessions")
        .update({ cart_snapshot: args.cartLines })
        .eq("id", args.sessionId)
        .eq("status", "open");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateOpenCustomer = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      customerName?: string | null;
      customerPhone?: string | null;
    }): Promise<void> => {
      const guest = normalizeSessionCustomer(
        args.customerName,
        args.customerPhone,
      );
      const { error } = await supabase
        .from("pos_table_sessions")
        .update({
          customer_name: guest.customer_name,
          customer_phone: guest.customer_phone,
        })
        .eq("id", args.sessionId)
        .eq("status", "open");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const closeOpenCustomOnly = useMutation({
    mutationFn: async (args: {
      sessionId: string;
      autoDoneKitchen?: boolean;
    }): Promise<void> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pos_table_sessions")
        .update({
          status: "paid",
          closed_at: new Date().toISOString(),
          closed_by: user?.id ?? null,
          cart_snapshot: [],
        })
        .eq("id", args.sessionId)
        .eq("status", "open");
      if (error) throw error;
      if (args.autoDoneKitchen !== false) {
        try {
          await markKitchenTicketsDoneForSession(args.sessionId);
        } catch (kdsErr) {
          console.error("markKitchenTicketsDoneForSession failed", kdsErr);
        }
      }
    },
    onSuccess: invalidate,
  });

  /**
   * Pay-first dine-in seating: close OPEN → paid so the floor plan goes vacant.
   * Does not reverse stock, auto-done KDS tickets, or refund the sale.
   */
  const clearSeatedOpenSession = useMutation({
    mutationFn: async (args: { sessionId: string }): Promise<void> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const patch = planClearSeatedSessionUpdate({
        nowIso: new Date().toISOString(),
        closedBy: user?.id ?? null,
      });
      const { error } = await supabase
        .from("pos_table_sessions")
        .update(patch)
        .eq("id", args.sessionId)
        .eq("status", "open")
        .not("sales_activity_id", "is", null);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    upsertOpen,
    closePaid,
    cancelOpen,
    updateOpenCart,
    updateOpenCustomer,
    closeOpenCustomOnly,
    clearSeatedOpenSession,
    invalidate,
  };
}

/**
 * Resolve open session for pay when sessionId is missing.
 * - 0 open → null
 * - 1 open → that session
 * - >1 open → throw (caller must pass sessionId)
 */
export async function findOpenSessionForTable(args: {
  organizationId: string;
  posTableId: string;
}): Promise<PosTableSession | null> {
  const { data, error } = await supabase
    .from("pos_table_sessions")
    .select(SELECT_COLS)
    .eq("organization_id", args.organizationId)
    .eq("pos_table_id", args.posTableId)
    .eq("status", "open")
    .eq("awaiting_cashier_claim", false)
    .is("closed_at", null)
    .order("seated_at", { ascending: true });
  if (error) throw error;
  const rows = ((data ?? []) as DbRow[]).map(mapRow);
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  throw new Error("pos_table_multiple_open_sessions");
}

export function durationMinutesSince(seatedAtIso: string, end: Date = new Date()): number {
  const start = new Date(seatedAtIso).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((end.getTime() - start) / 60_000));
}
