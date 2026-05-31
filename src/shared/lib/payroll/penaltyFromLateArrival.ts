export type PenaltyCalculationType = "fixed" | "hourly" | "salary_percentage";

export interface LateArrivalPenaltyRule {
  id: string;
  name: string;
  thresholdMinutes: number;
  calculationType: PenaltyCalculationType;
  penaltyAmount?: number;
  hourlyRate?: number;
  salaryPercentage?: number;
  maxPenaltyPerMonth?: number;
  isActive?: boolean;
  appliesToAll?: boolean;
  specificDepartmentIds?: string[];
}

export interface LateArrivalPenaltySettings {
  enableAutomaticPenalties: boolean;
  defaultHourlyRate?: number;
  defaultSalaryPercentage?: number;
  minimumPenaltyAmount?: number;
  maximumDailyPenalty?: number;
  maximumMonthlyPenalty?: number;
}

export interface LateArrivalPenaltyInput {
  isLate: boolean;
  lateMinutes: number;
  lateToleranceMinutes: number;
  employeeDepartmentId?: string | null;
  basicSalary?: number;
  rules: LateArrivalPenaltyRule[];
  settings: LateArrivalPenaltySettings;
  existingDailyTotal?: number;
  existingMonthlyTotal?: number;
}

export interface LateArrivalPenaltyResult {
  penalizableMinutes: number;
  applied: Array<{
    ruleId: string;
    ruleName: string;
    amount: number;
    calculationType: PenaltyCalculationType;
  }>;
  totalAmount: number;
  skippedReason?: string;
}

export function calculatePenalizableMinutes(
  lateMinutes: number,
  lateToleranceMinutes: number,
): number {
  return Math.max(0, lateMinutes - (lateToleranceMinutes ?? 0));
}

function ruleMatchesDepartment(
  rule: LateArrivalPenaltyRule,
  departmentId?: string | null,
): boolean {
  if (rule.appliesToAll !== false) return true;
  if (!departmentId || !rule.specificDepartmentIds?.length) return false;
  return rule.specificDepartmentIds.includes(departmentId);
}

function calculateRuleAmount(
  rule: LateArrivalPenaltyRule,
  penalizableMinutes: number,
  basicSalary: number,
  settings: LateArrivalPenaltySettings,
): number {
  if (rule.calculationType === "hourly") {
    const hourly =
      rule.hourlyRate ?? settings.defaultHourlyRate ?? 0;
    return Math.round((penalizableMinutes / 60) * hourly);
  }

  if (rule.calculationType === "salary_percentage") {
    const pct = rule.salaryPercentage ?? settings.defaultSalaryPercentage ?? 0;
    return Math.round(basicSalary * (pct / 100));
  }

  return Math.round(rule.penaltyAmount ?? 0);
}

function applyCaps(
  amount: number,
  settings: LateArrivalPenaltySettings,
  rule: LateArrivalPenaltyRule,
  dailySum: number,
  monthlySum: number,
): number {
  let capped = amount;

  if ((settings.minimumPenaltyAmount ?? 0) > 0 && capped > 0) {
    capped = Math.max(capped, settings.minimumPenaltyAmount!);
  }

  if ((settings.maximumDailyPenalty ?? 0) > 0) {
    capped = Math.min(capped, Math.max(0, settings.maximumDailyPenalty! - dailySum));
  }

  if ((settings.maximumMonthlyPenalty ?? 0) > 0) {
    capped = Math.min(capped, Math.max(0, settings.maximumMonthlyPenalty! - monthlySum));
  }

  if ((rule.maxPenaltyPerMonth ?? 0) > 0) {
    capped = Math.min(capped, rule.maxPenaltyPerMonth!);
  }

  return capped;
}

/** V1: flat salary_percentage per event when threshold met; hourly scales by penalizable minutes. */
export function calculateLateArrivalPenalties(
  input: LateArrivalPenaltyInput,
): LateArrivalPenaltyResult {
  if (!input.isLate || input.lateMinutes <= 0) {
    return { penalizableMinutes: 0, applied: [], totalAmount: 0, skippedReason: "not_late" };
  }

  if (!input.settings.enableAutomaticPenalties) {
    return { penalizableMinutes: 0, applied: [], totalAmount: 0, skippedReason: "automatic_penalties_disabled" };
  }

  const penalizableMinutes = calculatePenalizableMinutes(
    input.lateMinutes,
    input.lateToleranceMinutes,
  );

  if (penalizableMinutes <= 0) {
    return { penalizableMinutes: 0, applied: [], totalAmount: 0, skippedReason: "within_tolerance" };
  }

  const matchingRules = input.rules
    .filter((r) => r.isActive !== false)
    .filter((r) => penalizableMinutes >= (r.thresholdMinutes ?? 0))
    .filter((r) => ruleMatchesDepartment(r, input.employeeDepartmentId))
    .sort((a, b) => (b.thresholdMinutes ?? 0) - (a.thresholdMinutes ?? 0));

  let dailySum = input.existingDailyTotal ?? 0;
  let monthlySum = input.existingMonthlyTotal ?? 0;
  const applied: LateArrivalPenaltyResult["applied"] = [];

  for (const rule of matchingRules) {
    let amount = calculateRuleAmount(
      rule,
      penalizableMinutes,
      input.basicSalary ?? 0,
      input.settings,
    );
    amount = applyCaps(amount, input.settings, rule, dailySum, monthlySum);

    if (amount <= 0) continue;

    applied.push({
      ruleId: rule.id,
      ruleName: rule.name,
      amount,
      calculationType: rule.calculationType,
    });
    dailySum += amount;
    monthlySum += amount;
  }

  return {
    penalizableMinutes,
    applied,
    totalAmount: applied.reduce((sum, row) => sum + row.amount, 0),
  };
}
