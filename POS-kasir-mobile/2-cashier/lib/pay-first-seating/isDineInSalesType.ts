import { resolveKitchenSalesTypeBucket } from "@/pos-mobile/8-kitchen/lib/kitchenSalesTypeBucket";

/** True when the checkout sales type maps to the dine-in kitchen bucket. */
export function isDineInSalesType(label: string | null | undefined): boolean {
  return resolveKitchenSalesTypeBucket(label) === "dine_in";
}
