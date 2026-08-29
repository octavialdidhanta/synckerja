import {
  EMPTY_GRATUITY_SALES_DISPLAY,
  type GratuitySalesDisplay,
  type GratuitySalesDisplayRow,
  type GratuitySalesGratuityRow,
  type GratuitySalesRateRow,
  type GratuitySalesSortDir,
  type GratuitySalesSortKey,
} from "./gratuitySalesTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function bool(row: Partial<Record<string, unknown>>, key: string): boolean {
  return Boolean(row[key]);
}

function normalizeMetrics(row: Partial<Record<string, unknown>>) {
  const gratuityCollected =
    row.gratuity_collected != null && Number.isFinite(Number(row.gratuity_collected))
      ? num(row, "gratuity_collected")
      : num(row, "gross_gratuity");
  const refundAmount = num(row, "refund_amount");
  const netGratuity =
    row.net_gratuity != null && Number.isFinite(Number(row.net_gratuity))
      ? num(row, "net_gratuity")
      : gratuityCollected - refundAmount;

  return {
    gratuityCollected,
    timesApplied: num(row, "times_applied"),
    refundAmount,
    netGratuity,
  };
}

export function normalizeGratuitySalesGratuityRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownGratuityLabel: string,
): GratuitySalesGratuityRow {
  if (!row) {
    return {
      catalogGratuityId: null,
      gratuityName: unknownGratuityLabel,
      sortOrder: 9999,
      gratuityCollected: 0,
      timesApplied: 0,
      refundAmount: 0,
      netGratuity: 0,
      hasBackfillEstimate: false,
    };
  }

  const catalogGratuityId =
    row.catalog_gratuity_id != null ? String(row.catalog_gratuity_id) : null;
  const rawName = String(row.gratuity_name ?? "").trim();

  return {
    catalogGratuityId,
    gratuityName: rawName || unknownGratuityLabel,
    sortOrder: Math.round(num(row, "sort_order")) || 9999,
    hasBackfillEstimate: bool(row, "has_backfill_estimate"),
    ...normalizeMetrics(row),
  };
}

export function normalizeGratuitySalesRateRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownGratuityLabel: string,
): GratuitySalesRateRow {
  if (!row) {
    return {
      catalogGratuityId: null,
      gratuityName: unknownGratuityLabel,
      gratuitySortOrder: 9999,
      rateLabel: "—",
      rateSortOrder: 9999,
      gratuityCollected: 0,
      timesApplied: 0,
      refundAmount: 0,
      netGratuity: 0,
      hasBackfillEstimate: false,
    };
  }

  const catalogGratuityId =
    row.catalog_gratuity_id != null ? String(row.catalog_gratuity_id) : null;
  const rawName = String(row.gratuity_name ?? "").trim();

  return {
    catalogGratuityId,
    gratuityName: rawName || unknownGratuityLabel,
    gratuitySortOrder: Math.round(num(row, "gratuity_sort_order")) || 9999,
    rateLabel: String(row.rate_label ?? "—").trim() || "—",
    rateSortOrder: Math.round(num(row, "rate_sort_order")) || 9999,
    hasBackfillEstimate: bool(row, "has_backfill_estimate"),
    ...normalizeMetrics(row),
  };
}

export function gratuityRowKey(catalogGratuityId: string | null, gratuityName: string): string {
  return `${catalogGratuityId ?? "__unknown__"}::${gratuityName}`;
}

function sumGratuityTotals(gratuities: GratuitySalesGratuityRow[]) {
  return gratuities.reduce(
    (acc, row) => ({
      gratuityCollected: acc.gratuityCollected + row.gratuityCollected,
      netGratuity: acc.netGratuity + row.netGratuity,
    }),
    {
      gratuityCollected: 0,
      netGratuity: 0,
    },
  );
}

export function buildGratuitySalesDisplay(args: {
  gratuityRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  rateRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  unknownGratuityLabel: string;
}): GratuitySalesDisplay {
  if (!args.gratuityRowsRaw?.length && !args.rateRowsRaw?.length) {
    return EMPTY_GRATUITY_SALES_DISPLAY;
  }

  const gratuities = (args.gratuityRowsRaw ?? []).map((r) =>
    normalizeGratuitySalesGratuityRow(r, args.unknownGratuityLabel),
  );
  const rates = (args.rateRowsRaw ?? []).map((r) =>
    normalizeGratuitySalesRateRow(r, args.unknownGratuityLabel),
  );

  const summaryTotalNetGratuity = num(
    args.gratuityRowsRaw?.[0] ?? args.rateRowsRaw?.[0] ?? {},
    "summary_total_net_gratuity",
  );
  const grandTotal = sumGratuityTotals(gratuities);
  const hasBackfillEstimate =
    gratuities.some((g) => g.hasBackfillEstimate) || rates.some((r) => r.hasBackfillEstimate);

  const ratesByGratuity = new Map<string, GratuitySalesRateRow[]>();
  for (const rate of rates) {
    const key = gratuityRowKey(rate.catalogGratuityId, rate.gratuityName);
    const list = ratesByGratuity.get(key) ?? [];
    list.push(rate);
    ratesByGratuity.set(key, list);
  }

  const displayRows: GratuitySalesDisplayRow[] = [];
  for (const gratuity of gratuities) {
    displayRows.push({ rowKind: "gratuity", ...gratuity });
    const children = [
      ...(ratesByGratuity.get(gratuityRowKey(gratuity.catalogGratuityId, gratuity.gratuityName)) ??
        []),
    ].sort(
      (a, b) =>
        b.gratuityCollected - a.gratuityCollected ||
        a.rateSortOrder - b.rateSortOrder ||
        a.rateLabel.localeCompare(b.rateLabel),
    );
    for (const rate of children) {
      displayRows.push({ rowKind: "rate", ...rate });
    }
  }

  return {
    gratuities,
    rates,
    displayRows,
    grandTotal,
    summaryTotalNetGratuity,
    hasBackfillEstimate,
  };
}

export function sortGratuitySalesGratuities(
  gratuities: GratuitySalesGratuityRow[],
  sortKey: GratuitySalesSortKey,
  sortDir: GratuitySalesSortDir,
): GratuitySalesGratuityRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...gratuities].sort((a, b) => {
    if (sortKey === "gratuityName") {
      const cmp = a.gratuityName.localeCompare(b.gratuityName, undefined, { sensitivity: "base" });
      if (cmp !== 0) return dir * cmp;
      return a.sortOrder - b.sortOrder;
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) {
      return a.gratuityName.localeCompare(b.gratuityName, undefined, { sensitivity: "base" });
    }
    return dir * (av - bv);
  });
}

export function rebuildGratuityDisplayRows(
  gratuities: GratuitySalesGratuityRow[],
  rates: GratuitySalesRateRow[],
): GratuitySalesDisplayRow[] {
  const ratesByGratuity = new Map<string, GratuitySalesRateRow[]>();
  for (const rate of rates) {
    const key = gratuityRowKey(rate.catalogGratuityId, rate.gratuityName);
    const list = ratesByGratuity.get(key) ?? [];
    list.push(rate);
    ratesByGratuity.set(key, list);
  }

  const displayRows: GratuitySalesDisplayRow[] = [];
  for (const gratuity of gratuities) {
    displayRows.push({ rowKind: "gratuity", ...gratuity });
    const children = [
      ...(ratesByGratuity.get(gratuityRowKey(gratuity.catalogGratuityId, gratuity.gratuityName)) ??
        []),
    ].sort(
      (a, b) =>
        b.gratuityCollected - a.gratuityCollected ||
        a.rateSortOrder - b.rateSortOrder ||
        a.rateLabel.localeCompare(b.rateLabel),
    );
    for (const rate of children) {
      displayRows.push({ rowKind: "rate", ...rate });
    }
  }
  return displayRows;
}

export function sortGratuityRatesForExport(rates: GratuitySalesRateRow[]): GratuitySalesRateRow[] {
  return [...rates].sort(
    (a, b) =>
      a.gratuitySortOrder - b.gratuitySortOrder ||
      a.gratuityName.localeCompare(b.gratuityName) ||
      b.gratuityCollected - a.gratuityCollected ||
      a.rateSortOrder - b.rateSortOrder ||
      a.rateLabel.localeCompare(b.rateLabel),
  );
}

export function rateCountByGratuity(rates: GratuitySalesRateRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rate of rates) {
    const key = gratuityRowKey(rate.catalogGratuityId, rate.gratuityName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function parentRateLabel(
  gratuity: GratuitySalesGratuityRow,
  rates: GratuitySalesRateRow[],
): string {
  const children = rates.filter(
    (r) =>
      gratuityRowKey(r.catalogGratuityId, r.gratuityName) ===
      gratuityRowKey(gratuity.catalogGratuityId, gratuity.gratuityName),
  );
  if (children.length === 1) return children[0].rateLabel;
  if (children.length === 0) return "—";
  return "—";
}
