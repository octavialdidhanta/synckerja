import { parseGroupedIdInteger } from "../../utils/formatIdUnitPrice";
import type { CatalogProductSalesTypePrice, CatalogProductVariant, VariantDraft } from "./types";

export function parsedVariantPrice(display: string): number {
  const n = parseGroupedIdInteger(display);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function persistableVariants(drafts: VariantDraft[]): CatalogProductVariant[] {
  return drafts
    .map((row, index) => ({
      id: row.id,
      name: row.name.trim(),
      sku: row.sku.trim() || null,
      price: parsedVariantPrice(row.priceDisplay),
      sort_order: index + 1,
    }))
    .filter((row) => row.name.length > 0);
}

export function masterUnitPriceFromVariants(
  variants: CatalogProductVariant[],
  fallback: number,
): number {
  if (variants.length === 0) return fallback;
  return variants[0].price;
}

export function persistableSalesTypePrices(args: {
  useSalesTypePrices: boolean;
  variants: CatalogProductVariant[];
  productDisplays: Record<string, string>;
  variantDisplays: Record<string, Record<string, string>>;
}): CatalogProductSalesTypePrice[] {
  if (!args.useSalesTypePrices) return [];
  if (args.variants.length === 0) {
    return Object.entries(args.productDisplays)
      .map(([sales_type_id, display]) => ({
        variant_id: null,
        sales_type_id,
        price: parsedVariantPrice(display),
      }))
      .filter((row) => row.sales_type_id);
  }
  const rows: CatalogProductSalesTypePrice[] = [];
  for (const variant of args.variants) {
    const displays = args.variantDisplays[variant.id] ?? {};
    for (const [sales_type_id, display] of Object.entries(displays)) {
      rows.push({
        variant_id: variant.id,
        sales_type_id,
        price: parsedVariantPrice(display),
      });
    }
  }
  return rows;
}

export function displaySku(args: {
  catalogSku?: string | null;
  variants: CatalogProductVariant[];
  inventorySkuCode?: string | null;
}): string {
  if (args.variants.length > 0) {
    return args.variants.map((row) => row.sku).filter(Boolean).join(", ") || "—";
  }
  return args.catalogSku?.trim() || args.inventorySkuCode?.trim() || "—";
}
