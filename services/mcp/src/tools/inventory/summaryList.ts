import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { InventorySummary } from "../../db/inventorySummary";
import { calendarDay } from "../inputs";

const summaryFields = {
  outlet_id: z.string().uuid().optional(),
  kind: z.enum(["both", "ingredients", "item_library"]).optional(),
  date_start: calendarDay.optional(),
  date_end: calendarDay.optional(),
  search: z.string().trim().max(80).optional(),
};

export const summaryListInput = z.object(summaryFields).strict().superRefine((value, ctx) => {
  const hasStart = value.date_start != null;
  const hasEnd = value.date_end != null;
  if (hasStart !== hasEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
    return;
  }
  if (!value.date_start || !value.date_end) return;
  const start = Date.parse(`${value.date_start}T00:00:00Z`);
  const end = Date.parse(`${value.date_end}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000);
  if (days < 0 || days > 365) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
  }
});

export type InventorySummaryQuery = {
  outletId: string | null;
  kind: "both" | "ingredients" | "item_library" | null;
  dateStart: string | null;
  dateEnd: string | null;
  search: string | null;
};

export function summaryListResult(
  ctx: McpAuthContext,
  query: InventorySummaryQuery,
  list: (ctx: McpAuthContext, query: InventorySummaryQuery) => Promise<InventorySummary>,
): Promise<InventorySummary> {
  return list(ctx, query);
}
