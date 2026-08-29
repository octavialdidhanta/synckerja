import {
  EMPTY_TAX_SALES_DISPLAY,
  type TaxSalesDisplay,
  type TaxSalesDisplayRow,
  type TaxSalesRateRow,
  type TaxSalesSortDir,
  type TaxSalesSortKey,
  type TaxSalesTaxRow,
} from "./taxSalesTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function bool(row: Partial<Record<string, unknown>>, key: string): boolean {
  return Boolean(row[key]);
}

function normalizeMetrics(row: Partial<Record<string, unknown>>) {
  const taxCollected =
    row.tax_collected != null && Number.isFinite(Number(row.tax_collected))
      ? num(row, "tax_collected")
      : num(row, "gross_tax");
  const taxableAmount = num(row, "taxable_amount");
  const refundAmount = num(row, "refund_amount");
  const netTax =
    row.net_tax != null && Number.isFinite(Number(row.net_tax))
      ? num(row, "net_tax")
      : taxCollected - refundAmount;
  const netTaxableAmount =
    row.net_taxable_amount != null && Number.isFinite(Number(row.net_taxable_amount))
      ? num(row, "net_taxable_amount")
      : taxableAmount - num(row, "refund_taxable_amount");

  return {
    taxableAmount,
    taxCollected,
    timesApplied: num(row, "times_applied"),
    refundAmount,
    netTax,
    netTaxableAmount,
  };
}

export function normalizeTaxSalesTaxRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownTaxLabel: string,
): TaxSalesTaxRow {
  if (!row) {
    return {
      catalogTaxId: null,
      taxName: unknownTaxLabel,
      sortOrder: 9999,
      taxableAmount: 0,
      taxCollected: 0,
      timesApplied: 0,
      refundAmount: 0,
      netTax: 0,
      netTaxableAmount: 0,
      hasBackfillEstimate: false,
    };
  }

  const catalogTaxId = row.catalog_tax_id != null ? String(row.catalog_tax_id) : null;
  const rawName = String(row.tax_name ?? "").trim();

  return {
    catalogTaxId,
    taxName: rawName || unknownTaxLabel,
    sortOrder: Math.round(num(row, "sort_order")) || 9999,
    hasBackfillEstimate: bool(row, "has_backfill_estimate"),
    ...normalizeMetrics(row),
  };
}

export function normalizeTaxSalesRateRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownTaxLabel: string,
): TaxSalesRateRow {
  if (!row) {
    return {
      catalogTaxId: null,
      taxName: unknownTaxLabel,
      taxSortOrder: 9999,
      rateLabel: "—",
      rateSortOrder: 9999,
      taxableAmount: 0,
      taxCollected: 0,
      timesApplied: 0,
      refundAmount: 0,
      netTax: 0,
      netTaxableAmount: 0,
      hasBackfillEstimate: false,
    };
  }

  const catalogTaxId = row.catalog_tax_id != null ? String(row.catalog_tax_id) : null;
  const rawName = String(row.tax_name ?? "").trim();

  return {
    catalogTaxId,
    taxName: rawName || unknownTaxLabel,
    taxSortOrder: Math.round(num(row, "tax_sort_order")) || 9999,
    rateLabel: String(row.rate_label ?? "—").trim() || "—",
    rateSortOrder: Math.round(num(row, "rate_sort_order")) || 9999,
    hasBackfillEstimate: bool(row, "has_backfill_estimate"),
    ...normalizeMetrics(row),
  };
}

export function taxRowKey(catalogTaxId: string | null, taxName: string): string {
  return `${catalogTaxId ?? "__unknown__"}::${taxName}`;
}

function sumTaxTotals(taxes: TaxSalesTaxRow[]) {
  return taxes.reduce(
    (acc, row) => ({
      taxableAmount: acc.taxableAmount + row.taxableAmount,
      taxCollected: acc.taxCollected + row.taxCollected,
      netTax: acc.netTax + row.netTax,
    }),
    {
      taxableAmount: 0,
      taxCollected: 0,
      netTax: 0,
    },
  );
}

export function buildTaxSalesDisplay(args: {
  taxRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  rateRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  unknownTaxLabel: string;
}): TaxSalesDisplay {
  if (!args.taxRowsRaw?.length && !args.rateRowsRaw?.length) {
    return EMPTY_TAX_SALES_DISPLAY;
  }

  const taxes = (args.taxRowsRaw ?? []).map((r) =>
    normalizeTaxSalesTaxRow(r, args.unknownTaxLabel),
  );
  const rates = (args.rateRowsRaw ?? []).map((r) =>
    normalizeTaxSalesRateRow(r, args.unknownTaxLabel),
  );

  const summaryTotalNetTax = num(
    args.taxRowsRaw?.[0] ?? args.rateRowsRaw?.[0] ?? {},
    "summary_total_net_tax",
  );
  const grandTotal = sumTaxTotals(taxes);
  const hasBackfillEstimate =
    taxes.some((t) => t.hasBackfillEstimate) || rates.some((r) => r.hasBackfillEstimate);

  const ratesByTax = new Map<string, TaxSalesRateRow[]>();
  for (const rate of rates) {
    const key = taxRowKey(rate.catalogTaxId, rate.taxName);
    const list = ratesByTax.get(key) ?? [];
    list.push(rate);
    ratesByTax.set(key, list);
  }

  const displayRows: TaxSalesDisplayRow[] = [];
  for (const tax of taxes) {
    displayRows.push({ rowKind: "tax", ...tax });
    const children = [...(ratesByTax.get(taxRowKey(tax.catalogTaxId, tax.taxName)) ?? [])].sort(
      (a, b) =>
        b.taxCollected - a.taxCollected ||
        a.rateSortOrder - b.rateSortOrder ||
        a.rateLabel.localeCompare(b.rateLabel),
    );
    for (const rate of children) {
      displayRows.push({ rowKind: "rate", ...rate });
    }
  }

  return {
    taxes,
    rates,
    displayRows,
    grandTotal,
    summaryTotalNetTax,
    hasBackfillEstimate,
  };
}

export function sortTaxSalesTaxes(
  taxes: TaxSalesTaxRow[],
  sortKey: TaxSalesSortKey,
  sortDir: TaxSalesSortDir,
): TaxSalesTaxRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...taxes].sort((a, b) => {
    if (sortKey === "taxName") {
      const cmp = a.taxName.localeCompare(b.taxName, undefined, { sensitivity: "base" });
      if (cmp !== 0) return dir * cmp;
      return a.sortOrder - b.sortOrder;
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) {
      return a.taxName.localeCompare(b.taxName, undefined, { sensitivity: "base" });
    }
    return dir * (av - bv);
  });
}

export function rebuildTaxDisplayRows(
  taxes: TaxSalesTaxRow[],
  rates: TaxSalesRateRow[],
): TaxSalesDisplayRow[] {
  const ratesByTax = new Map<string, TaxSalesRateRow[]>();
  for (const rate of rates) {
    const key = taxRowKey(rate.catalogTaxId, rate.taxName);
    const list = ratesByTax.get(key) ?? [];
    list.push(rate);
    ratesByTax.set(key, list);
  }

  const displayRows: TaxSalesDisplayRow[] = [];
  for (const tax of taxes) {
    displayRows.push({ rowKind: "tax", ...tax });
    const children = [...(ratesByTax.get(taxRowKey(tax.catalogTaxId, tax.taxName)) ?? [])].sort(
      (a, b) =>
        b.taxCollected - a.taxCollected ||
        a.rateSortOrder - b.rateSortOrder ||
        a.rateLabel.localeCompare(b.rateLabel),
    );
    for (const rate of children) {
      displayRows.push({ rowKind: "rate", ...rate });
    }
  }
  return displayRows;
}

export function sortTaxRatesForExport(rates: TaxSalesRateRow[]): TaxSalesRateRow[] {
  return [...rates].sort(
    (a, b) =>
      a.taxSortOrder - b.taxSortOrder ||
      a.taxName.localeCompare(b.taxName) ||
      b.taxCollected - a.taxCollected ||
      a.rateSortOrder - b.rateSortOrder ||
      a.rateLabel.localeCompare(b.rateLabel),
  );
}

export function rateCountByTax(rates: TaxSalesRateRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rate of rates) {
    const key = taxRowKey(rate.catalogTaxId, rate.taxName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function parentRateLabel(tax: TaxSalesTaxRow, rates: TaxSalesRateRow[]): string {
  const children = rates.filter(
    (r) => taxRowKey(r.catalogTaxId, r.taxName) === taxRowKey(tax.catalogTaxId, tax.taxName),
  );
  if (children.length === 1) return children[0].rateLabel;
  if (children.length === 0) return "—";
  return "—";
}
