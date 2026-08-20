export function calcLineSubtotal(qty: number, unitCost: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(unitCost) || qty <= 0) return 0;
  return Math.round(qty * unitCost * 100) / 100;
}

export function calcPoTotal(lines: Array<{ qty: number; unitCost: number }>): number {
  return lines.reduce((sum, line) => sum + calcLineSubtotal(line.qty, line.unitCost), 0);
}

export function hasValidPoLines(lines: Array<{ qty: number }>): boolean {
  return lines.some((line) => Number.isFinite(line.qty) && line.qty > 0);
}
