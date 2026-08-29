export type PosShiftSoldLineRaw = {
  service_name: string | null;
  sub_service_name: string | null;
  quantity: number;
};

export type PosShiftSoldProductRow = {
  label: string;
  quantity: number;
};

/** Display label: `Name - Variant` when sub-name exists (matches POS shift reference UI). */
export function formatSoldProductLabel(row: {
  service_name: string | null;
  sub_service_name: string | null;
}): string {
  const name = (row.service_name ?? "").trim();
  const sub = (row.sub_service_name ?? "").trim();
  if (name && sub) return `${name} - ${sub}`;
  if (name) return name;
  if (sub) return sub;
  return "—";
}

/**
 * Group sold lines by display label and sum quantities.
 * Total qty must match `productsSoldQty` from the same raw lines.
 */
export function aggregatePosShiftProductsSold(
  lines: readonly PosShiftSoldLineRaw[],
): { totalQty: number; rows: PosShiftSoldProductRow[] } {
  const map = new Map<string, number>();
  let totalQty = 0;

  for (const line of lines) {
    const qty = Number(line.quantity ?? 0);
    if (!Number.isFinite(qty) || qty === 0) continue;
    totalQty += qty;
    const label = formatSoldProductLabel(line);
    map.set(label, (map.get(label) ?? 0) + qty);
  }

  const rows = [...map.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return { totalQty, rows };
}
