import type { KitchenSalesTypeBucket } from "../../lib/kitchenSalesTypeBucket";

/** Canonical Library names for the four KDS order-type buckets. */
export const DEFAULT_KITCHEN_SALES_TYPES: readonly {
  name: string;
  bucket: KitchenSalesTypeBucket;
  sort_order: number;
}[] = [
  { name: "Dine In", bucket: "dine_in", sort_order: 1 },
  { name: "Takeaway", bucket: "takeaway", sort_order: 2 },
  { name: "Delivery", bucket: "delivery", sort_order: 3 },
  { name: "Pickup", bucket: "pickup", sort_order: 4 },
] as const;
