import {
  EMPTY_ITEM_SALES_DISPLAY,
  EMPTY_ITEM_SALES_HOURLY_DISPLAY,
  ITEM_SALES_RECONCILIATION_EPSILON,
  type ItemSalesDisplay,
  type ItemSalesHourlyDisplay,
  type ItemSalesHourlyRow,
  type ItemSalesIncomeSortKey,
  type ItemSalesQuantitySortKey,
  type ItemSalesRow,
  type ItemSalesSortDir,
} from "./itemSalesTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function normalizeItemSalesRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): ItemSalesRow {
  if (!row) {
    return {
      catalogProductId: null,
      catalogVariantId: null,
      catalogBundleId: null,
      itemName: "Unlinked",
      variantName: null,
      sku: null,
      categoryId: null,
      categoryName: null,
      qtySold: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      cogs: 0,
      grossProfit: 0,
      marginPct: 0,
      cogsIncomplete: false,
      cogsEstimated: false,
    };
  }

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

  const itemName = String(row.item_name ?? "").trim() || "Unlinked";
  const variantRaw = row.variant_name;
  const variantName =
    variantRaw == null || String(variantRaw).trim() === ""
      ? null
      : String(variantRaw).trim();

  const skuRaw = row.sku;
  const sku =
    skuRaw == null || String(skuRaw).trim() === "" ? null : String(skuRaw).trim();

  const categoryNameRaw = row.category_name;
  const categoryName =
    categoryNameRaw == null || String(categoryNameRaw).trim() === ""
      ? null
      : String(categoryNameRaw).trim();

  return {
    catalogProductId: row.catalog_product_id ? String(row.catalog_product_id) : null,
    catalogVariantId: row.catalog_variant_id ? String(row.catalog_variant_id) : null,
    catalogBundleId: row.catalog_bundle_id ? String(row.catalog_bundle_id) : null,
    itemName,
    variantName,
    sku,
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName,
    qtySold: num(row, "qty_sold"),
    qtyRefunded: num(row, "qty_refunded"),
    grossSales: num(row, "gross_sales"),
    netSales,
    cogs,
    grossProfit,
    marginPct,
    cogsIncomplete: Boolean(row.cogs_incomplete),
    cogsEstimated: Boolean(row.cogs_estimated),
  };
}

export function normalizeItemSalesHourlyRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): ItemSalesHourlyRow {
  if (!row) {
    return {
      productKey: "",
      itemName: "Unlinked",
      variantName: null,
      sku: null,
      hour: 0,
      qty: 0,
      netSales: 0,
    };
  }

  const skuRaw = row.sku;
  const variantRaw = row.variant_name;

  return {
    productKey: String(row.product_key ?? ""),
    itemName: String(row.item_name ?? "Unlinked").trim() || "Unlinked",
    variantName:
      variantRaw == null || String(variantRaw).trim() === ""
        ? null
        : String(variantRaw).trim(),
    sku:
      skuRaw == null || String(skuRaw).trim() === "" ? null : String(skuRaw).trim(),
    hour: Math.max(0, Math.min(23, Math.floor(num(row, "hour")))),
    qty: num(row, "qty"),
    netSales: num(row, "net_sales"),
  };
}

export function buildItemSalesDisplay(
  rows: Array<Partial<Record<string, unknown>>> | null | undefined,
): ItemSalesDisplay {
  if (!rows?.length) return EMPTY_ITEM_SALES_DISPLAY;

  const normalized = rows.map((r) => normalizeItemSalesRow(r));
  const summaryProductNetSales = num(rows[0] ?? {}, "summary_product_net_sales");

  const totals = normalized.reduce(
    (acc, row) => ({
      qtySold: acc.qtySold + row.qtySold,
      qtyAlaCarte: acc.qtyAlaCarte + resolveQtyAlaCarte(row),
      qtyBundle: acc.qtyBundle + resolveQtyBundle(row),
      qtyRefunded: acc.qtyRefunded + row.qtyRefunded,
      grossSales: acc.grossSales + row.grossSales,
      netSales: acc.netSales + row.netSales,
      cogs: acc.cogs + row.cogs,
      grossProfit: acc.grossProfit + row.grossProfit,
    }),
    {
      qtySold: 0,
      qtyAlaCarte: 0,
      qtyBundle: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      cogs: 0,
      grossProfit: 0,
    },
  );

  const reconciliationOk =
    Math.abs(totals.netSales - summaryProductNetSales) <=
    ITEM_SALES_RECONCILIATION_EPSILON;

  return {
    rows: normalized,
    summaryProductNetSales,
    totals,
    reconciliationOk,
  };
}

export function buildItemSalesHourlyDisplay(
  rows: Array<Partial<Record<string, unknown>>> | null | undefined,
): ItemSalesHourlyDisplay {
  if (!rows?.length) return EMPTY_ITEM_SALES_HOURLY_DISPLAY;

  const normalized = rows.map((r) => normalizeItemSalesHourlyRow(r));
  const itemKeys = [...new Set(normalized.map((r) => r.productKey).filter(Boolean))];

  return {
    rows: normalized,
    itemKeys,
    hours: Array.from({ length: 24 }, (_, i) => i),
  };
}

export function formatItemDisplayName(row: Pick<ItemSalesRow, "itemName" | "variantName">): string {
  if (row.variantName) return `${row.itemName} - ${row.variantName}`;
  return row.itemName;
}

/** Bundle package line or legacy unlinked bundle row (no catalog product). */
export function isItemSalesBundleRow(row: ItemSalesRow): boolean {
  if (row.catalogBundleId) return true;
  return !row.catalogProductId && !row.catalogVariantId;
}

export function resolveQtyAlaCarte(row: ItemSalesRow): number {
  return isItemSalesBundleRow(row) ? 0 : row.qtySold;
}

export function resolveQtyBundle(row: ItemSalesRow): number {
  return isItemSalesBundleRow(row) ? row.qtySold : 0;
}

export function filterItemSalesBySearch(rows: ItemSalesRow[], query: string): ItemSalesRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const hay = `${row.itemName} ${row.variantName ?? ""} ${row.sku ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });
}

function compareStrings(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

export function sortItemSalesIncomeRows(
  rows: ItemSalesRow[],
  sortKey: ItemSalesIncomeSortKey,
  sortDir: ItemSalesSortDir,
): ItemSalesRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = compareStrings(formatItemDisplayName(a), formatItemDisplayName(b));
        break;
      case "sku":
        cmp = compareStrings(a.sku, b.sku);
        break;
      case "category":
        cmp = compareStrings(a.categoryName, b.categoryName);
        break;
      case "grossSales":
        cmp = a.grossSales - b.grossSales;
        break;
      case "netSales":
        cmp = a.netSales - b.netSales;
        break;
      case "cogs":
        cmp = a.cogs - b.cogs;
        break;
      case "grossProfit":
        cmp = a.grossProfit - b.grossProfit;
        break;
      case "marginPct":
        cmp = a.marginPct - b.marginPct;
        break;
      default:
        cmp = 0;
    }
    return cmp * dir;
  });
}

export function sortItemSalesQuantityRows(
  rows: ItemSalesRow[],
  sortKey: ItemSalesQuantitySortKey,
  sortDir: ItemSalesSortDir,
): ItemSalesRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = compareStrings(formatItemDisplayName(a), formatItemDisplayName(b));
        break;
      case "sku":
        cmp = compareStrings(a.sku, b.sku);
        break;
      case "category":
        cmp = compareStrings(a.categoryName, b.categoryName);
        break;
      case "qtyAlaCarte":
        cmp = resolveQtyAlaCarte(a) - resolveQtyAlaCarte(b);
        break;
      case "qtyBundle":
        cmp = resolveQtyBundle(a) - resolveQtyBundle(b);
        break;
      case "qtySold":
        cmp = a.qtySold - b.qtySold;
        break;
      default:
        cmp = 0;
    }
    return cmp * dir;
  });
}

export function itemSalesRowKey(row: ItemSalesRow): string {
  if (row.catalogBundleId) return `b:${row.catalogBundleId}`;
  return `${row.catalogProductId ?? "none"}:${row.catalogVariantId ?? "none"}:${row.itemName}`;
}

export function sumItemSalesRows(rows: ItemSalesRow[]): ItemSalesDisplay["totals"] {
  return rows.reduce(
    (acc, row) => ({
      qtySold: acc.qtySold + row.qtySold,
      qtyAlaCarte: acc.qtyAlaCarte + resolveQtyAlaCarte(row),
      qtyBundle: acc.qtyBundle + resolveQtyBundle(row),
      qtyRefunded: acc.qtyRefunded + row.qtyRefunded,
      grossSales: acc.grossSales + row.grossSales,
      netSales: acc.netSales + row.netSales,
      cogs: acc.cogs + row.cogs,
      grossProfit: acc.grossProfit + row.grossProfit,
    }),
    {
      qtySold: 0,
      qtyAlaCarte: 0,
      qtyBundle: 0,
      qtyRefunded: 0,
      grossSales: 0,
      netSales: 0,
      cogs: 0,
      grossProfit: 0,
    },
  );
}
