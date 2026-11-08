import type { SupabaseClient } from "@supabase/supabase-js";

export type InventorySummaryRow = {
  kind: "ingredient" | "product";
  name: string;
  variant_name: string | null;
  category: string;
  current_qty: number;
  beginning: number;
  purchase_order: number;
  sales: number;
  transfer: number;
  adjustment: number;
  ending: number;
};

export type InventorySummary = {
  outlet_id: string;
  outlet_name: string;
  period_start: string;
  period_end: string;
  truncated: boolean;
  rows: InventorySummaryRow[];
};

type Session = { userId: string; organizationId: string };

export type InventorySummaryArgs = {
  outletId: string | null;
  kind: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  search: string | null;
};

function throwSummary(message: string): never {
  if (message.includes("not_a_member")) throw new Error("not_a_member");
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("query_failed");
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function presentRow(value: unknown): InventorySummaryRow {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const kind = row.kind === "ingredient" ? "ingredient" : "product";
  return {
    kind,
    name: typeof row.name === "string" ? row.name : "",
    variant_name: typeof row.variant_name === "string" ? row.variant_name : null,
    category: typeof row.category === "string" ? row.category : "",
    current_qty: numberValue(row.current_qty),
    beginning: numberValue(row.beginning),
    purchase_order: numberValue(row.purchase_order),
    sales: numberValue(row.sales),
    transfer: numberValue(row.transfer),
    adjustment: numberValue(row.adjustment),
    ending: numberValue(row.ending),
  };
}

function present(value: unknown): InventorySummary {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!body || typeof body.outlet_id !== "string" || typeof body.outlet_name !== "string") {
    throw new Error("query_failed");
  }
  const rows = Array.isArray(body.rows) ? body.rows.map(presentRow) : null;
  if (!rows || typeof body.period_start !== "string" || typeof body.period_end !== "string") {
    throw new Error("query_failed");
  }
  return {
    outlet_id: body.outlet_id,
    outlet_name: body.outlet_name,
    period_start: body.period_start,
    period_end: body.period_end,
    truncated: body.truncated === true,
    rows,
  };
}

export async function listInventorySummary(
  admin: SupabaseClient,
  ctx: Session,
  args: InventorySummaryArgs,
): Promise<InventorySummary> {
  const { data, error } = await admin.rpc("mcp_list_inventory_summary", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: args.outletId,
    p_kind: args.kind,
    p_date_start: args.dateStart,
    p_date_end: args.dateEnd,
    p_search: args.search,
  });
  if (error) throwSummary(error.message);
  return present(data);
}
