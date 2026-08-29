import {
  EMPTY_SALES_TYPE_DISPLAY,
  UNASSIGNED_SALES_TYPE_KEY,
  type SalesTypeConfig,
  type SalesTypeDisplay,
  type SalesTypeRow,
  type SalesTypeSortDir,
  type SalesTypeSortKey,
} from "./salesTypeTypes";

const EPSILON = 0.01;

export function normalizeSalesTypeConfig(row: {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  outlet_ids: string[];
}): SalesTypeConfig {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    outletIds: row.outlet_ids,
  };
}

export function filterSalesTypesForOutlet(
  configs: SalesTypeConfig[],
  outletId: string | null,
): SalesTypeConfig[] {
  if (!outletId) return configs;
  return configs.filter((c) => c.outletIds.includes(outletId));
}

function rowKey(salesTypeId: string | null): string {
  return salesTypeId ?? UNASSIGNED_SALES_TYPE_KEY;
}

export function normalizeSalesTypeReportRows(rows: Array<Partial<Record<string, unknown>>>) {
  if (rows.length === 0) {
    return {
      reportRows: [] as SalesTypeRow[],
      summaryGrossSales: 0,
      summaryNetSales: 0,
      summaryTransactionCount: 0,
      summaryTotalCollected: 0,
    };
  }
  const first = rows[0];
  const summaryGrossSales = Number(first.summary_gross_sales ?? 0);
  const summaryNetSales = Number(first.summary_net_sales ?? 0);
  const summaryTransactionCount = Math.max(
    0,
    Math.round(Number(first.summary_transaction_count ?? 0)),
  );
  const summaryTotalCollected = Number(first.summary_total_collected ?? 0);

  const reportRows: SalesTypeRow[] = rows.map((row) => {
    const salesTypeId = row.sales_type_id != null ? String(row.sales_type_id) : null;
    const isUnassigned = salesTypeId == null;
    return {
      salesTypeId,
      salesTypeName: String(row.sales_type_name ?? "Unassigned"),
      sortOrder: Number(row.sort_order ?? 9999),
      transactionCount: Math.max(0, Math.round(Number(row.transaction_count ?? 0))),
      grossSales: Number(row.gross_sales ?? 0),
      netSales: Number(row.net_sales ?? 0),
      totalCollected: Number(row.total_collected ?? 0),
      isUnassigned,
    };
  });

  return {
    reportRows,
    summaryGrossSales,
    summaryNetSales,
    summaryTransactionCount,
    summaryTotalCollected,
  };
}

export function buildSalesTypeDisplay(args: {
  configs: SalesTypeConfig[];
  reportRows: SalesTypeRow[];
  summaryGrossSales: number;
  summaryNetSales: number;
  summaryTransactionCount: number;
  summaryTotalCollected: number;
  unassignedLabel: string;
}): SalesTypeDisplay {
  const reportByKey = new Map<string, SalesTypeRow>();
  for (const row of args.reportRows) {
    reportByKey.set(rowKey(row.salesTypeId), row);
  }

  const result: SalesTypeRow[] = [];
  const seen = new Set<string>();

  for (const config of args.configs.filter((c) => c.isActive)) {
    const key = config.id;
    seen.add(key);
    const fromReport = reportByKey.get(key);
    result.push(
      fromReport ?? {
        salesTypeId: config.id,
        salesTypeName: config.name,
        sortOrder: config.sortOrder,
        transactionCount: 0,
        grossSales: 0,
        netSales: 0,
        totalCollected: 0,
        isUnassigned: false,
      },
    );
  }

  for (const row of args.reportRows) {
    const key = rowKey(row.salesTypeId);
    if (seen.has(key)) continue;
    seen.add(key);
    const config = args.configs.find((c) => c.id === row.salesTypeId);
    if (config && !config.isActive && row.transactionCount === 0 && row.netSales <= EPSILON) {
      continue;
    }
    result.push({
      ...row,
      salesTypeName: row.isUnassigned ? args.unassignedLabel : row.salesTypeName,
    });
  }

  const unassigned = reportByKey.get(UNASSIGNED_SALES_TYPE_KEY);
  if (unassigned && !seen.has(UNASSIGNED_SALES_TYPE_KEY)) {
    result.push({
      ...unassigned,
      salesTypeName: args.unassignedLabel,
    });
  }

  const grandTotal = result.reduce(
    (acc, row) => ({
      transactionCount: acc.transactionCount + row.transactionCount,
      grossSales: acc.grossSales + row.grossSales,
      netSales: acc.netSales + row.netSales,
      totalCollected: acc.totalCollected + row.totalCollected,
    }),
    { transactionCount: 0, grossSales: 0, netSales: 0, totalCollected: 0 },
  );

  const matchesSummary =
    Math.abs(grandTotal.netSales - args.summaryNetSales) <= EPSILON &&
    grandTotal.transactionCount === args.summaryTransactionCount;

  return {
    rows: result.sort((a, b) => a.sortOrder - b.sortOrder || a.salesTypeName.localeCompare(b.salesTypeName)),
    grandTotal,
    summaryGrossSales: args.summaryGrossSales,
    summaryNetSales: args.summaryNetSales,
    summaryTransactionCount: args.summaryTransactionCount,
    summaryTotalCollected: args.summaryTotalCollected,
    matchesSummary,
  };
}

export function mergeSalesTypeReport(
  configs: SalesTypeConfig[],
  reportRowsRaw: Array<Partial<Record<string, unknown>>>,
  unassignedLabel: string,
): SalesTypeDisplay {
  const parsed = normalizeSalesTypeReportRows(reportRowsRaw);
  if (configs.length === 0 && parsed.reportRows.length === 0) {
    return {
      ...EMPTY_SALES_TYPE_DISPLAY,
      summaryGrossSales: parsed.summaryGrossSales,
      summaryNetSales: parsed.summaryNetSales,
      summaryTransactionCount: parsed.summaryTransactionCount,
      summaryTotalCollected: parsed.summaryTotalCollected,
    };
  }
  return buildSalesTypeDisplay({
    configs,
    reportRows: parsed.reportRows,
    summaryGrossSales: parsed.summaryGrossSales,
    summaryNetSales: parsed.summaryNetSales,
    summaryTransactionCount: parsed.summaryTransactionCount,
    summaryTotalCollected: parsed.summaryTotalCollected,
    unassignedLabel,
  });
}

export function sortSalesTypeRows(
  rows: SalesTypeRow[],
  sortKey: SalesTypeSortKey,
  sortDir: SalesTypeSortDir,
): SalesTypeRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === "name") {
      return dir * a.salesTypeName.localeCompare(b.salesTypeName);
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return a.salesTypeName.localeCompare(b.salesTypeName);
    return dir * (av - bv);
  });
}
