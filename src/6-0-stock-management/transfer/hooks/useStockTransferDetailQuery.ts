import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { StockTransferDetail, StockTransferEvent, StockTransferLine, StockTransferMovement } from "../types";

export const STOCK_TRANSFER_DETAIL_QUERY_KEY = "inventory-stock-transfer-detail";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function relName(rel: { name: string } | { name: string }[] | null | undefined): string {
  if (!rel) return "—";
  return (Array.isArray(rel) ? rel[0]?.name : rel.name)?.trim() || "—";
}

async function loadActorNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.from("profiles").select("user_id, full_name").in("user_id", unique);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const name = (row as { user_id: string; full_name: string | null }).full_name?.trim();
    if (name) map.set((row as { user_id: string }).user_id, name);
  }
  return map;
}

export function useStockTransferDetailQuery(args: {
  organizationId: string | null;
  transferId: string | null;
}) {
  return useQuery({
    queryKey: [STOCK_TRANSFER_DETAIL_QUERY_KEY, args.organizationId, args.transferId],
    enabled: Boolean(args.organizationId && args.transferId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<StockTransferDetail | null> => {
      if (!args.organizationId || !args.transferId) return null;

      const { data: transfer, error: transferError } = await supabase
        .from("catalog_stock_transfers")
        .select(
          "id, order_number, from_outlet_id, to_outlet_id, item_kind, status, occurred_at, note, from_outlet:pos_outlets!from_outlet_id(name), to_outlet:pos_outlets!to_outlet_id(name)",
        )
        .eq("organization_id", args.organizationId)
        .eq("id", args.transferId)
        .maybeSingle();
      if (transferError) throw transferError;
      if (!transfer) return null;

      const { data: lines, error: linesError } = await supabase
        .from("catalog_stock_transfer_lines")
        .select(
          "id, product_id, variant_id, ingredient_id, qty, unit_snapshot, name_snapshot, in_stock_from_snapshot",
        )
        .eq("transfer_id", args.transferId)
        .order("created_at");
      if (linesError) throw linesError;

      const { data: movements, error: movementsError } = await supabase
        .from("catalog_stock_movements")
        .select("id, outlet_id, qty_delta, qty_after, occurred_at, note, created_by, pos_outlets(name)")
        .eq("organization_id", args.organizationId)
        .eq("reference_type", "inventory_transfer")
        .like("reference_id", `${args.transferId}:%`)
        .order("occurred_at", { ascending: false });
      if (movementsError) throw movementsError;

      const actorNames = await loadActorNames(
        (movements ?? []).map((row) => (row as { created_by: string | null }).created_by).filter(Boolean) as string[],
      );

      const mappedLines: StockTransferLine[] = (lines ?? []).map((line) => ({
        id: line.id,
        productId: line.product_id,
        variantId: line.variant_id,
        ingredientId: line.ingredient_id,
        name: line.name_snapshot,
        qty: num(line.qty),
        unit: line.unit_snapshot,
        inStockFrom: num(line.in_stock_from_snapshot),
      }));

      const mappedMovements: StockTransferMovement[] = (movements ?? []).map((row) => {
        const qtyDelta = num(row.qty_delta);
        const createdBy = (row as { created_by: string | null }).created_by;
        return {
          id: row.id,
          outletId: row.outlet_id,
          outletName: relName(row.pos_outlets as { name: string } | { name: string }[] | null),
          qtyDelta,
          qtyAfter: num(row.qty_after),
          occurredAt: row.occurred_at,
          note: row.note,
          actorName: (createdBy && actorNames.get(createdBy)) || "—",
          direction: qtyDelta < 0 ? "out" : "in",
        };
      });

      const fromRel = (transfer as { from_outlet?: { name: string } | { name: string }[] | null }).from_outlet;
      const toRel = (transfer as { to_outlet?: { name: string } | { name: string }[] | null }).to_outlet;

      let mappedEvents: StockTransferEvent[] = [];
      const { data: events, error: eventsError } = await supabase
        .from("catalog_stock_transfer_events")
        .select("id, event_type, actor_name_snapshot, comment, occurred_at")
        .eq("transfer_id", args.transferId)
        .order("occurred_at", { ascending: false });
      if (!eventsError) {
        mappedEvents = (events ?? []).map((row) => ({
          id: row.id,
          eventType: row.event_type as StockTransferEvent["eventType"],
          actorName: row.actor_name_snapshot,
          comment: row.comment,
          occurredAt: row.occurred_at,
        }));
      }

      return {
        id: transfer.id,
        orderNumber: transfer.order_number,
        fromOutletId: transfer.from_outlet_id,
        fromOutletName: relName(fromRel),
        toOutletId: transfer.to_outlet_id,
        toOutletName: relName(toRel),
        itemKind: transfer.item_kind,
        status: transfer.status,
        lineCount: mappedLines.length,
        totalQty: mappedLines.reduce((sum, line) => sum + line.qty, 0),
        occurredAt: transfer.occurred_at,
        note: transfer.note,
        lines: mappedLines,
        movements: mappedMovements,
        events: mappedEvents,
      };
    },
  });
}
