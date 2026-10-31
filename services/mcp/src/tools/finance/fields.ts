import { z } from "zod";
import { calendarDay } from "../inputs";

const moneyMax = 9_999_999_999_999.99;

export const moneyAmount = z
  .number()
  .gt(0)
  .lte(moneyMax)
  .refine((value) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6);

export const incomePaymentMethod = z.enum([
  "cash",
  "credit_card",
  "debit_card",
  "check",
  "digital_wallet",
  "other",
]);

export const recordDate = calendarDay;
export const recordName = z.string().trim().min(1).max(200);
export const recordDescription = z.string().trim().min(1).max(2000);
