import { formatPosCash, formatPosCashOut } from "./formatPosCash";

/** counted − expected (negative = shortage). */
export function computePosShiftCashVariance(
  countedCash: number,
  expectedCash: number,
): number {
  const counted = Number.isFinite(countedCash) ? countedCash : 0;
  const expected = Number.isFinite(expectedCash) ? expectedCash : 0;
  return Math.round(counted) - Math.round(expected);
}

/** Display variance: parentheses when negative (shortage). */
export function formatPosShiftVariance(variance: number): string {
  if (variance < 0) return formatPosCashOut(-variance);
  return formatPosCash(variance);
}
