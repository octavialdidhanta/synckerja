import {
  BPJS_KESEHATAN_MAX_SALARY,
  BPJS_KESEHATAN_RATE,
  BPJS_PENSIUN_MAX_SALARY,
  BPJS_PENSIUN_RATE,
  MAX_PROFESSIONAL_ALLOWANCE,
  PTKP_RATES,
  TAX_BRACKETS,
  type PtkpStatus,
} from "./constants";

export interface TaxBreakdownRow {
  bracket: string;
  amount: number;
  tax: number;
  rate: number;
}

export interface CalculatePPh21Input {
  monthlyGross: number;
  ptkpStatus?: string;
  customPtkpAmount?: number;
  includeBpjsKesehatan?: boolean;
  includeBpjsPensiun?: boolean;
  nonTaxableAllowance?: number;
}

export interface CalculatePPh21Result {
  annualGross: number;
  professionalAllowance: number;
  bpjsKesehatan: number;
  bpjsPensiun: number;
  bpjsKesehatanCompany: number;
  bpjsPensiunCompany: number;
  netIncome: number;
  ptkp: number;
  pkp: number;
  annualTax: number;
  monthlyTax: number;
  takeHomePay: number;
  totalCompanyCost: number;
  taxBreakdown: TaxBreakdownRow[];
  bpjsKesehatanEmployee: number;
  bpjsPensiunEmployee: number;
  netIncomeBeforeTax: number;
  ptkpAmount: number;
  pkpAmount: number;
  monthlyBpjsKesehatan: number;
  monthlyBpjsPensiun: number;
}

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(toNumber(amount));
}

export function calculatePPh21(input: CalculatePPh21Input): CalculatePPh21Result {
  const monthlyGross = Math.max(0, toNumber(input.monthlyGross));
  const includeBpjsKesehatan = input.includeBpjsKesehatan !== false;
  const includeBpjsPensiun = input.includeBpjsPensiun !== false;
  const nonTaxableAllowanceAmount = Math.max(0, toNumber(input.nonTaxableAllowance));

  const annualGross = monthlyGross * 12;
  const professionalAllowance = Math.min(annualGross * 0.05, MAX_PROFESSIONAL_ALLOWANCE);

  let bpjsKesehatanAmount = 0;
  let bpjsPensiunAmount = 0;
  let bpjsKesehatanCompany = 0;
  let bpjsPensiunCompany = 0;

  if (includeBpjsKesehatan) {
    const baseForKesehatan = Math.min(monthlyGross, BPJS_KESEHATAN_MAX_SALARY);
    bpjsKesehatanAmount = baseForKesehatan * BPJS_KESEHATAN_RATE * 12;
    bpjsKesehatanCompany = baseForKesehatan * 0.03 * 12;
  }

  if (includeBpjsPensiun) {
    const baseForPensiun = Math.min(monthlyGross, BPJS_PENSIUN_MAX_SALARY);
    bpjsPensiunAmount = baseForPensiun * BPJS_PENSIUN_RATE * 12;
    bpjsPensiunCompany = baseForPensiun * 0.02 * 12;
  }

  const netIncome = annualGross - professionalAllowance - bpjsKesehatanAmount - bpjsPensiunAmount;

  const ptkp =
    typeof input.customPtkpAmount === "number" && input.customPtkpAmount > 0
      ? input.customPtkpAmount
      : PTKP_RATES[(input.ptkpStatus as PtkpStatus) || "TK/0"] || 0;

  const pkp = Math.max(0, netIncome - ptkp - nonTaxableAllowanceAmount);

  let remainingPkp = pkp;
  let totalTax = 0;
  const taxBreakdown: TaxBreakdownRow[] = [];

  for (const bracket of TAX_BRACKETS) {
    if (remainingPkp <= 0) break;

    const bracketSize = bracket.max === Infinity ? remainingPkp : bracket.max - bracket.min;
    const taxableInBracket = Math.min(remainingPkp, bracketSize);

    if (taxableInBracket > 0) {
      const taxInBracket = taxableInBracket * bracket.rate;
      taxBreakdown.push({
        bracket: `${formatCurrency(bracket.min)} - ${bracket.max === Infinity ? "∞" : formatCurrency(bracket.max)}`,
        amount: taxableInBracket,
        tax: taxInBracket,
        rate: bracket.rate * 100,
      });
      totalTax += taxInBracket;
      remainingPkp -= taxableInBracket;
    }
  }

  const monthlyTax = totalTax / 12;
  const monthlyBpjsKesehatan = includeBpjsKesehatan ? bpjsKesehatanAmount / 12 : 0;
  const monthlyBpjsPensiun = includeBpjsPensiun ? bpjsPensiunAmount / 12 : 0;
  const takeHomePay = monthlyGross - monthlyTax - monthlyBpjsKesehatan - monthlyBpjsPensiun;

  const monthlyBpjsKesehatanCompany = includeBpjsKesehatan ? bpjsKesehatanCompany / 12 : 0;
  const monthlyBpjsPensiunCompany = includeBpjsPensiun ? bpjsPensiunCompany / 12 : 0;
  const totalCompanyCost = monthlyGross + monthlyBpjsKesehatanCompany + monthlyBpjsPensiunCompany;

  return {
    annualGross,
    professionalAllowance,
    bpjsKesehatan: bpjsKesehatanAmount,
    bpjsPensiun: bpjsPensiunAmount,
    bpjsKesehatanCompany,
    bpjsPensiunCompany,
    netIncome,
    ptkp,
    pkp,
    annualTax: totalTax,
    monthlyTax,
    takeHomePay,
    totalCompanyCost,
    taxBreakdown,
    bpjsKesehatanEmployee: bpjsKesehatanAmount,
    bpjsPensiunEmployee: bpjsPensiunAmount,
    netIncomeBeforeTax: netIncome,
    ptkpAmount: ptkp,
    pkpAmount: pkp,
    monthlyBpjsKesehatan,
    monthlyBpjsPensiun,
  };
}
