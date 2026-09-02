export type OrderFulfillment = "dine_in" | "takeaway";

export function parseOrderFulfillment(value: unknown): OrderFulfillment {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "takeaway" || raw === "take_away" || raw === "take-away") return "takeaway";
  return "dine_in";
}

export function resolveOrderFulfillment(args: {
  pickupEnabled: boolean;
  selected?: OrderFulfillment | null;
}): OrderFulfillment {
  if (!args.pickupEnabled) return "dine_in";
  return parseOrderFulfillment(args.selected ?? "dine_in");
}

export function orderFulfillmentLabelKey(fulfillment: OrderFulfillment): "dineIn" | "takeAway" {
  return fulfillment === "takeaway" ? "takeAway" : "dineIn";
}
