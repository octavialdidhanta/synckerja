import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";

/** Shortage shown in parentheses; overage plain; zero = Rp 0. */
export function formatShiftDifference(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const rounded = Math.round(amount);
  if (rounded === 0) return formatReportsMoney(0);
  if (rounded < 0) return `(${formatReportsMoney(Math.abs(rounded))})`;
  return formatReportsMoney(rounded);
}

export function isShiftShortage(amount: number | null | undefined): boolean {
  return amount != null && Number.isFinite(amount) && Math.round(amount) < 0;
}
