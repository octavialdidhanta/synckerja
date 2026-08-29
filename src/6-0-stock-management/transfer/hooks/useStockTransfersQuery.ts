import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/shared/lib/supabaseClient";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import type { TransferKindFilter, StockTransferListRow, StockTransferStatusFilter } from "../types";

export const STOCK_TRANSFERS_QUERY_KEY = "inventory-stock-transfers";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function kindToDb(kind: TransferKindFilter): "product" | "ingredient" {
  return kind === "item_library" ? "product" : "ingredient";
}

function relName(
  rel: { name: string } | { name: string }[] | null | undefined,
): string {
  if (!rel) return "—";
  return (Array.isArray(rel) ? rel[0]?.name : rel.name)?.trim() || "—";
}

export function useStockTransfersQuery(args: {
  organizationId: string | null;
  outletId: string;
  kind: TransferKindFilter;
  status?: StockTransferStatusFilter;
  from: Date;
  to: Date;
}) {
  return useQuery({
    queryKey: [
      STOCK_TRANSFERS_QUERY_KEY,
      args.organizationId,
      args.outletId,
      args.kind,
      args.status ?? "all",
      args.from.toISOString(),
      args.to.toISOString(),
    ],
    enabled: Boolean(args.organizationId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<StockTransferListRow[]> => {
      if (!args.organizationId) return [];

      let query = supabase
        .from("catalog_stock_transfers")
        .select(
          "id, order_number, from_outlet_id, to_outlet_id, item_kind, status, occurred_at, note, from_outlet:pos_outlets!from_outlet_id(name), to_outlet:pos_outlets!to_outlet_id(name), catalog_stock_transfer_lines(qty)",
        )
        .eq("organization_id", args.organizationId)
        .eq("item_kind", kindToDb(args.kind))
        .gte("occurred_at", startOfDay(args.from).toISOString())
        .lte("occurred_at", endOfDay(args.to).toISOString())
        .order("occurred_at", { ascending: false });

      if (args.status && args.status !== "all") {
        query = query.eq("status", args.status);
      }

      if (args.outletId && args.outletId !== POS_OUTLET_FILTER_ALL) {
        query = query.or(`from_outlet_id.eq.${args.outletId},to_outlet_id.eq.${args.outletId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((raw) => {
        const row = raw as {
          id: string;
          order_number: string;
          from_outlet_id: string;
          to_outlet_id: string;
          item_kind: "product" | "ingredient";
          status: StockTransferListRow["status"];
          occurred_at: string;
          note: string | null;
          from_outlet: { name: string } | { name: string }[] | null;
          to_outlet: { name: string } | { name: string }[] | null;
          catalog_stock_transfer_lines: Array<{ qty: number | string }> | null;
        };
        const lines = row.catalog_stock_transfer_lines ?? [];
        return {
          id: row.id,
          orderNumber: row.order_number,
          fromOutletId: row.from_outlet_id,
          fromOutletName: relName(row.from_outlet),
          toOutletId: row.to_outlet_id,
          toOutletName: relName(row.to_outlet),
          itemKind: row.item_kind,
          status: row.status,
          lineCount: lines.length,
          totalQty: lines.reduce((sum, line) => sum + num(line.qty), 0),
          occurredAt: row.occurred_at,
          note: row.note,
        };
      });
    },
  });
}
