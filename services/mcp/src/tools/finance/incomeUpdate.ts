import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { IncomeRecord } from "../../db/phase5Writes";
import { incomePaymentMethod, moneyAmount, recordDate, recordDescription, recordName } from "./fields";

export const updateIncomeSchema = z.object({
  id: z.string().uuid(),
  transaction_date: recordDate.optional(),
  amount: moneyAmount.optional(),
  customer_name: recordName.optional(),
  payment_method: incomePaymentMethod.optional(),
  description: recordDescription.optional(),
}).strict();

export const updateIncomeInput = updateIncomeSchema.refine((value) =>
  value.transaction_date != null
  || value.amount != null
  || value.customer_name != null
  || value.payment_method != null
  || value.description != null,
);

export function updateIncomeResult(
  ctx: McpAuthContext,
  input: {
    id: string;
    transactionDate: string | null;
    amount: number | null;
    customerName: string | null;
    paymentMethod: string | null;
    description: string | null;
  },
  update: (
    ctx: McpAuthContext,
    input: {
      id: string;
      transactionDate: string | null;
      amount: number | null;
      customerName: string | null;
      paymentMethod: string | null;
      description: string | null;
    },
  ) => Promise<IncomeRecord>,
): Promise<IncomeRecord> {
  return update(ctx, input);
}
