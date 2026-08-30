import type { KitchenSalesTypeBucket } from "../../lib/kitchenSalesTypeBucket";
import { KITCHEN_SALES_TYPE_BUCKETS } from "../../lib/kitchenSalesTypeBucket";
import {
  DEFAULT_ORDER_TYPE_VISIBILITY,
  type KitchenOrderTypeVisibility,
} from "./posKitchenSettingsTypes";

export function parseOrderTypeVisibility(
  raw: unknown,
): KitchenOrderTypeVisibility {
  const base = { ...DEFAULT_ORDER_TYPE_VISIBILITY };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of KITCHEN_SALES_TYPE_BUCKETS) {
    if (typeof obj[key] === "boolean") {
      base[key as KitchenSalesTypeBucket] = obj[key] as boolean;
    }
  }
  return base;
}
