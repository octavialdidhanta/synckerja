import type { CatalogGratuity } from "../../gratuity/types";

export type GratuityOutletFilterResult = {
  /** Gratuity rows shown as selectable in the form. */
  selectable: CatalogGratuity[];
  /** Selected gratuities that do not overlap the sales type outlets (shown disabled). */
  selectedOutsideOutlets: CatalogGratuity[];
};

function gratuityOverlapsOutlets(gratuity: CatalogGratuity, outletIds: string[]): boolean {
  if (outletIds.length === 0) return true;
  const outletSet = new Set(outletIds);
  return (gratuity.outlet_ids ?? []).some((outletId) => outletSet.has(outletId));
}

/** Limit gratuity pickers to rows relevant for the sales type outlet assignment. */
export function filterGratuitiesForSalesTypeOutlets(
  gratuities: CatalogGratuity[],
  outletIds: string[],
  selectedGratuityIds: Iterable<string> = [],
): GratuityOutletFilterResult {
  const selectedSet = new Set(selectedGratuityIds);
  const selectable: CatalogGratuity[] = [];
  const selectedOutsideOutlets: CatalogGratuity[] = [];

  for (const gratuity of gratuities) {
    const overlaps = gratuityOverlapsOutlets(gratuity, outletIds);
    if (overlaps) {
      selectable.push(gratuity);
      continue;
    }
    if (selectedSet.has(gratuity.id)) {
      selectedOutsideOutlets.push(gratuity);
    }
  }

  return { selectable, selectedOutsideOutlets };
}
