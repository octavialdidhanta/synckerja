import type { GrossProfitNonProductLineKind, GrossProfitNonProductRow } from "./grossProfitNonProductTypes";

export function normalizeGrossProfitNonProductRows(
  rows: Array<Partial<Record<string, unknown>>>,
): GrossProfitNonProductRow[] {
  return rows.map((row) => {
    const kindRaw = String(row.line_kind ?? "custom");
    const lineKind: GrossProfitNonProductLineKind =
      kindRaw === "service" ? "service" : "custom";
    return {
      serviceId: row.service_id != null ? String(row.service_id) : null,
      lineName: String(row.line_name ?? "Custom amount"),
      subName: row.sub_name != null && String(row.sub_name).trim()
        ? String(row.sub_name)
        : null,
      lineKind,
      qty: Number(row.qty ?? 0),
      netSales: Number(row.net_sales ?? 0),
    };
  });
}

export function sumNonProductBreakdownNet(rows: GrossProfitNonProductRow[]): number {
  return rows.reduce((acc, row) => acc + row.netSales, 0);
}

export function sumNonProductBreakdownQty(rows: GrossProfitNonProductRow[]): number {
  return rows.reduce((acc, row) => acc + row.qty, 0);
}
