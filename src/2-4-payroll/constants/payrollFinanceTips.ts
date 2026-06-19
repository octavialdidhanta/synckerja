/** i18n keys for rotating finance tips on payroll paid announcements. */
export const PAYROLL_FINANCE_TIP_KEYS = [
  "payroll.financeTip.emergencyFund",
  "payroll.financeTip.trackExpenses",
  "payroll.financeTip.payYourselfFirst",
  "payroll.financeTip.avoidImpulse",
  "payroll.financeTip.debtPriority",
  "payroll.financeTip.sinkingFund",
  "payroll.financeTip.reviewSubscriptions",
  "payroll.financeTip.separateAccounts",
  "payroll.financeTip.budget503020",
  "payroll.financeTip.saveBeforeSpend",
] as const;

export type PayrollFinanceTipKey = (typeof PAYROLL_FINANCE_TIP_KEYS)[number];

export function pickRandomFinanceTipKey(): PayrollFinanceTipKey {
  const idx = Math.floor(Math.random() * PAYROLL_FINANCE_TIP_KEYS.length);
  return PAYROLL_FINANCE_TIP_KEYS[idx] ?? PAYROLL_FINANCE_TIP_KEYS[0];
}
