import { catalogItemLabel } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

/** Two-letter avatar initials from catalog label (mockup style). */
export function catalogItemInitials(item: CustomerVisitCatalogItem): string {
  const label = catalogItemLabel(item).trim();
  if (!label) return "??";
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.slice(0, 2);
  }
  return label.slice(0, 2);
}
