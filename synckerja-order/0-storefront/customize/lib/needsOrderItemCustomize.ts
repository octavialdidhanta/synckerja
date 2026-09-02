import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";

/** Guest must pick options before add: bundle package, modifiers, or more than one variant. */
export function needsOrderItemCustomize(item: PublicOrderCatalogItem): boolean {
  if (item.kind === "bundle") return true;
  if (item.has_modifiers) return true;
  const variantCount = item.variant_count ?? item.variants.length;
  return variantCount > 1;
}
