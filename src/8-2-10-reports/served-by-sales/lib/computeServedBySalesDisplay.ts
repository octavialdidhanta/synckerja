import {
  EMPTY_SERVED_BY_SALES_DISPLAY,
  type ServedBySalesDisplay,
  type ServedBySalesSortDir,
  type ServedBySalesSortKey,
  type ServedBySalesTypeRow,
  type ServedByServerBlock,
} from "./servedBySalesTypes";

const EPSILON = 0.01;

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function serverKey(userId: string | null): string {
  return userId ?? "__unknown__";
}

function buildSalesTypeRows(
  typeRows: Array<Partial<Record<string, unknown>>>,
  serverUserId: string | null,
): ServedBySalesTypeRow[] {
  const key = serverKey(serverUserId);
  const rows: ServedBySalesTypeRow[] = [];

  for (const row of typeRows) {
    const rowUserId = row.server_user_id != null ? String(row.server_user_id) : null;
    if (serverKey(rowUserId) !== key) continue;
    rows.push({
      catalogSalesTypeId:
        row.catalog_sales_type_id != null ? String(row.catalog_sales_type_id) : null,
      salesTypeName: String(row.sales_type_name ?? "").trim() || "Unknown",
      transactionCount: Math.max(0, Math.round(num(row, "transaction_count"))),
      grossSales: num(row, "gross_sales"),
      netSales: num(row, "net_sales"),
    });
  }

  return rows.sort((a, b) => b.netSales - a.netSales || a.salesTypeName.localeCompare(b.salesTypeName));
}

export function buildServedBySalesDisplay(args: {
  serverRowsRaw: Array<Partial<Record<string, unknown>>>;
  salesTypeRowsRaw: Array<Partial<Record<string, unknown>>>;
  unknownServerLabel: string;
}): ServedBySalesDisplay {
  if (!args.serverRowsRaw?.length) {
    return EMPTY_SERVED_BY_SALES_DISPLAY;
  }

  const first = args.serverRowsRaw[0];
  const summaryGrossSales = num(first, "summary_gross_sales");
  const summaryNetSales = num(first, "summary_net_sales");
  const summaryTransactionCount = Math.max(
    0,
    Math.round(num(first, "summary_transaction_count")),
  );

  const servers: ServedByServerBlock[] = args.serverRowsRaw.map((row) => {
    const serverUserId = row.server_user_id != null ? String(row.server_user_id) : null;
    const rawName = String(row.server_name ?? "").trim();
    return {
      serverUserId,
      serverName: rawName || args.unknownServerLabel,
      employeeId: row.employee_id != null ? String(row.employee_id) : null,
      transactionCount: Math.max(0, Math.round(num(row, "transaction_count"))),
      grossSales: num(row, "gross_sales"),
      netSales: num(row, "net_sales"),
      salesTypes: buildSalesTypeRows(args.salesTypeRowsRaw ?? [], serverUserId),
    };
  });

  const grandTotal = servers.reduce(
    (acc, block) => ({
      transactionCount: acc.transactionCount + block.transactionCount,
      grossSales: acc.grossSales + block.grossSales,
      netSales: acc.netSales + block.netSales,
    }),
    { transactionCount: 0, grossSales: 0, netSales: 0 },
  );

  const matchesSummaryGross =
    Math.abs(grandTotal.grossSales - summaryGrossSales) <= EPSILON &&
    grandTotal.transactionCount === summaryTransactionCount;
  const matchesSummaryNet =
    Math.abs(grandTotal.netSales - summaryNetSales) <= EPSILON &&
    grandTotal.transactionCount === summaryTransactionCount;

  return {
    servers,
    grandTotal,
    summaryGrossSales,
    summaryNetSales,
    summaryTransactionCount,
    matchesSummaryGross,
    matchesSummaryNet,
  };
}

export function sortServedByServers(
  servers: ServedByServerBlock[],
  sortKey: ServedBySalesSortKey,
  sortDir: ServedBySalesSortDir,
): ServedByServerBlock[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...servers].sort((a, b) => {
    if (sortKey === "serverName") {
      return a.serverName.localeCompare(b.serverName) * dir;
    }
    if (sortKey === "transactionCount") {
      return (a.transactionCount - b.transactionCount) * dir;
    }
    if (sortKey === "grossSales") {
      return (a.grossSales - b.grossSales) * dir;
    }
    return (a.netSales - b.netSales) * dir;
  });
}

export function defaultExpandedServerKey(display: ServedBySalesDisplay): string | null {
  const withData = display.servers.find(
    (row) => row.transactionCount > 0 || row.netSales > 0.01,
  );
  return withData ? serverKey(withData.serverUserId) : null;
}

export function flattenServedByForExport(
  display: ServedBySalesDisplay,
): Array<{
  serverName: string;
  salesTypeLabel: string;
  transactionCount: number;
  grossSales: number;
  netSales: number;
}> {
  const rows: Array<{
    serverName: string;
    salesTypeLabel: string;
    transactionCount: number;
    grossSales: number;
    netSales: number;
  }> = [];

  for (const block of display.servers) {
    rows.push({
      serverName: block.serverName,
      salesTypeLabel: "",
      transactionCount: block.transactionCount,
      grossSales: block.grossSales,
      netSales: block.netSales,
    });
    for (const typeRow of block.salesTypes) {
      if (typeRow.transactionCount === 0 && typeRow.netSales <= EPSILON) continue;
      rows.push({
        serverName: block.serverName,
        salesTypeLabel: typeRow.salesTypeName,
        transactionCount: typeRow.transactionCount,
        grossSales: typeRow.grossSales,
        netSales: typeRow.netSales,
      });
    }
  }

  return rows;
}
