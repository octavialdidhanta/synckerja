import {
  EMPTY_DISCOUNT_SALES_DISPLAY,
  type DiscountSalesDisplay,
  type DiscountSalesDisplayRow,
  type DiscountSalesDiscountRow,
  type DiscountSalesSortDir,
  type DiscountSalesSortKey,
  type DiscountSalesValueRow,
} from "./discountSalesTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function normalizeMetrics(row: Partial<Record<string, unknown>>) {
  const grossDiscount = num(row, "gross_discount");
  const refundAmount = num(row, "refund_amount");
  const netDiscount =
    row.net_discount != null && Number.isFinite(Number(row.net_discount))
      ? num(row, "net_discount")
      : grossDiscount - refundAmount;

  return {
    timesApplied: num(row, "times_applied"),
    grossDiscount,
    refundAmount,
    netDiscount,
  };
}

export function normalizeDiscountSalesDiscountRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownDiscountLabel: string,
): DiscountSalesDiscountRow {
  if (!row) {
    return {
      catalogDiscountId: null,
      discountName: unknownDiscountLabel,
      sortOrder: 9999,
      timesApplied: 0,
      grossDiscount: 0,
      refundAmount: 0,
      netDiscount: 0,
    };
  }

  const catalogDiscountId = row.catalog_discount_id != null ? String(row.catalog_discount_id) : null;
  const rawName = String(row.discount_name ?? "").trim();

  return {
    catalogDiscountId,
    discountName: rawName || unknownDiscountLabel,
    sortOrder: Math.round(num(row, "sort_order")) || 9999,
    ...normalizeMetrics(row),
  };
}

export function normalizeDiscountSalesValueRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownDiscountLabel: string,
): DiscountSalesValueRow {
  if (!row) {
    return {
      catalogDiscountId: null,
      discountName: unknownDiscountLabel,
      discountSortOrder: 9999,
      valueLabel: "—",
      valueSortOrder: 9999,
      timesApplied: 0,
      grossDiscount: 0,
      refundAmount: 0,
      netDiscount: 0,
    };
  }

  const catalogDiscountId = row.catalog_discount_id != null ? String(row.catalog_discount_id) : null;
  const rawName = String(row.discount_name ?? "").trim();

  return {
    catalogDiscountId,
    discountName: rawName || unknownDiscountLabel,
    discountSortOrder: Math.round(num(row, "discount_sort_order")) || 9999,
    valueLabel: String(row.value_label ?? "—").trim() || "—",
    valueSortOrder: Math.round(num(row, "value_sort_order")) || 9999,
    ...normalizeMetrics(row),
  };
}

export function discountRowKey(catalogDiscountId: string | null, discountName: string): string {
  return `${catalogDiscountId ?? "__unknown__"}::${discountName}`;
}

function sumDiscountTotals(discounts: DiscountSalesDiscountRow[]) {
  return discounts.reduce(
    (acc, row) => ({
      timesApplied: acc.timesApplied + row.timesApplied,
      grossDiscount: acc.grossDiscount + row.grossDiscount,
      refundAmount: acc.refundAmount + row.refundAmount,
      netDiscount: acc.netDiscount + row.netDiscount,
    }),
    {
      timesApplied: 0,
      grossDiscount: 0,
      refundAmount: 0,
      netDiscount: 0,
    },
  );
}

export function buildDiscountSalesDisplay(args: {
  discountRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  valueRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  unknownDiscountLabel: string;
}): DiscountSalesDisplay {
  if (!args.discountRowsRaw?.length && !args.valueRowsRaw?.length) {
    return EMPTY_DISCOUNT_SALES_DISPLAY;
  }

  const discounts = (args.discountRowsRaw ?? []).map((r) =>
    normalizeDiscountSalesDiscountRow(r, args.unknownDiscountLabel),
  );
  const values = (args.valueRowsRaw ?? []).map((r) =>
    normalizeDiscountSalesValueRow(r, args.unknownDiscountLabel),
  );

  const summaryTotalNetDiscount = num(
    args.discountRowsRaw?.[0] ?? args.valueRowsRaw?.[0] ?? {},
    "summary_total_net_discount",
  );
  const grandTotal = sumDiscountTotals(discounts);

  const valuesByDiscount = new Map<string, DiscountSalesValueRow[]>();
  for (const value of values) {
    const key = discountRowKey(value.catalogDiscountId, value.discountName);
    const list = valuesByDiscount.get(key) ?? [];
    list.push(value);
    valuesByDiscount.set(key, list);
  }

  const displayRows: DiscountSalesDisplayRow[] = [];
  for (const discount of discounts) {
    displayRows.push({ rowKind: "discount", ...discount });
    const children = [...(valuesByDiscount.get(discountRowKey(discount.catalogDiscountId, discount.discountName)) ?? [])].sort(
      (a, b) =>
        b.netDiscount - a.netDiscount ||
        a.valueSortOrder - b.valueSortOrder ||
        a.valueLabel.localeCompare(b.valueLabel),
    );
    for (const value of children) {
      displayRows.push({ rowKind: "value", ...value });
    }
  }

  return {
    discounts,
    values,
    displayRows,
    grandTotal,
    summaryTotalNetDiscount,
  };
}

export function sortDiscountSalesDiscounts(
  discounts: DiscountSalesDiscountRow[],
  sortKey: DiscountSalesSortKey,
  sortDir: DiscountSalesSortDir,
): DiscountSalesDiscountRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...discounts].sort((a, b) => {
    if (sortKey === "discountName") {
      const cmp = a.discountName.localeCompare(b.discountName, undefined, { sensitivity: "base" });
      if (cmp !== 0) return dir * cmp;
      return a.sortOrder - b.sortOrder;
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) {
      return a.discountName.localeCompare(b.discountName, undefined, { sensitivity: "base" });
    }
    return dir * (av - bv);
  });
}

export function rebuildDiscountDisplayRows(
  discounts: DiscountSalesDiscountRow[],
  values: DiscountSalesValueRow[],
): DiscountSalesDisplayRow[] {
  const valuesByDiscount = new Map<string, DiscountSalesValueRow[]>();
  for (const value of values) {
    const key = discountRowKey(value.catalogDiscountId, value.discountName);
    const list = valuesByDiscount.get(key) ?? [];
    list.push(value);
    valuesByDiscount.set(key, list);
  }

  const displayRows: DiscountSalesDisplayRow[] = [];
  for (const discount of discounts) {
    displayRows.push({ rowKind: "discount", ...discount });
    const children = [...(valuesByDiscount.get(discountRowKey(discount.catalogDiscountId, discount.discountName)) ?? [])].sort(
      (a, b) =>
        b.netDiscount - a.netDiscount ||
        a.valueSortOrder - b.valueSortOrder ||
        a.valueLabel.localeCompare(b.valueLabel),
    );
    for (const value of children) {
      displayRows.push({ rowKind: "value", ...value });
    }
  }
  return displayRows;
}

export function sortDiscountValuesForExport(
  values: DiscountSalesValueRow[],
): DiscountSalesValueRow[] {
  return [...values].sort(
    (a, b) =>
      a.discountSortOrder - b.discountSortOrder ||
      a.discountName.localeCompare(b.discountName) ||
      b.netDiscount - a.netDiscount ||
      a.valueSortOrder - b.valueSortOrder ||
      a.valueLabel.localeCompare(b.valueLabel),
  );
}

export function valueCountByDiscount(values: DiscountSalesValueRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = discountRowKey(value.catalogDiscountId, value.discountName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function parentValueLabel(
  discount: DiscountSalesDiscountRow,
  values: DiscountSalesValueRow[],
): string {
  const children = values.filter(
    (v) =>
      discountRowKey(v.catalogDiscountId, v.discountName) ===
      discountRowKey(discount.catalogDiscountId, discount.discountName),
  );
  if (children.length === 1) return children[0].valueLabel;
  if (children.length === 0) return "—";
  return "—";
}
