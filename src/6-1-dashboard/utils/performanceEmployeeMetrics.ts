/**
 * Shared metrics for Content Planner / Production / Content Post employee tables.
 * currentValue = monthly actual (approved / production-approved / posted count).
 * targetValue = active employee_targets.target_value for that role.
 */

export function normalizeMonthlyTargetValue(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Percent progress toward monthly target; 0% if target missing or non-positive. */
export function computeProgressAgainstMonthlyTarget(
  currentValue: number,
  targetValue: number
): number {
  const t = normalizeMonthlyTargetValue(targetValue);
  if (t <= 0) return 0;
  return Math.min(Math.round((currentValue / t) * 100), 100);
}
