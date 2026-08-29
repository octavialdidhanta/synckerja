import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosShiftSoldLineRaw } from "./aggregatePosShiftProductsSold";
import { computePosShiftTotals } from "./formatPosCash";
import {
  mapPosCashierShift,
  mapPosCashMovement,
  type PosCashierShift,
  type PosCashMovement,
  type PosCashMovementDirection,
  type PosShiftTotals,
} from "./posShiftTypes";

export const POS_CASHIER_SHIFTS_QUERY_KEY = "pos-cashier-shifts";
export const POS_CASH_MOVEMENTS_QUERY_KEY = "pos-cash-movements";
export const POS_SHIFT_SALES_QUERY_KEY = "pos-shift-sales";

function rpcErrorMessage(error: { message?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("shift_already_open")) return "shift_already_open";
  if (msg.includes("shift_required")) return "shift_required";
  if (msg.includes("shift_not_open")) return "shift_not_open";
  if (msg.includes("not_shift_opener")) return "not_shift_opener";
  return msg || "unknown_error";
}

export function usePosOpenShift(outletId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY, "open", organizationId, outletId],
    queryFn: async (): Promise<PosCashierShift | null> => {
      if (!organizationId || !outletId) return null;
      const { data, error } = await supabase
        .from("pos_cashier_shifts")
        .select(
          "id, organization_id, outlet_id, opened_by, closed_by, opened_at, closed_at, opening_cash, expected_cash, closing_cash, status, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data ? mapPosCashierShift(data as Record<string, unknown>) : null;
    },
    enabled: Boolean(organizationId && outletId),
  });
}

export function usePosShiftHistory(outletId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY, "history", organizationId, outletId],
    queryFn: async (): Promise<PosCashierShift[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_cashier_shifts")
        .select(
          "id, organization_id, outlet_id, opened_by, closed_by, opened_at, closed_at, opening_cash, expected_cash, closing_cash, status, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row) => mapPosCashierShift(row as Record<string, unknown>));
    },
    enabled: Boolean(organizationId && outletId),
    // App QueryClient defaults refetchOnMount: false — without this, History keeps a stale empty cache after End Shift.
    refetchOnMount: "always",
  });
}

export function usePosCashMovements(shiftId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_CASH_MOVEMENTS_QUERY_KEY, organizationId, shiftId],
    queryFn: async (): Promise<PosCashMovement[]> => {
      if (!organizationId || !shiftId) return [];
      const { data, error } = await supabase
        .from("pos_cash_movements")
        .select(
          "id, organization_id, shift_id, direction, amount, description, created_by, created_at",
        )
        .eq("organization_id", organizationId)
        .eq("shift_id", shiftId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapPosCashMovement(row as Record<string, unknown>));
    },
    enabled: Boolean(organizationId && shiftId),
  });
}

export type PosShiftSalesSummary = {
  cashSales: number;
  cashRefunds: number;
  productsSoldQty: number;
  refundedProductsQty: number;
  lines: PosShiftSoldLineRaw[];
};

export function usePosShiftSalesSummary(shiftId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_SHIFT_SALES_QUERY_KEY, organizationId, shiftId],
    queryFn: async (): Promise<PosShiftSalesSummary> => {
      if (!organizationId || !shiftId) {
        return {
          cashSales: 0,
          cashRefunds: 0,
          productsSoldQty: 0,
          refundedProductsQty: 0,
          lines: [],
        };
      }
      const { data: activities, error } = await supabase
        .from("sales_activities")
        .select(
          "id, total_paid_amount, payment_method, refund_status, refund_amount, refund_pos_shift_id, pos_shift_id",
        )
        .eq("organization_id", organizationId)
        .eq("status", "Converted")
        .or(`pos_shift_id.eq.${shiftId},refund_pos_shift_id.eq.${shiftId}`);
      if (error) throw error;

      const cashSales = (activities ?? [])
        .filter(
          (a) =>
            a.payment_method === "cash" &&
            a.pos_shift_id === shiftId &&
            (a.refund_status ?? "none") === "none",
        )
        .reduce((sum, a) => sum + Number(a.total_paid_amount ?? 0), 0);

      const cashRefunds = (activities ?? [])
        .filter(
          (a) =>
            a.payment_method === "cash" &&
            a.refund_pos_shift_id === shiftId &&
            (a.refund_status ?? "none") === "full",
        )
        .reduce((sum, a) => sum + Number(a.refund_amount ?? 0), 0);

      const soldIds = (activities ?? [])
        .filter((a) => a.pos_shift_id === shiftId && (a.refund_status ?? "none") === "none")
        .map((a) => a.id as string)
        .filter(Boolean);
      const refundIds = (activities ?? [])
        .filter(
          (a) =>
            a.refund_pos_shift_id === shiftId &&
            (a.refund_status ?? "none") === "full",
        )
        .map((a) => a.id as string)
        .filter(Boolean);

      let refundedProductsQty = 0;
      if (refundIds.length > 0) {
        const { data: refundItems, error: refundItemsErr } = await supabase
          .from("sales_activity_items")
          .select("quantity")
          .in("sales_activity_id", refundIds);
        if (refundItemsErr) throw refundItemsErr;
        refundedProductsQty = (refundItems ?? []).reduce(
          (sum, row) => sum + Number(row.quantity ?? 0),
          0,
        );
      }

      if (soldIds.length === 0) {
        return {
          cashSales,
          cashRefunds,
          productsSoldQty: 0,
          refundedProductsQty,
          lines: [],
        };
      }

      const { data: items, error: itemsErr } = await supabase
        .from("sales_activity_items")
        .select("service_name, sub_service_name, quantity")
        .in("sales_activity_id", soldIds);
      if (itemsErr) throw itemsErr;

      const lines: PosShiftSoldLineRaw[] = (items ?? []).map((row) => ({
        service_name: (row.service_name as string | null) ?? null,
        sub_service_name: (row.sub_service_name as string | null) ?? null,
        quantity: Number(row.quantity ?? 0),
      }));

      const productsSoldQty = lines.reduce((sum, row) => sum + row.quantity, 0);
      return {
        cashSales,
        cashRefunds,
        productsSoldQty,
        refundedProductsQty,
        lines,
      };
    },
    enabled: Boolean(organizationId && shiftId),
  });
}

export function usePosCashierShiftActions(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY],
      refetchType: "all",
    });
    void queryClient.invalidateQueries({ queryKey: [POS_CASH_MOVEMENTS_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [POS_SHIFT_SALES_QUERY_KEY] });
  };

  const start = useMutation({
    mutationFn: async (openingCash: number) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      const { data, error } = await supabase.rpc("pos_start_shift", {
        p_organization_id: organizationId,
        p_outlet_id: outletId,
        p_opening_cash: Math.max(0, openingCash),
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return mapPosCashierShift(data as Record<string, unknown>);
    },
    onSuccess: invalidate,
  });

  const ensureOpen = useMutation({
    mutationFn: async () => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      const { data, error } = await supabase.rpc("pos_ensure_open_shift", {
        p_organization_id: organizationId,
        p_outlet_id: outletId,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return mapPosCashierShift(data as Record<string, unknown>);
    },
    onSuccess: invalidate,
  });

  const end = useMutation({
    mutationFn: async (payload: { shiftId: string; closingCash: number }) => {
      const closing = Math.max(0, Math.round(payload.closingCash));
      const { data, error } = await supabase.rpc("pos_end_shift", {
        p_shift_id: payload.shiftId,
        p_closing_cash: closing,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return mapPosCashierShift(data as Record<string, unknown>);
    },
    onSuccess: (closed) => {
      // Seed history cache immediately so Histori Shift is not stuck on a stale empty list
      // (global QueryClient uses refetchOnMount: false).
      queryClient.setQueryData<PosCashierShift[]>(
        [POS_CASHIER_SHIFTS_QUERY_KEY, "history", organizationId, outletId],
        (prev) => {
          const list = prev ?? [];
          if (list.some((row) => row.id === closed.id)) return list;
          return [closed, ...list];
        },
      );
      invalidate();
    },
  });

  const addMovement = useMutation({
    mutationFn: async (payload: {
      shiftId: string;
      direction: PosCashMovementDirection;
      amount: number;
      description: string;
    }) => {
      const { data, error } = await supabase.rpc("pos_add_cash_movement", {
        p_shift_id: payload.shiftId,
        p_direction: payload.direction,
        p_amount: payload.amount,
        p_description: payload.description,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return mapPosCashMovement(data as Record<string, unknown>);
    },
    onSuccess: invalidate,
  });

  return {
    start: start.mutateAsync,
    ensureOpen: ensureOpen.mutateAsync,
    end: (shiftId: string, closingCash: number) =>
      end.mutateAsync({ shiftId, closingCash }),
    addMovement: addMovement.mutateAsync,
    isStarting: start.isPending,
    isEnding: end.isPending,
    isAddingMovement: addMovement.isPending,
    isEnsuring: ensureOpen.isPending,
  };
}

export function buildLiveShiftTotals(
  shift: PosCashierShift | null,
  movements: PosCashMovement[],
  sales:
    | { cashSales: number; cashRefunds?: number; productsSoldQty: number }
    | undefined,
): PosShiftTotals | null {
  if (!shift) return null;
  return computePosShiftTotals({
    openingCash: shift.opening_cash,
    cashSales: sales?.cashSales ?? 0,
    cashRefunds: sales?.cashRefunds ?? 0,
    movements,
    productsSoldQty: sales?.productsSoldQty ?? 0,
  });
}

/** Resolve open shift for Pay: return existing, auto-start if enabled, else throw shift_required. */
export async function resolvePosShiftForPay(args: {
  organizationId: string;
  outletId: string;
}): Promise<string> {
  const { data: open, error: openErr } = await supabase
    .from("pos_cashier_shifts")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("outlet_id", args.outletId)
    .eq("status", "open")
    .maybeSingle();
  if (openErr) throw openErr;
  if (open?.id) return open.id as string;

  const { data, error } = await supabase.rpc("pos_ensure_open_shift", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  const mapped = mapPosCashierShift(data as Record<string, unknown>);
  return mapped.id;
}
