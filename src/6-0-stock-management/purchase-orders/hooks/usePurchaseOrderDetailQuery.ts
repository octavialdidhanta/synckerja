import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PurchaseOrderDetail, PurchaseOrderEvent, PurchaseOrderLine } from "../types";

export const PURCHASE_ORDER_DETAIL_QUERY_KEY = "inventory-purchase-order-detail";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function usePurchaseOrderDetailQuery(args: {
  organizationId: string | null;
  purchaseOrderId: string | null;
  outletId: string;
}) {
  return useQuery({
    queryKey: [PURCHASE_ORDER_DETAIL_QUERY_KEY, args.organizationId, args.purchaseOrderId],
    enabled: Boolean(args.organizationId && args.purchaseOrderId),
    queryFn: async (): Promise<PurchaseOrderDetail | null> => {
      if (!args.organizationId || !args.purchaseOrderId) return null;

      const { data: po, error: poError } = await supabase
        .from("catalog_purchase_orders")
        .select(
          "id, order_number, outlet_id, supplier_id, item_kind, status, total_value, occurred_at, note, fulfilled_at, cancelled_at, pos_outlets(name), catalog_suppliers(name, phone, email, address, city, state, zip)",
        )
        .eq("organization_id", args.organizationId)
        .eq("id", args.purchaseOrderId)
        .maybeSingle();
      if (poError) throw poError;
      if (!po) return null;

      const { data: lines, error: linesError } = await supabase
        .from("catalog_purchase_order_lines")
        .select("id, product_id, variant_id, ingredient_id, qty, unit_cost, subtotal, name_snapshot")
        .eq("purchase_order_id", args.purchaseOrderId)
        .order("created_at");
      if (linesError) throw linesError;

      const { data: events, error: eventsError } = await supabase
        .from("catalog_purchase_order_events")
        .select("id, event_type, actor_name_snapshot, comment, occurred_at")
        .eq("purchase_order_id", args.purchaseOrderId)
        .order("occurred_at", { ascending: false });
      if (eventsError) throw eventsError;

      const lineRows = lines ?? [];
      const stockMap = new Map<string, number>();

      const productIds = lineRows.map((l) => l.product_id).filter(Boolean) as string[];
      const variantIds = lineRows.map((l) => l.variant_id).filter(Boolean) as string[];
      const ingredientIds = lineRows.map((l) => l.ingredient_id).filter(Boolean) as string[];

      if (variantIds.length > 0) {
        const { data: variantStocks } = await supabase
          .from("catalog_product_variant_outlets")
          .select("variant_id, in_stock")
          .eq("outlet_id", po.outlet_id)
          .in("variant_id", variantIds);
        for (const row of variantStocks ?? []) {
          stockMap.set(`v:${row.variant_id}`, num(row.in_stock));
        }
      }

      if (productIds.length > 0) {
        const { data: productStocks } = await supabase
          .from("catalog_product_outlets")
          .select("product_id, in_stock")
          .eq("outlet_id", po.outlet_id)
          .in("product_id", productIds);
        for (const row of productStocks ?? []) {
          stockMap.set(`p:${row.product_id}`, num(row.in_stock));
        }
      }

      if (ingredientIds.length > 0) {
        const { data: ingredientStocks } = await supabase
          .from("catalog_ingredient_outlets")
          .select("ingredient_id, in_stock")
          .eq("outlet_id", po.outlet_id)
          .in("ingredient_id", ingredientIds);
        for (const row of ingredientStocks ?? []) {
          stockMap.set(`i:${row.ingredient_id}`, num(row.in_stock));
        }
      }

      const mappedLines: PurchaseOrderLine[] = lineRows.map((line) => {
        const inStock = line.variant_id
          ? stockMap.get(`v:${line.variant_id}`) ?? 0
          : line.ingredient_id
            ? stockMap.get(`i:${line.ingredient_id}`) ?? 0
            : line.product_id
              ? stockMap.get(`p:${line.product_id}`) ?? 0
              : 0;

        return {
          id: line.id,
          productId: line.product_id,
          variantId: line.variant_id,
          ingredientId: line.ingredient_id,
          name: line.name_snapshot,
          qty: num(line.qty),
          unitCost: num(line.unit_cost),
          subtotal: num(line.subtotal),
          inStock,
        };
      });

      const mappedEvents: PurchaseOrderEvent[] = (events ?? []).map((event) => ({
        id: event.id,
        eventType: event.event_type as PurchaseOrderEvent["eventType"],
        actorName: event.actor_name_snapshot,
        comment: event.comment,
        occurredAt: event.occurred_at,
      }));

      const outletRel = po.pos_outlets as { name: string } | { name: string }[] | null;
      const supplierRel = po.catalog_suppliers as
        | {
            name: string;
            phone: string | null;
            email: string | null;
            address: string | null;
            city: string | null;
            state: string | null;
            zip: string | null;
          }
        | Array<{
            name: string;
            phone: string | null;
            email: string | null;
            address: string | null;
            city: string | null;
            state: string | null;
            zip: string | null;
          }>
        | null;

      const outletName = Array.isArray(outletRel) ? outletRel[0]?.name : outletRel?.name;
      const supplier = Array.isArray(supplierRel) ? supplierRel[0] : supplierRel;

      return {
        id: po.id,
        orderNumber: po.order_number,
        outletId: po.outlet_id,
        outletName: outletName?.trim() || "—",
        supplierId: po.supplier_id,
        supplierName: supplier?.name?.trim() || "No Supplier",
        itemKind: po.item_kind,
        status: po.status,
        totalValue: num(po.total_value),
        occurredAt: po.occurred_at,
        note: po.note,
        fulfilledAt: po.fulfilled_at,
        cancelledAt: po.cancelled_at,
        supplier: supplier
          ? {
              name: supplier.name,
              phone: supplier.phone,
              email: supplier.email,
              address: supplier.address,
              city: supplier.city,
              state: supplier.state,
              zip: supplier.zip,
            }
          : null,
        lines: mappedLines,
        events: mappedEvents,
      };
    },
  });
}
