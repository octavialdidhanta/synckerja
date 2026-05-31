import type { PtkpStatus } from "./constants";
import {
  BPJS_KESEHATAN_MAX_SALARY,
  BPJS_KESEHATAN_RATE,
  BPJS_PENSIUN_MAX_SALARY,
  BPJS_PENSIUN_RATE,
} from "./constants";
import type { TaxBreakdownRow } from "./pph21Annualized";

export type TerCategory = "A" | "B" | "C";

/** Representative TER brackets — mirrors payroll_ter_brackets seed (Category A 2024). */
export const TER_BRACKETS_A_2024: Array<{
  min: number;
  max: number | null;
  rate: number;
}> = [
  { min: 0, max: 5_400_000, rate: 0 },
  { min: 5_400_001, max: 5_650_000, rate: 0.0025 },
  { min: 5_650_001, max: 5_950_000, rate: 0.005 },
  { min: 5_950_001, max: 6_300_000, rate: 0.0075 },
  { min: 6_300_001, max: 6_750_000, rate: 0.01 },
  { min: 6_750_001, max: 7_500_000, rate: 0.0125 },
  { min: 7_500_001, max: 8_550_000, rate: 0.015 },
  { min: 8_550_001, max: 9_650_000, rate: 0.0175 },
  { min: 9_650_001, max: 10_050_000, rate: 0.02 },
  { min: 10_050_001, max: 10_350_000, rate: 0.0225 },
  { min: 10_350_001, max: 10_700_000, rate: 0.025 },
  { min: 10_700_001, max: 11_050_000, rate: 0.03 },
  { min: 11_050_001, max: 11_600_000, rate: 0.035 },
  { min: 11_600_001, max: 12_500_000, rate: 0.04 },
  { min: 12_500_001, max: null, rate: 0.045 },
];

export function terCategoryForEmployee(
  employeeTaxStatus?: string | null,
  ptkpStatus?: string | null,
): TerCategory {
  if (employeeTaxStatus === "pegawai_tidak_tetap" || employeeTaxStatus === "freelancer") {
    return "C";
  }
  const ptkp = ptkpStatus ?? "TK/0";
  if (ptkp === "TK/0" || ptkp === "TK/1") return "A";
  if (ptkp === "TK/2" || ptkp === "TK/3" || ptkp === "K/0") return "B";
  return "C";
}

export function lookupTerRate(
  monthlyGross: number,
  category: TerCategory,
  brackets: typeof TER_BRACKETS_A_2024 = TER_BRACKETS_A_2024,
): { rate: number; min: number; max: number | null } {
  const gross = Math.max(0, monthlyGross);
  const match = [...brackets]
    .reverse()
    .find((b) => gross >= b.min && (b.max === null || gross <= b.max));
  return match ?? { rate: 0, min: 0, max: null };
}

export interface CalculateTerPph21Input {
  monthlyGross: number;
  ptkpStatus?: PtkpStatus | string;
  employeeTaxStatus?: string | null;
  effectiveYear?: number;
}

export interface CalculateTerPph21Result {
  calculationMode: "ter";
  terCategory: TerCategory;
  terRate: number;
  monthlyTax: number;
  monthlyBpjsKesehatan: number;
  monthlyBpjsPensiun: number;
  takeHomePay: number;
  taxBreakdown: TaxBreakdownRow[];
}

export function calculateTerPph21(input: CalculateTerPph21Input): CalculateTerPph21Result {
  const gross = Math.max(0, input.monthlyGross);
  const category = terCategoryForEmployee(input.employeeTaxStatus, input.ptkpStatus);
  const { rate, min, max } = lookupTerRate(gross, category);
  const monthlyTax = Math.round(gross * rate);
  const monthlyBpjsKesehatan = Math.round(Math.min(gross, BPJS_KESEHATAN_MAX_SALARY) * BPJS_KESEHATAN_RATE);
  const monthlyBpjsPensiun = Math.round(Math.min(gross, BPJS_PENSIUN_MAX_SALARY) * BPJS_PENSIUN_RATE);
  const takeHomePay = Math.round(gross - monthlyTax - monthlyBpjsKesehatan - monthlyBpjsPensiun);

  return {
    calculationMode: "ter",
    terCategory: category,
    terRate: rate,
    monthlyTax,
    monthlyBpjsKesehatan,
    monthlyBpjsPensiun,
    takeHomePay,
    taxBreakdown: [
      {
        bracket: `${min} - ${max ?? "∞"}`,
        amount: Math.round(gross),
        tax: monthlyTax,
        rate: rate * 100,
      },
    ],
  };
}

export function calculateThrAmount(
  basicSalary: number,
  mode: "manual_only" | "proportional" | "full_month_salary",
  joinDate: string | null,
  periodEnd: string,
): number {
  if (mode === "manual_only") return 0;
  if (mode === "full_month_salary") return Math.round(Math.max(0, basicSalary));

  const end = new Date(periodEnd.slice(0, 10));
  const year = end.getFullYear();
  const yearStart = new Date(year, 0, 1);
  if (!joinDate) return Math.round(basicSalary);

  const join = new Date(joinDate.slice(0, 10));
  if (join > end) return 0;
  if (join <= yearStart) return Math.round(basicSalary);

  const months =
    (end.getFullYear() - join.getFullYear()) * 12 + (end.getMonth() - join.getMonth()) + 1;
  return Math.round((basicSalary * Math.min(12, Math.max(1, months))) / 12);
}
