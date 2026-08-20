import { isCatalogPosStatus, normalizeCatalogPosStatus, type CatalogPosStatus } from "../../lib/catalogKind";
import type { DefaultPriceRow } from "../../types/defaultPrices";
import type { CatalogProductOutletLink, ProductOutletOverride } from "../types";

export function mapProductOutletLinks(
  links: Array<{ outlet_id?: string; unit_price?: number | string | null; pos_status?: string | null }> | null | undefined,
): { outlet_ids: string[]; outlet_overrides: Record<string, ProductOutletOverride> } {
  const outlet_ids: string[] = [];
  const outlet_overrides: Record<string, ProductOutletOverride> = {};
  for (const link of links ?? []) {
    if (!link.outlet_id) continue;
    outlet_ids.push(link.outlet_id);
    const rawPrice = link.unit_price == null ? null : Number(link.unit_price);
    outlet_overrides[link.outlet_id] = {
      unit_price: rawPrice != null && Number.isFinite(rawPrice) ? rawPrice : null,
      pos_status: isCatalogPosStatus(link.pos_status) ? link.pos_status : null,
    };
  }
  return { outlet_ids, outlet_overrides };
}

export function effectiveUnitPrice(row: Pick<DefaultPriceRow, "unit_price" | "outlet_overrides">, outletId: string | null): number {
  if (!outletId) return Number(row.unit_price) || 0;
  const override = row.outlet_overrides?.[outletId]?.unit_price;
  if (override != null && Number.isFinite(override)) return override;
  return Number(row.unit_price) || 0;
}

export function effectivePosStatus(
  row: Pick<DefaultPriceRow, "pos_status" | "outlet_overrides">,
  outletId: string | null,
): CatalogPosStatus {
  if (!outletId) return normalizeCatalogPosStatus(row.pos_status);
  const override = row.outlet_overrides?.[outletId]?.pos_status;
  return override ?? normalizeCatalogPosStatus(row.pos_status);
}

export function hasPriceOverride(row: Pick<DefaultPriceRow, "outlet_overrides">, outletId: string | null): boolean {
  if (!outletId) return false;
  return row.outlet_overrides?.[outletId]?.unit_price != null;
}

export function hasStatusOverride(row: Pick<DefaultPriceRow, "outlet_overrides">, outletId: string | null): boolean {
  if (!outletId) return false;
  return row.outlet_overrides?.[outletId]?.pos_status != null;
}

export function resolveOutletOverrideValues(args: {
  masterPrice: number;
  masterStatus: CatalogPosStatus;
  effectivePrice: number;
  effectiveStatus: CatalogPosStatus;
  useDefaultPrice: boolean;
  useDefaultStatus: boolean;
}): ProductOutletOverride {
  return {
    unit_price: args.useDefaultPrice || args.effectivePrice === args.masterPrice ? null : args.effectivePrice,
    pos_status: args.useDefaultStatus || args.effectiveStatus === args.masterStatus ? null : args.effectiveStatus,
  };
}

export function toCatalogProductOutletLink(
  outletId: string,
  override: ProductOutletOverride | undefined,
): CatalogProductOutletLink {
  return {
    outlet_id: outletId,
    unit_price: override?.unit_price ?? null,
    pos_status: override?.pos_status ?? null,
  };
}
