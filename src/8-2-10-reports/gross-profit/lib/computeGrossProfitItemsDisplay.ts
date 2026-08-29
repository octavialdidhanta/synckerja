import type { GrossProfitItemRow } from "./grossProfitItemTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function normalizeGrossProfitItemRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): GrossProfitItemRow {
  if (!row) {
    return {
      catalogProductId: null,
      catalogVariantId: null,
      productName: "Unlinked",
      variantName: null,
      categoryId: null,
      categoryName: null,
      qty: 0,
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

  const productName = String(row.product_name ?? "").trim() || "Unlinked";
  const variantRaw = row.variant_name;
  const variantName =
    variantRaw == null || String(variantRaw).trim() === ""
      ? null
      : String(variantRaw).trim();

  const categoryNameRaw = row.category_name;
  const categoryName =
    categoryNameRaw == null || String(categoryNameRaw).trim() === ""
      ? null
      : String(categoryNameRaw).trim();

  return {
    catalogProductId: row.catalog_product_id
      ? String(row.catalog_product_id)
      : null,
    catalogVariantId: row.catalog_variant_id
      ? String(row.catalog_variant_id)
      : null,
    productName,
    variantName,
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName,
    qty: num(row, "qty"),
    netSales,
    cogs,
    grossProfit,
    marginPct,
    cogsIncomplete: Boolean(row.cogs_incomplete),
    cogsEstimated: Boolean(row.cogs_estimated),
  };
}

export function normalizeGrossProfitItemRows(
  rows: Array<Partial<Record<string, unknown>>> | null | undefined,
): GrossProfitItemRow[] {
  if (!rows?.length) return [];
  return rows.map((r) => normalizeGrossProfitItemRow(r));
}

export function filterGrossProfitItemsBySearch(
  rows: GrossProfitItemRow[],
  query: string,
): GrossProfitItemRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const hay = `${row.productName} ${row.variantName ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });
}
