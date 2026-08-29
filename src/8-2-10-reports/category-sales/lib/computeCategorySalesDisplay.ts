import {
  CATEGORY_SALES_RECONCILIATION_EPSILON,
  EMPTY_CATEGORY_SALES_DISPLAY,
  type CategorySalesDisplay,
  type CategorySalesRow,
  type CategorySalesSortDir,
  type CategorySalesSortKey,
} from "./categorySalesTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function normalizeCategorySalesRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  uncategorizedLabel: string,
): CategorySalesRow {
  if (!row) {
    return {
      categoryId: null,
      categoryName: uncategorizedLabel,
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

  const categoryId = row.category_id != null ? String(row.category_id) : null;
  const rawName = String(row.category_name ?? "").trim();
  const categoryName = rawName || uncategorizedLabel;

  return {
    categoryId,
    categoryName,
    sortOrder: Math.round(num(row, "sort_order")) || 9999,
    qtySold: num(row, "qty_sold"),
    qtyRefunded: num(row, "qty_refunded"),
    grossSales: num(row, "gross_sales"),
    netSales,
    discountAmount: num(row, "discount_amount"),
    refundAmount: num(row, "refund_amount"),
    cogs,
    grossProfit,
    marginPct,
    cogsIncomplete: Boolean(row.cogs_incomplete),
    cogsEstimated: Boolean(row.cogs_estimated),
  };
}

export function buildCategorySalesDisplay(
  rows: Array<Partial<Record<string, unknown>>> | null | undefined,
  uncategorizedLabel: string,
): CategorySalesDisplay {
  if (!rows?.length) return EMPTY_CATEGORY_SALES_DISPLAY;

  const normalized = rows.map((r) => normalizeCategorySalesRow(r, uncategorizedLabel));
  const summaryProductNetSales = num(rows[0] ?? {}, "summary_product_net_sales");

  const grandTotal = normalized.reduce(
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

  const reconciliationOk =
    Math.abs(grandTotal.netSales - summaryProductNetSales) <=
    CATEGORY_SALES_RECONCILIATION_EPSILON;

  const hasCogsIncomplete = normalized.some((row) => row.cogsIncomplete);

  return {
    rows: normalized,
    grandTotal,
    summaryProductNetSales,
    reconciliationOk,
    hasCogsIncomplete,
  };
}

export function sortCategorySalesRows(
  rows: CategorySalesRow[],
  sortKey: CategorySalesSortKey,
  sortDir: CategorySalesSortDir,
): CategorySalesRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === "categoryName") {
      const cmp = a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: "base" });
      if (cmp !== 0) return dir * cmp;
      return a.sortOrder - b.sortOrder;
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) {
      return a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: "base" });
    }
    return dir * (av - bv);
  });
}
