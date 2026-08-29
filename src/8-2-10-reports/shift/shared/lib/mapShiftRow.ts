import type { ShiftDetail, ShiftListSummary, ShiftRow } from "./shiftTypes";

function num(raw: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(raw?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function nullableNum(
  raw: Partial<Record<string, unknown>> | undefined,
  key: string,
): number | null {
  if (raw?.[key] == null) return null;
  const v = Number(raw[key]);
  return Number.isFinite(v) ? v : null;
}

export function mapShiftRow(raw: Partial<Record<string, unknown>>): ShiftRow {
  return {
    shiftId: String(raw.shift_id ?? ""),
    outletId: String(raw.outlet_id ?? ""),
    outletName: String(raw.outlet_name ?? "—"),
    openedAt: String(raw.opened_at ?? ""),
    closedAt: raw.closed_at != null ? String(raw.closed_at) : null,
    status: raw.status === "open" ? "open" : "closed",
    openedByUserId: raw.opened_by_user_id != null ? String(raw.opened_by_user_id) : null,
    openedByName: String(raw.opened_by_name ?? "—"),
    openingCash: num(raw, "opening_cash"),
    expectedCash: num(raw, "expected_cash"),
    closingCash: nullableNum(raw, "closing_cash"),
    cashDifference: nullableNum(raw, "cash_difference"),
  };
}

export function mapShiftSummary(
  first: Partial<Record<string, unknown>> | undefined,
): ShiftListSummary {
  return {
    shiftCount: Number(first?.summary_shift_count ?? 0),
    openCount: Number(first?.summary_open_count ?? 0),
    totalShortage: num(first, "summary_total_shortage"),
  };
}

function parseSoldLines(raw: unknown): ShiftDetail["soldLines"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line) => {
    const row = line as Record<string, unknown>;
    return {
      serviceName: row.service_name != null ? String(row.service_name) : null,
      subServiceName: row.sub_service_name != null ? String(row.sub_service_name) : null,
      quantity: Number(row.quantity ?? 0),
    };
  });
}

function parseCashMovements(raw: unknown): ShiftDetail["cashMovements"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const row = m as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      direction: row.direction === "out" ? "out" : "in",
      amount: Number(row.amount ?? 0),
      description: String(row.description ?? ""),
      createdAt: String(row.created_at ?? ""),
    };
  });
}

function parsePaymentMethods(raw: unknown): ShiftDetail["paymentMethods"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((pm) => {
    const row = pm as Record<string, unknown>;
    return {
      paymentMethod: String(row.payment_method ?? "unknown"),
      totalCollected: Number(row.total_collected ?? 0),
    };
  });
}

export function mapShiftDetail(raw: Record<string, unknown> | null): ShiftDetail | null {
  if (!raw) return null;
  return {
    shiftId: String(raw.shift_id ?? ""),
    outletId: String(raw.outlet_id ?? ""),
    outletName: String(raw.outlet_name ?? "—"),
    openedAt: String(raw.opened_at ?? ""),
    closedAt: raw.closed_at != null ? String(raw.closed_at) : null,
    status: raw.status === "open" ? "open" : "closed",
    openedByUserId: raw.opened_by_user_id != null ? String(raw.opened_by_user_id) : null,
    openedByName: String(raw.opened_by_name ?? "—"),
    closedByUserId: raw.closed_by_user_id != null ? String(raw.closed_by_user_id) : null,
    closedByName: String(raw.closed_by_name ?? "—"),
    openingCash: num(raw, "opening_cash"),
    expectedCash: num(raw, "expected_cash"),
    closingCash: nullableNum(raw, "closing_cash"),
    cashDifference: nullableNum(raw, "cash_difference"),
    cashSales: num(raw, "cash_sales"),
    cashRefunds: num(raw, "cash_refunds"),
    cashFromInvoices: num(raw, "cash_from_invoices"),
    cashIn: num(raw, "cash_in"),
    cashOut: num(raw, "cash_out"),
    cashInOutNet: num(raw, "cash_in_out_net"),
    productsSoldQty: num(raw, "products_sold_qty"),
    refundedProductsQty: num(raw, "refunded_products_qty"),
    soldLines: parseSoldLines(raw.sold_lines),
    cashMovements: parseCashMovements(raw.cash_movements),
    paymentMethods: parsePaymentMethods(raw.payment_methods),
  };
}
