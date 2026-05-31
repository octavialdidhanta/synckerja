/**
 * Backward-compatible re-exports. Prefer importing from `@/shared/lib/payroll`.
 */
export {
  BPJS_KESEHATAN_MAX_SALARY,
  BPJS_PENSIUN_MAX_SALARY,
  PTKP_RATES,
  TAX_BRACKETS,
  type PtkpStatus,
} from "./payroll/constants";

export {
  calculatePPh21,
  formatCurrency,
  type CalculatePPh21Input,
  type CalculatePPh21Result,
  type TaxBreakdownRow,
} from "./payroll/pph21Annualized";

export function parseCurrency(value: string): number {
  const normalized = (value || "").replace(/[^\d]/g, "");
  return parseInt(normalized, 10) || 0;
}
