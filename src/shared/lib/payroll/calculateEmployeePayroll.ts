import type { TaxMethod } from "./constants";
import { calculateOvertimePay, type OvertimeAttendanceRecord } from "./overtimeFromAttendance";
import { calculateProrateRatio, type ProrateInput } from "./prorateWorkingDays";
import {
  filterComponentsForPeriod,
  resolveComponentsWithPercentagePass,
  type PayrollComponentInput,
} from "./resolveComponents";
import { calculateTaxByMethod } from "./taxMethods";
import type { TaxBreakdownRow } from "./pph21Annualized";
import { calculateTerPph21, calculateThrAmount, type TerCategory } from "./terPph21";

export interface AttendancePenaltyInput {
  id: string;
  penalty_amount: number;
  penalty_reason?: string;
}

export interface PayrollLineItem {
  component_id?: string;
  item_name: string;
  item_type: "allowance" | "deduction" | "tax";
  item_category?: string;
  calculated_amount: number;
}

export interface CalculateEmployeePayrollInput {
  basicSalary: number;
  ptkpStatus: string;
  taxMethod?: TaxMethod;
  customPtkpAmount?: number;
  components?: PayrollComponentInput[];
  payrollPeriodId: string;
  penalties?: AttendancePenaltyInput[];
  overtimeEligible?: boolean;
  overtimeRecords?: OvertimeAttendanceRecord[];
  prorate?: ProrateInput;
  /** Override prorate ratio when already computed server-side */
  prorateRatio?: number;
  /** annualized | ter — from tax_configurations.calculation_mode */
  calculationMode?: "annualized" | "ter";
  employeeTaxStatus?: string | null;
  /** Bonus/THR period auto THR */
  isBonusPeriod?: boolean;
  thrCalculationMode?: "manual_only" | "proportional" | "full_month_salary";
  employeeJoinDate?: string | null;
  periodEnd?: string;
  hasThrComponent?: boolean;
}

export interface CalculateEmployeePayrollResult {
  basicSalary: number;
  basicProrated: number;
  totalAllowances: number;
  totalDeductions: number;
  totalPenalties: number;
  totalTaxDeductions: number;
  grossPay: number;
  netPay: number;
  takeHomePay: number;
  bpjsKesehatanMonthly: number;
  bpjsPensiunMonthly: number;
  monthlyTax: number;
  employerTaxCost: number;
  taxBreakdown: TaxBreakdownRow[];
  calculationDetails: Record<string, unknown>;
  lineItems: PayrollLineItem[];
  imputedMonthlyGross: number;
}

export function calculateEmployeePayroll(
  input: CalculateEmployeePayrollInput,
): CalculateEmployeePayrollResult {
  const prorateResult = input.prorate
    ? calculateProrateRatio(input.prorate)
    : { totalWorkingDays: 0, effectiveWorkingDays: 0, ratio: input.prorateRatio ?? 1 };

  const ratio = input.prorateRatio ?? prorateResult.ratio;
  const basicProrated = Math.round(input.basicSalary * ratio);

  const filteredComponents = filterComponentsForPeriod(
    input.components ?? [],
    input.payrollPeriodId,
  );
  const resolved = resolveComponentsWithPercentagePass(filteredComponents, basicProrated);

  let overtimePay = 0;
  const overtimeBreakdown: Array<{ date: string; minutes: number; pay: number }> = [];
  if (input.overtimeEligible && input.overtimeRecords?.length) {
    const ot = calculateOvertimePay(basicProrated, input.overtimeRecords);
    overtimePay = ot.overtimePay;
    overtimeBreakdown.push(...ot.breakdown);
  }

  const allowanceComponents = resolved.filter((c) => c.component_type === "allowance");
  const deductionComponents = resolved.filter((c) => c.component_type === "deduction");

  let thrPay = 0;
  if (
    input.isBonusPeriod &&
    !input.hasThrComponent &&
    input.thrCalculationMode &&
    input.thrCalculationMode !== "manual_only" &&
    input.periodEnd
  ) {
    thrPay = calculateThrAmount(
      input.basicSalary,
      input.thrCalculationMode,
      input.employeeJoinDate ?? null,
      input.periodEnd,
    );
  }

  const componentAllowances = allowanceComponents.reduce((s, c) => s + c.calculated_amount, 0);
  const totalAllowances = componentAllowances + overtimePay + thrPay;

  const otherDeductions = deductionComponents.reduce((s, c) => s + c.calculated_amount, 0);

  const penalties = input.penalties ?? [];
  const totalPenalties = penalties.reduce((s, p) => s + Number(p.penalty_amount || 0), 0);

  const grossPay = basicProrated + totalAllowances;

  const nonTaxableAnnual = allowanceComponents
    .filter((c) => !c.is_taxable)
    .reduce((s, c) => s + c.calculated_amount, 0) * 12;

  const taxMethod = input.taxMethod ?? "gross";
  const preTaxDeductions = otherDeductions + totalPenalties;

  let taxInputGross = grossPay;
  let targetTakeHome: number | undefined;

  if (taxMethod === "netto") {
    targetTakeHome = Math.max(0, basicProrated + totalAllowances - preTaxDeductions);
    taxInputGross = targetTakeHome;
  } else if (taxMethod === "gross_up") {
    targetTakeHome = Math.max(0, basicProrated + totalAllowances - preTaxDeductions);
    taxInputGross = targetTakeHome;
  }

  const calculationMode = input.calculationMode ?? "annualized";
  const taxResult =
    calculationMode === "ter"
      ? {
          ...calculateTerPph21({
            monthlyGross: grossPay,
            ptkpStatus: input.ptkpStatus,
            employeeTaxStatus: input.employeeTaxStatus,
          }),
          taxMethod: "ter" as const,
          imputedMonthlyGross: grossPay,
          employerTaxCost: 0,
          annualGross: grossPay * 12,
          professionalAllowance: 0,
          bpjsKesehatanEmployee: 0,
          bpjsPensiunEmployee: 0,
          netIncome: 0,
          ptkpAmount: 0,
          pkpAmount: 0,
          annualTax: 0,
        }
      : calculateTaxByMethod({
          monthlyGross: taxInputGross,
          ptkpStatus: input.ptkpStatus,
          customPtkpAmount: input.customPtkpAmount,
          nonTaxableAllowance: nonTaxableAnnual,
          taxMethod,
          targetTakeHome,
        });

  const taxableGrossForDisplay =
    taxMethod === "gross" ? grossPay : taxResult.imputedMonthlyGross;

  const bpjsKesehatanMonthly = taxResult.monthlyBpjsKesehatan;
  const bpjsPensiunMonthly = taxResult.monthlyBpjsPensiun;
  const monthlyTax = taxResult.monthlyTax;
  const employerTaxCost = taxResult.employerTaxCost;

  const totalDeductions =
    otherDeductions + bpjsKesehatanMonthly + bpjsPensiunMonthly + monthlyTax;
  const takeHomePay = Math.round(
    (taxMethod === "gross_up"
      ? targetTakeHome ?? grossPay - preTaxDeductions
      : taxResult.takeHomePay) - preTaxDeductions,
  );
  const netPay = takeHomePay;

  const lineItems: PayrollLineItem[] = [];

  for (const c of allowanceComponents) {
    lineItems.push({
      component_id: c.id,
      item_name: c.component_name,
      item_type: "allowance",
      item_category: c.component_category,
      calculated_amount: c.calculated_amount,
    });
  }

  if (overtimePay > 0) {
    lineItems.push({
      item_name: "Lembur",
      item_type: "allowance",
      item_category: "overtime",
      calculated_amount: overtimePay,
    });
  }

  if (thrPay > 0) {
    lineItems.push({
      item_name: "THR",
      item_type: "allowance",
      item_category: "thr",
      calculated_amount: thrPay,
    });
  }

  for (const c of deductionComponents) {
    lineItems.push({
      component_id: c.id,
      item_name: c.component_name,
      item_type: "deduction",
      item_category: c.component_category,
      calculated_amount: c.calculated_amount,
    });
  }

  if (bpjsKesehatanMonthly > 0) {
    lineItems.push({
      item_name: "BPJS Kesehatan",
      item_type: "deduction",
      item_category: "bpjs_kesehatan",
      calculated_amount: Math.round(bpjsKesehatanMonthly),
    });
  }

  if (bpjsPensiunMonthly > 0) {
    lineItems.push({
      item_name: "BPJS Pensiun",
      item_type: "deduction",
      item_category: "bpjs_pensiun",
      calculated_amount: Math.round(bpjsPensiunMonthly),
    });
  }

  for (const p of penalties) {
    lineItems.push({
      item_name: p.penalty_reason || "Penalty",
      item_type: "deduction",
      item_category: "penalty",
      calculated_amount: Math.round(Number(p.penalty_amount)),
    });
  }

  const taxLineAmount =
    taxMethod === "gross_up" ? Math.round(employerTaxCost) : Math.round(monthlyTax);
  if (taxLineAmount > 0) {
    lineItems.push({
      item_name: taxMethod === "gross_up" ? "PPh 21 (Ditanggung Perusahaan)" : "PPh 21",
      item_type: "tax",
      item_category: "pph21",
      calculated_amount: taxLineAmount,
    });
  }

  return {
    basicSalary: input.basicSalary,
    basicProrated,
    totalAllowances,
    totalDeductions: Math.round(totalDeductions + totalPenalties),
    totalPenalties: Math.round(totalPenalties),
    totalTaxDeductions: Math.round(monthlyTax + employerTaxCost),
    grossPay: Math.round(taxMethod === "gross" ? grossPay : taxableGrossForDisplay),
    netPay,
    takeHomePay: netPay,
    bpjsKesehatanMonthly: Math.round(bpjsKesehatanMonthly),
    bpjsPensiunMonthly: Math.round(bpjsPensiunMonthly),
    monthlyTax: Math.round(monthlyTax),
    employerTaxCost: Math.round(employerTaxCost),
    taxBreakdown: taxResult.taxBreakdown,
    imputedMonthlyGross: Math.round(taxResult.imputedMonthlyGross),
    calculationDetails: {
      taxMethod,
      calculationMode,
      terCategory:
        calculationMode === "ter"
          ? ((taxResult as { terCategory?: TerCategory }).terCategory ?? null)
          : null,
      terRate:
        calculationMode === "ter" ? ((taxResult as { terRate?: number }).terRate ?? null) : null,
      prorateRatio: ratio,
      totalWorkingDays: prorateResult.totalWorkingDays,
      effectiveWorkingDays: prorateResult.effectiveWorkingDays,
      overtimeBreakdown,
      thrAmount: thrPay,
      nonTaxableAllowanceAnnual: nonTaxableAnnual,
    },
    lineItems,
  };
}
