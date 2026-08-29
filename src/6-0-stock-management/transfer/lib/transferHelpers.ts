import { format, startOfDay } from "date-fns";
import { matchInventoryRpcError } from "@/8-2-5-inventory-settings/lib/mapInventoryRpcError";
import type { StockTransferListRow } from "../types";

export type StockTransferDateGroup = {
  dateKey: string;
  label: string;
  rows: StockTransferListRow[];
};

export function groupTransfersByDate(rows: StockTransferListRow[]): StockTransferDateGroup[] {
  const map = new Map<string, StockTransferListRow[]>();
  for (const row of rows) {
    const key = startOfDay(new Date(row.occurredAt)).toISOString();
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, groupRows]) => ({
      dateKey,
      label: format(new Date(dateKey), "EEE, MMM d, yyyy"),
      rows: groupRows.sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    }));
}

export function lineKey(line: {
  productId?: string | null;
  variantId?: string | null;
  ingredientId?: string | null;
}): string {
  if (line.ingredientId) return `i:${line.ingredientId}`;
  if (line.variantId) return `v:${line.variantId}`;
  return `p:${line.productId ?? ""}`;
}

export function filterTransferRows(rows: StockTransferListRow[], search?: string): StockTransferListRow[] {
  const q = search?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.orderNumber.toLowerCase().includes(q) ||
      row.fromOutletName.toLowerCase().includes(q) ||
      row.toOutletName.toLowerCase().includes(q),
  );
}

export function mapCatalogTransferRpcError(error: unknown, fallback: string): string {
  const inventoryMessage = matchInventoryRpcError(error);
  if (inventoryMessage) return inventoryMessage;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const messages: Record<string, string> = {
    catalog_transfer_same_outlet: "From and To outlets must be different.",
    catalog_stock_insufficient: "Transfer quantity cannot exceed stock at the source outlet.",
    catalog_transfer_lines_required: "Add at least one item with quantity greater than zero.",
    catalog_transfer_outlet_required: "From and To outlets are required.",
    catalog_transfer_forbidden: "You do not have access to create this transfer.",
    catalog_transfer_kind_invalid: "Invalid transfer item type.",
    catalog_transfer_not_found: "Transfer not found.",
    catalog_transfer_invalid_status: "This action is not allowed for the current transfer status.",
  };
  for (const [code, message] of Object.entries(messages)) {
    if (raw.includes(code)) return message;
  }
  return raw.trim() || fallback;
}
