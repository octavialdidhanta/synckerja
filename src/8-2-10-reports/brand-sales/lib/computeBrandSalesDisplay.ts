import {
  BRAND_SALES_RECONCILIATION_EPSILON,
  EMPTY_BRAND_SALES_DISPLAY,
  type BrandSalesBrandRow,
  type BrandSalesDisplay,
  type BrandSalesDisplayRow,
  type BrandSalesItemRow,
  type BrandSalesOutletRow,
  type BrandSalesSortDir,
  type BrandSalesSortKey,
} from "./brandSalesTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function bool(row: Partial<Record<string, unknown>>, key: string): boolean {
  return Boolean(row[key]);
}

function normalizeMetrics(row: Partial<Record<string, unknown>>) {
  const netSales = num(row, "net_sales");
  const cogs = num(row, "cogs");
  const grossProfit =
    row.gross_profit != null && Number.isFinite(Number(row.gross_profit))
      ? num(row, "gross_profit")
      : netSales - cogs;
  const marginPct =
    row.margin_pct != null && Number.isFinite(Number(row.margin_pct))
      ? num(row, "margin_pct")
      : netSales > 0
        ? Math.round(((grossProfit / netSales) * 100) * 100) / 100
        : 0;

  return {
    qtySold: num(row, "qty_sold"),
    qtyRefunded: num(row, "qty_refunded"),
    grossSales: num(row, "gross_sales"),
    netSales,
    discountAmount: num(row, "discount_amount"),
    refundAmount: num(row, "refund_amount"),
    cogs,
    grossProfit,
    marginPct,
    cogsIncomplete: bool(row, "cogs_incomplete"),
    cogsEstimated: bool(row, "cogs_estimated"),
  };
}

export function normalizeBrandSalesBrandRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unbrandedLabel: string,
): BrandSalesBrandRow {
  if (!row) {
    return {
      brandId: null,
      brandName: unbrandedLabel,
      sortOrder: 9999,
      qtySold: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      cogs: 0,
      grossProfit: 0,
      marginPct: 0,
      cogsIncomplete: false,
      cogsEstimated: false,
    };
  }

  const brandId = row.brand_id != null ? String(row.brand_id) : null;
  const rawName = String(row.brand_name ?? "").trim();

  return {
    brandId,
    brandName: rawName || unbrandedLabel,
    sortOrder: Math.round(num(row, "sort_order")) || 9999,
    ...normalizeMetrics(row),
  };
}

export function normalizeBrandSalesItemRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unbrandedLabel: string,
): BrandSalesItemRow {
  if (!row) {
    return {
      brandId: null,
      brandName: unbrandedLabel,
      brandSortOrder: 9999,
      catalogProductId: null,
      catalogVariantId: null,
      catalogBundleId: null,
      itemName: "Unlinked",
      variantName: null,
      sku: null,
      qtySold: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      cogs: 0,
      grossProfit: 0,
      marginPct: 0,
      cogsIncomplete: false,
      cogsEstimated: false,
    };
  }

  const brandId = row.brand_id != null ? String(row.brand_id) : null;
  const rawBrandName = String(row.brand_name ?? "").trim();
  const variantRaw = row.variant_name;
  const skuRaw = row.sku;

  return {
    brandId,
    brandName: rawBrandName || unbrandedLabel,
    brandSortOrder: Math.round(num(row, "brand_sort_order")) || 9999,
    catalogProductId: row.catalog_product_id ? String(row.catalog_product_id) : null,
    catalogVariantId: row.catalog_variant_id ? String(row.catalog_variant_id) : null,
    catalogBundleId: row.catalog_bundle_id ? String(row.catalog_bundle_id) : null,
    itemName: String(row.item_name ?? "Unlinked").trim() || "Unlinked",
    variantName:
      variantRaw == null || String(variantRaw).trim() === ""
        ? null
        : String(variantRaw).trim(),
    sku: skuRaw == null || String(skuRaw).trim() === "" ? null : String(skuRaw).trim(),
    ...normalizeMetrics(row),
  };
}

export function normalizeBrandSalesOutletRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unbrandedLabel: string,
): BrandSalesOutletRow {
  if (!row) {
    return {
      brandId: null,
      brandName: unbrandedLabel,
      outletId: "",
      outletName: "Outlet",
      qtySold: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      cogs: 0,
      grossProfit: 0,
      marginPct: 0,
      cogsIncomplete: false,
      cogsEstimated: false,
    };
  }

  const brandId = row.brand_id != null ? String(row.brand_id) : null;
  const rawBrandName = String(row.brand_name ?? "").trim();

  return {
    brandId,
    brandName: rawBrandName || unbrandedLabel,
    outletId: String(row.outlet_id ?? ""),
    outletName: String(row.outlet_name ?? "Outlet").trim() || "Outlet",
    ...normalizeMetrics(row),
  };
}

export function brandRowKey(brandId: string | null): string {
  return brandId ?? "__unbranded__";
}

export function itemRowKey(row: BrandSalesItemRow): string {
  if (row.catalogBundleId) return `bundle:${row.catalogBundleId}`;
  return `product:${row.catalogProductId ?? "none"}:variant:${row.catalogVariantId ?? "none"}`;
}

export function formatBrandItemDisplayName(row: Pick<BrandSalesItemRow, "itemName" | "variantName">): string {
  if (row.variantName) return `${row.itemName} - ${row.variantName}`;
  return row.itemName;
}

function sumBrandTotals(brands: BrandSalesBrandRow[]) {
  return brands.reduce(
    (acc, row) => ({
      qtySold: acc.qtySold + row.qtySold,
      qtyRefunded: acc.qtyRefunded + row.qtyRefunded,
      grossSales: acc.grossSales + row.grossSales,
      netSales: acc.netSales + row.netSales,
      discountAmount: acc.discountAmount + row.discountAmount,
      refundAmount: acc.refundAmount + row.refundAmount,
      cogs: acc.cogs + row.cogs,
      grossProfit: acc.grossProfit + row.grossProfit,
    }),
    {
      qtySold: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      cogs: 0,
      grossProfit: 0,
    },
  );
}

export function buildBrandSalesDisplay(args: {
  brandRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  itemRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  unbrandedLabel: string;
}): BrandSalesDisplay {
  if (!args.brandRowsRaw?.length && !args.itemRowsRaw?.length) {
    return EMPTY_BRAND_SALES_DISPLAY;
  }

  const brands = (args.brandRowsRaw ?? []).map((r) =>
    normalizeBrandSalesBrandRow(r, args.unbrandedLabel),
  );
  const items = (args.itemRowsRaw ?? []).map((r) =>
    normalizeBrandSalesItemRow(r, args.unbrandedLabel),
  );

  const summaryProductNetSales = num(args.brandRowsRaw?.[0] ?? {}, "summary_product_net_sales");
  const grandTotal = sumBrandTotals(brands);
  const reconciliationOk =
    Math.abs(grandTotal.netSales - summaryProductNetSales) <= BRAND_SALES_RECONCILIATION_EPSILON;
  const hasCogsIncomplete =
    brands.some((b) => b.cogsIncomplete) || items.some((i) => i.cogsIncomplete);

  const itemsByBrand = new Map<string, BrandSalesItemRow[]>();
  for (const item of items) {
    const key = brandRowKey(item.brandId);
    const list = itemsByBrand.get(key) ?? [];
    list.push(item);
    itemsByBrand.set(key, list);
  }

  const displayRows: BrandSalesDisplayRow[] = [];
  for (const brand of brands) {
    displayRows.push({ rowKind: "brand", ...brand });
    const children = [...(itemsByBrand.get(brandRowKey(brand.brandId)) ?? [])].sort(
      (a, b) => b.netSales - a.netSales || formatBrandItemDisplayName(a).localeCompare(formatBrandItemDisplayName(b)),
    );
    for (const item of children) {
      displayRows.push({ rowKind: "item", ...item });
    }
  }

  return {
    brands,
    items,
    displayRows,
    grandTotal,
    summaryProductNetSales,
    reconciliationOk,
    hasCogsIncomplete,
  };
}

export function sortBrandSalesBrands(
  brands: BrandSalesBrandRow[],
  sortKey: BrandSalesSortKey,
  sortDir: BrandSalesSortDir,
): BrandSalesBrandRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...brands].sort((a, b) => {
    if (sortKey === "brandName") {
      const cmp = a.brandName.localeCompare(b.brandName, undefined, { sensitivity: "base" });
      if (cmp !== 0) return dir * cmp;
      return a.sortOrder - b.sortOrder;
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return a.brandName.localeCompare(b.brandName, undefined, { sensitivity: "base" });
    return dir * (av - bv);
  });
}

export function rebuildDisplayRows(
  brands: BrandSalesBrandRow[],
  items: BrandSalesItemRow[],
): BrandSalesDisplayRow[] {
  const itemsByBrand = new Map<string, BrandSalesItemRow[]>();
  for (const item of items) {
    const key = brandRowKey(item.brandId);
    const list = itemsByBrand.get(key) ?? [];
    list.push(item);
    itemsByBrand.set(key, list);
  }

  const displayRows: BrandSalesDisplayRow[] = [];
  for (const brand of brands) {
    displayRows.push({ rowKind: "brand", ...brand });
    const children = [...(itemsByBrand.get(brandRowKey(brand.brandId)) ?? [])].sort(
      (a, b) => b.netSales - a.netSales || formatBrandItemDisplayName(a).localeCompare(formatBrandItemDisplayName(b)),
    );
    for (const item of children) {
      displayRows.push({ rowKind: "item", ...item });
    }
  }
  return displayRows;
}
