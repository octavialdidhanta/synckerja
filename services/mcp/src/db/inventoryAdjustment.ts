import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdjustmentPreviewInput, AdjustmentWriteInput } from "../tools/inventory/adjustmentCreate";

type Session = { userId: string; organizationId: string };

/** Maps database refusals to stable codes the assistant can explain. */
export function throwAdjustment(message: string): never {
  if (message.includes("mcp_tool_confirmations_pkey")) throw new Error("confirmation_used");
  if (message.includes("not_a_member")) throw new Error("not_a_member");
  const ambiguousAt = message.indexOf("ambiguous");
  if (ambiguousAt >= 0) throw new Error(message.slice(ambiguousAt));
  const adjustment = message.match(/catalog_adjustment_[a-z_]+/);
  if (adjustment) throw new Error(adjustment[0]);
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("query_failed");
}

function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("query_failed");
  return value as Record<string, unknown>;
}

/** Read-only: resolves the item and shows the stock before and after. */
export async function previewStockAdjustment(
  admin: SupabaseClient,
  ctx: Session,
  input: AdjustmentPreviewInput,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_preview_stock_adjustment", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: input.outletId,
    p_search: input.item,
    p_set_to: input.setTo,
    p_change: input.change,
    p_reason: input.reason,
  });
  if (error) throwAdjustment(error.message);
  const result = body(data);
  if (typeof result.outlet_id !== "string") throw new Error("query_failed");
  return { ...result, saved: false };
}

/** Records the confirmation once and writes the adjustment as the session user. */
export async function createStockAdjustment(
  admin: SupabaseClient,
  ctx: Session,
  input: AdjustmentWriteInput,
  confirmId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_confirm_stock_adjustment", {
    p_confirm_id: confirmId,
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: input.outletId,
    p_item_kind: input.kind,
    p_product_id: input.productId,
    p_variant_id: input.variantId,
    p_ingredient_id: input.ingredientId,
    p_qty_before: input.qtyBefore,
    p_qty_change: input.qtyChange,
    p_reason: input.reason,
  });
  if (error) throwAdjustment(error.message);
  const result = body(data);
  if (result.saved !== true) throw new Error("query_failed");
  return result;
}
