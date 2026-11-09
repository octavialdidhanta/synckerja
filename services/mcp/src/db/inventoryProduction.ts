import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductionPreviewInput, ProductionWriteInput } from "../tools/inventory/productionCreate";

type Session = { userId: string; organizationId: string };

/** Maps database refusals to stable codes the assistant can explain. */
export function throwProduction(message: string): never {
  if (message.includes("mcp_tool_confirmations_pkey") || message.includes("confirmation_used")) {
    throw new Error("confirmation_used");
  }
  if (message.includes("not_a_member")) throw new Error("not_a_member");
  const ambiguousAt = message.indexOf("ambiguous");
  if (ambiguousAt >= 0) throw new Error(message.slice(ambiguousAt));
  for (const code of [
    "production_item_not_found",
    "production_item_not_tracked",
    "production_recipe_required",
    "outlet_not_found",
    "catalog_stock_insufficient",
    "catalog_produce_output_invalid",
    "catalog_produce_recipe_required",
  ]) {
    if (message.includes(code)) throw new Error(code);
  }
  if (message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("query_failed");
}

function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("query_failed");
  return value as Record<string, unknown>;
}

/** Read-only: resolves the semi-finished item and shows what one production would do. */
export async function previewIngredientProduction(
  admin: SupabaseClient,
  ctx: Session,
  input: ProductionPreviewInput,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_preview_ingredient_production", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: input.outletId,
    p_search: input.item,
    p_qty: input.qty,
  });
  if (error) throwProduction(error.message);
  const result = body(data);
  if (typeof result.item_id !== "string" || typeof result.outlet_id !== "string") throw new Error("query_failed");
  return { saved: false, ...result };
}

/** Records the confirmation and runs the same production RPC as the Produce button. */
export async function createIngredientProduction(
  admin: SupabaseClient,
  ctx: Session,
  input: ProductionWriteInput,
  confirmId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_confirm_ingredient_production", {
    p_confirm_id: confirmId,
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: input.outletId,
    p_item_id: input.itemId,
    p_qty: input.qty,
  });
  if (error) throwProduction(error.message);
  const result = body(data);
  if (result.saved !== true) throw new Error("query_failed");
  return result;
}
