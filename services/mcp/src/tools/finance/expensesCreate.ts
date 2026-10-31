import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ExpenseRecord } from "../../db/phase5Writes";
import { moneyAmount, recordDate, recordDescription, recordName } from "./fields";

export const createExpenseInput = z.object({
  expense_name: recordName,
  amount: moneyAmount,
  create_date: recordDate,
  expense_type: recordName,
  category: recordName,
  description: recordDescription.optional(),
}).strict();

export function createExpenseResult(
  ctx: McpAuthContext,
  input: {
    expenseName: string;
    amount: number;
    createDate: string;
    expenseType: string;
    category: string;
    description: string | null;
  },
  create: (
    ctx: McpAuthContext,
    input: {
      expenseName: string;
      amount: number;
      createDate: string;
      expenseType: string;
      category: string;
      description: string | null;
    },
  ) => Promise<ExpenseRecord>,
): Promise<ExpenseRecord> {
  return create(ctx, input);
}
