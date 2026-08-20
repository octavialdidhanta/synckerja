import type { PosOutlet } from "../types";

export const POS_OUTLET_FILTER_ALL = "all";

export function activePosOutletIds(rows: PosOutlet[]): string[] {
  return rows.filter((row) => row.is_active).map((row) => row.id);
}

export function summarizeAssignedOutlets(
  rows: PosOutlet[],
  ids: string[],
  max = 2,
): { names: string[]; extra: number } {
  const selected = rows.filter((row) => ids.includes(row.id));
  return {
    names: selected.slice(0, max).map((row) => row.name),
    extra: Math.max(0, selected.length - max),
  };
}

export function defaultPosOutletId(rows: PosOutlet[]): string | null {
  const preferred = rows.find((row) => row.is_default) ?? rows.find((row) => row.is_active) ?? rows[0];
  return preferred?.id ?? null;
}
