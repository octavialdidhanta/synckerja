import type { TaxMethod } from "./constants";
import { calculatePPh21, type CalculatePPh21Input, type CalculatePPh21Result } from "./pph21Annualized";

export interface TaxMethodInput extends CalculatePPh21Input {
  taxMethod?: TaxMethod;
  /** Target take-home before non-tax component deductions (netto / gross_up). */
  targetTakeHome?: number;
}

export interface TaxMethodResult extends CalculatePPh21Result {
  taxMethod: TaxMethod;
  imputedMonthlyGross: number;
  employerTaxCost: number;
}

const MAX_ITERATIONS = 64;
const TOLERANCE = 100;

function employeeTakeHomeGross(
  monthlyGross: number,
  input: TaxMethodInput,
  taxMethod: TaxMethod,
): number {
  const pph = calculatePPh21({ ...input, monthlyGross });
  if (taxMethod === "gross_up") {
    return monthlyGross - pph.monthlyBpjsKesehatan - pph.monthlyBpjsPensiun;
  }
  return pph.takeHomePay;
}

function findImputedGross(input: TaxMethodInput, taxMethod: TaxMethod): number {
  const target = Math.max(0, input.targetTakeHome ?? input.monthlyGross);
  if (target <= 0) return 0;

  let low = target;
  let high = Math.max(target * 2, target + 1_000_000);

  while (employeeTakeHomeGross(high, input, taxMethod) < target && high < target * 10) {
    high *= 2;
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const thp = employeeTakeHomeGross(mid, input, taxMethod);
    if (Math.abs(thp - target) <= TOLERANCE) return mid;
    if (thp < target) low = mid;
    else high = mid;
  }

  return (low + high) / 2;
}

export function calculateTaxByMethod(input: TaxMethodInput): TaxMethodResult {
  const taxMethod: TaxMethod = input.taxMethod ?? "gross";

  if (taxMethod === "gross") {
    const result = calculatePPh21(input);
    return {
      ...result,
      taxMethod,
      imputedMonthlyGross: input.monthlyGross,
      employerTaxCost: 0,
    };
  }

  const targetTakeHome = input.targetTakeHome ?? input.monthlyGross;
  const imputedMonthlyGross = findImputedGross({ ...input, targetTakeHome }, taxMethod);
  const result = calculatePPh21({ ...input, monthlyGross: imputedMonthlyGross });

  if (taxMethod === "gross_up") {
    const takeHomePay =
      imputedMonthlyGross - result.monthlyBpjsKesehatan - result.monthlyBpjsPensiun;
    return {
      ...result,
      takeHomePay,
      taxMethod,
      imputedMonthlyGross,
      employerTaxCost: result.monthlyTax,
      monthlyTax: 0,
    };
  }

  // netto: employee bears tax; imputed gross produces target take-home
  return {
    ...result,
    taxMethod,
    imputedMonthlyGross,
    employerTaxCost: 0,
  };
}
