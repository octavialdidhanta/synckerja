export type PosCashierShiftStatus = "open" | "closed";

export type PosCashMovementDirection = "in" | "out";

export type PosOutletShiftSettings = {
  outlet_id: string;
  organization_id: string;
  auto_start_enabled: boolean;
  default_opening_cash: number;
  created_at?: string;
  updated_at?: string;
};

export type PosCashierShift = {
  id: string;
  organization_id: string;
  outlet_id: string;
  opened_by: string | null;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number | null;
  closing_cash: number | null;
  status: PosCashierShiftStatus;
  created_at?: string;
  updated_at?: string;
};

export type PosCashMovement = {
  id: string;
  organization_id: string;
  shift_id: string;
  direction: PosCashMovementDirection;
  amount: number;
  description: string;
  created_by: string | null;
  created_at: string;
};

export type PosShiftTotals = {
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  cashInOutNet: number;
  expectedCash: number;
  productsSoldQty: number;
};

export const DEFAULT_POS_OUTLET_SHIFT_SETTINGS: Omit<
  PosOutletShiftSettings,
  "outlet_id" | "organization_id"
> = {
  auto_start_enabled: false,
  default_opening_cash: 100_000,
};

export function mapPosCashierShift(row: Record<string, unknown>): PosCashierShift {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    outlet_id: String(row.outlet_id),
    opened_by: (row.opened_by as string | null) ?? null,
    closed_by: (row.closed_by as string | null) ?? null,
    opened_at: String(row.opened_at),
    closed_at: (row.closed_at as string | null) ?? null,
    opening_cash: Number(row.opening_cash ?? 0),
    expected_cash: row.expected_cash == null ? null : Number(row.expected_cash),
    closing_cash: row.closing_cash == null ? null : Number(row.closing_cash),
    status: row.status === "closed" ? "closed" : "open",
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function mapPosCashMovement(row: Record<string, unknown>): PosCashMovement {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    shift_id: String(row.shift_id),
    direction: row.direction === "out" ? "out" : "in",
    amount: Number(row.amount ?? 0),
    description: String(row.description ?? ""),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
  };
}
