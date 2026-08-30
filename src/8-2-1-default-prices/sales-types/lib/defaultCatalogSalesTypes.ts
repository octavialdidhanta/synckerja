/** Canonical default sales types (KDS + Library). Protected from delete. */
export const DEFAULT_CATALOG_SALES_TYPE_NAMES = [
  "Dine In",
  "Takeaway",
  "Delivery",
  "Pickup",
] as const;

/** Also treat common spelling variants as defaults. */
const DEFAULT_NAME_ALIASES = new Set(
  [
    ...DEFAULT_CATALOG_SALES_TYPE_NAMES,
    "Dine in",
    "Dinein",
    "Dine-In",
  ].map((n) => n.trim().toLowerCase()),
);

export function isDefaultCatalogSalesTypeName(
  name: string | null | undefined,
): boolean {
  const key = (name ?? "").trim().toLowerCase();
  if (!key) return false;
  if (DEFAULT_NAME_ALIASES.has(key)) return true;
  // Heuristic: exact bucket labels without spaces
  return (
    key === "dine in" ||
    key === "takeaway" ||
    key === "delivery" ||
    key === "pickup"
  );
}
