import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ExpenseRecord } from "../../db/phase5Writes";
import { moneyAmount, recordDate, recordDescription, recordName } from "./fields";

export const updateExpenseSchema = z.object({
  id: z.string().uuid(),
  expense_name: recordName.optional(),
  amount: moneyAmount.optional(),
  create_date: recordDate.optional(),
  expense_type: recordName.optional(),
  category: recordName.optional(),
  description: recordDescription.optional(),
}).strict();

export const updateExpenseInput = updateExpenseSchema.refine((value) =>
  value.expense_name != null
  || value.amount != null
  || value.create_date != null
  || value.expense_type != null
  || value.category != null
  || value.description != null,
);

export function updateExpenseResult(
  ctx: McpAuthContext,
  input: {
    id: string;
    expenseName: string | null;
    amount: number | null;
    createDate: string | null;
    expenseType: string | null;
    category: string | null;
    description: string | null;
  },
  update: (
    ctx: McpAuthContext,
    input: {
      id: string;
      expenseName: string | null;
      amount: number | null;
      createDate: string | null;
      expenseType: string | null;
      category: string | null;
      description: string | null;
    },
  ) => Promise<ExpenseRecord>,
): Promise<ExpenseRecord> {
  return update(ctx, input);
}
