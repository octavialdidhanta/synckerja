import type { PosKitchenTicket } from "./posKitchenTypes";

export type KitchenSalesTypeBucket =
  | "dine_in"
  | "takeaway"
  | "delivery"
  | "pickup";

export const KITCHEN_SALES_TYPE_BUCKETS: readonly KitchenSalesTypeBucket[] = [
  "dine_in",
  "takeaway",
  "delivery",
  "pickup",
] as const;

/** Normalize sales_type_label snapshot into a fixed sidebar bucket. */
export function resolveKitchenSalesTypeBucket(
  label: string | null | undefined,
): KitchenSalesTypeBucket {
  const key = (label ?? "").trim().toLowerCase();
  if (key.includes("pick")) return "pickup";
  if (key.includes("take") || key.includes("bawaan") || key.includes("bawa")) {
    return "takeaway";
  }
  if (key.includes("deliver") || key.includes("antar")) return "delivery";
  return "dine_in";
}

export function countTicketsBySalesTypeBucket(
  tickets: Pick<PosKitchenTicket, "sales_type_label">[],
): Record<KitchenSalesTypeBucket, number> {
  const counts: Record<KitchenSalesTypeBucket, number> = {
    dine_in: 0,
    takeaway: 0,
    delivery: 0,
    pickup: 0,
  };
  for (const ticket of tickets) {
    counts[resolveKitchenSalesTypeBucket(ticket.sales_type_label)] += 1;
  }
  return counts;
}
