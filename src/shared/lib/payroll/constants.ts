export type PtkpStatus = "TK/0" | "TK/1" | "TK/2" | "TK/3" | "K/0" | "K/1" | "K/2" | "K/3";

export const PTKP_RATES: Record<PtkpStatus, number> = {
  "TK/0": 54000000,
  "TK/1": 58500000,
  "TK/2": 63000000,
  "TK/3": 67500000,
  "K/0": 58500000,
  "K/1": 63000000,
  "K/2": 67500000,
  "K/3": 72000000,
};

export const TAX_BRACKETS = [
  { min: 0, max: 60000000, rate: 0.05 },
  { min: 60000000, max: 250000000, rate: 0.15 },
  { min: 250000000, max: 500000000, rate: 0.25 },
  { min: 500000000, max: Infinity, rate: 0.3 },
] as const;

export const MAX_PROFESSIONAL_ALLOWANCE = 6_000_000;
export const BPJS_KESEHATAN_RATE = 0.02;
export const BPJS_PENSIUN_RATE = 0.01;
export const BPJS_KESEHATAN_MAX_SALARY = 12_000_000;
export const BPJS_PENSIUN_MAX_SALARY = 8_930_600;
export const OVERTIME_HOURS_DIVISOR = 173;
export const OVERTIME_FIRST_HOUR_MULTIPLIER = 1.5;
export const OVERTIME_NEXT_HOUR_MULTIPLIER = 2;

export type TaxMethod = "gross" | "gross_up" | "netto";
