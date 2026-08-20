import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/shared/lib/supabaseClient";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import type {
  PurchaseOrderKindFilter,
  PurchaseOrderListRow,
  PurchaseOrderStatusFilter,
} from "../types";

export const PURCHASE_ORDERS_QUERY_KEY = "inventory-purchase-orders";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function kindToDb(kind: PurchaseOrderKindFilter): "product" | "ingredient" {
  return kind === "item_library" ? "product" : "ingredient";
}

export function usePurchaseOrdersQuery(args: {
  organizationId: string | null;
  outletId: string;
  kind: PurchaseOrderKindFilter;
  status: PurchaseOrderStatusFilter;
  from: Date;
  to: Date;
  search?: string;
}) {
  return useQuery({
    queryKey: [
      PURCHASE_ORDERS_QUERY_KEY,
      args.organizationId,
      args.outletId,
      args.kind,
      args.status,
      args.from.toISOString(),
      args.to.toISOString(),
      args.search ?? "",
    ],
    enabled: Boolean(args.organizationId),
    queryFn: async (): Promise<PurchaseOrderListRow[]> => {
      if (!args.organizationId) return [];

      let query = supabase
        .from("catalog_purchase_orders")
        .select(
          "id, order_number, outlet_id, supplier_id, item_kind, status, total_value, occurred_at, note, pos_outlets(name), catalog_suppliers(name)",
        )
        .eq("organization_id", args.organizationId)
        .eq("item_kind", kindToDb(args.kind))
        .gte("occurred_at", startOfDay(args.from).toISOString())
        .lte("occurred_at", endOfDay(args.to).toISOString())
        .order("occurred_at", { ascending: false });

      if (args.outletId && args.outletId !== POS_OUTLET_FILTER_ALL) {
        query = query.eq("outlet_id", args.outletId);
      }
      if (args.status !== "all") {
        query = query.eq("status", args.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      type Row = {
        id: string;
        order_number: string;
        outlet_id: string;
        supplier_id: string | null;
        item_kind: "product" | "ingredient";
        status: PurchaseOrderListRow["status"];
        total_value: number | string;
        occurred_at: string;
        note: string | null;
        pos_outlets: { name: string } | { name: string }[] | null;
        catalog_suppliers: { name: string } | { name: string }[] | null;
      };

      const q = args.search?.trim().toLowerCase();
      const rows: PurchaseOrderListRow[] = (data ?? []).map((raw) => {
        const row = raw as Row;
        const outletRel = row.pos_outlets;
        const supplierRel = row.catalog_suppliers;
        const outletName = Array.isArray(outletRel) ? outletRel[0]?.name : outletRel?.name;
        const supplierNameRaw = Array.isArray(supplierRel) ? supplierRel[0]?.name : supplierRel?.name;

        return {
          id: row.id,
          orderNumber: row.order_number,
          outletId: row.outlet_id,
          outletName: outletName?.trim() || "—",
          supplierId: row.supplier_id,
          supplierName: supplierNameRaw?.trim() || "No Supplier",
          itemKind: row.item_kind,
          status: row.status,
          totalValue: num(row.total_value),
          occurredAt: row.occurred_at,
          note: row.note,
        };
      });

      if (!q) return rows;
      return rows.filter(
        (row) =>
          row.orderNumber.toLowerCase().includes(q) ||
          row.supplierName.toLowerCase().includes(q) ||
          row.outletName.toLowerCase().includes(q),
      );
    },
  });
}
