import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { IncomeRecord } from "../../db/phase5Writes";
import { incomePaymentMethod, moneyAmount, recordDate, recordDescription, recordName } from "./fields";

export const createIncomeInput = z.object({
  transaction_date: recordDate,
  amount: moneyAmount,
  customer_name: recordName.optional(),
  payment_method: incomePaymentMethod.optional(),
  description: recordDescription.optional(),
}).strict();

export function createIncomeResult(
  ctx: McpAuthContext,
  input: {
    transactionDate: string;
    amount: number;
    customerName: string | null;
    paymentMethod: string | null;
    description: string | null;
  },
  create: (
    ctx: McpAuthContext,
    input: {
      transactionDate: string;
      amount: number;
      customerName: string | null;
      paymentMethod: string | null;
      description: string | null;
    },
  ) => Promise<IncomeRecord>,
): Promise<IncomeRecord> {
  return create(ctx, input);
}
