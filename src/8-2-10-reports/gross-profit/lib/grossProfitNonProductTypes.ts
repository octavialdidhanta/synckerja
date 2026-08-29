export type GrossProfitNonProductLineKind = "service" | "custom";

export type GrossProfitNonProductRow = {
  serviceId: string | null;
  lineName: string;
  subName: string | null;
  lineKind: GrossProfitNonProductLineKind;
  qty: number;
  netSales: number;
};

export function nonProductRowKey(row: Pick<GrossProfitNonProductRow, "serviceId" | "lineName" | "subName" | "lineKind">): string {
  return `${row.lineKind}:${row.serviceId ?? "none"}:${row.lineName}:${row.subName ?? ""}`;
}
