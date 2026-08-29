import type { CatalogSalesType } from "../types";

export type SalesTypeGratuityWarning = {
  salesTypeId: string;
  salesTypeName: string;
};

/** Active sales types without gratuity links when org gratuity is enabled. */
export function listSalesTypesMissingGratuity(
  salesTypes: CatalogSalesType[],
  gratuityEnabled: boolean,
): SalesTypeGratuityWarning[] {
  if (!gratuityEnabled) return [];

  return salesTypes
    .filter((row) => row.is_active && row.gratuity_ids.length === 0)
    .map((row) => ({
      salesTypeId: row.id,
      salesTypeName: row.name,
    }));
}

export function salesTypeMissingGratuity(
  salesType: CatalogSalesType,
  gratuityEnabled: boolean,
): boolean {
  return gratuityEnabled && salesType.is_active && salesType.gratuity_ids.length === 0;
}
