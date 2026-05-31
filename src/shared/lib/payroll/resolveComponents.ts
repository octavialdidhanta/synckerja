export interface PayrollComponentInput {
  id?: string;
  component_name: string;
  component_type: "allowance" | "deduction";
  component_category?: string;
  amount?: number;
  is_percentage?: boolean;
  percentage_base?: "basic_salary" | "gross_salary";
  is_taxable?: boolean;
  is_active?: boolean;
  is_recurring?: boolean;
  payroll_period_id?: string | null;
}

export interface ResolvedComponent {
  id?: string;
  component_name: string;
  component_type: "allowance" | "deduction";
  component_category?: string;
  calculated_amount: number;
  is_taxable: boolean;
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function filterComponentsForPeriod(
  components: PayrollComponentInput[],
  payrollPeriodId: string,
): PayrollComponentInput[] {
  return components.filter((c) => {
    if (c.is_active === false) return false;
    if (c.is_recurring !== false && !c.payroll_period_id) return true;
    return c.payroll_period_id === payrollPeriodId;
  });
}

export function resolveComponents(
  components: PayrollComponentInput[],
  basicSalary: number,
  fixedAllowancesTotal: number,
): ResolvedComponent[] {
  const fixedAllowances = components.filter(
    (c) => c.component_type === "allowance" && !c.is_percentage,
  );
  const fixedAllowancesSum = fixedAllowances.reduce((s, c) => s + toNumber(c.amount), 0);
  const grossBase = basicSalary + fixedAllowancesSum + fixedAllowancesTotal;

  return components.map((c) => {
    let calculated = toNumber(c.amount);
    if (c.is_percentage) {
      const base = c.percentage_base === "gross_salary" ? grossBase : basicSalary;
      calculated = (toNumber(c.amount) / 100) * base;
    }
    return {
      id: c.id,
      component_name: c.component_name,
      component_type: c.component_type,
      component_category: c.component_category,
      calculated_amount: Math.round(calculated),
      is_taxable: c.is_taxable !== false,
    };
  });
}

export function resolveComponentsWithPercentagePass(
  components: PayrollComponentInput[],
  basicSalary: number,
): ResolvedComponent[] {
  const fixed = components.filter((c) => !c.is_percentage);
  const fixedResolved = resolveComponents(fixed, basicSalary, 0);
  const fixedAllowanceSum = fixedResolved
    .filter((c) => c.component_type === "allowance")
    .reduce((s, c) => s + c.calculated_amount, 0);

  const percentage = components.filter((c) => c.is_percentage);
  const pctResolved = resolveComponents(percentage, basicSalary, fixedAllowanceSum);

  return [...fixedResolved, ...pctResolved];
}
