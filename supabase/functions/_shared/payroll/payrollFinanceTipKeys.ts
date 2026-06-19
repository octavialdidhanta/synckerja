/** Mirror of src/2-4-payroll/constants/payrollFinanceTips.ts for edge runtime. */
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

export function pickRandomFinanceTipKey(): string {
  const idx = Math.floor(Math.random() * PAYROLL_FINANCE_TIP_KEYS.length);
  return PAYROLL_FINANCE_TIP_KEYS[idx] ?? PAYROLL_FINANCE_TIP_KEYS[0];
}
