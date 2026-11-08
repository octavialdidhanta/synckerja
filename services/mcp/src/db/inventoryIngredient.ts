import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngredientWriteInput } from "../tools/inventory/ingredientCreate";

export type IngredientWriteResult = {
  saved: boolean;
  ingredient_id: string | null;
  outlet_id: string;
  outlet_name: string;
  name: string;
  kind: "raw";
  unit_code: string;
  category_name: string | null;
  category_is_new: boolean;
  opening_stock: number;
  unit_cost: number;
  opening_value: number;
  track_cogs: boolean;
  alert_at: number | null;
  in_stock: number | null;
};

type Session = { userId: string; organizationId: string };

/** Maps database refusals to stable codes the assistant can explain. */
export function throwInventoryWrite(message: string): never {
  if (message.includes("mcp_tool_confirmations_pkey")) throw new Error("confirmation_used");
  if (message.includes("not_a_member")) throw new Error("not_a_member");
  if (message.includes("ingredient_duplicate") || message.includes("uq_catalog_ingredients_org_name")) {
    throw new Error("ingredient_duplicate");
  }
  if (message.includes("ingredient_unit_invalid")) throw new Error("ingredient_unit_invalid");
  if (message.includes("ingredient_cost_required")) throw new Error("ingredient_cost_required");
  const ambiguousAt = message.indexOf("ambiguous");
  if (ambiguousAt >= 0) throw new Error(message.slice(ambiguousAt));
  if (message.includes("catalog_inventory_feature_forbidden")) throw new Error("catalog_inventory_feature_forbidden");
  const catalogPo = message.match(/catalog_po_[a-z0-9_]+/);
  if (catalogPo) throw new Error(catalogPo[0]);
  if (message.includes("catalog_stock_forbidden")) throw new Error("forbidden");
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("query_failed");
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function present(value: unknown): IngredientWriteResult {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!body
    || typeof body.outlet_id !== "string"
    || typeof body.outlet_name !== "string"
    || typeof body.name !== "string"
    || typeof body.unit_code !== "string") {
    throw new Error("query_failed");
  }
  return {
    saved: body.saved === true,
    ingredient_id: typeof body.ingredient_id === "string" ? body.ingredient_id : null,
    outlet_id: body.outlet_id,
    outlet_name: body.outlet_name,
    name: body.name,
    kind: "raw",
    unit_code: body.unit_code,
    category_name: typeof body.category_name === "string" ? body.category_name : null,
    category_is_new: body.category_is_new === true,
    opening_stock: numberValue(body.opening_stock),
    unit_cost: numberValue(body.unit_cost),
    opening_value: numberValue(body.opening_value),
    track_cogs: body.track_cogs === true,
    alert_at: nullableNumber(body.alert_at),
    in_stock: nullableNumber(body.in_stock),
  };
}

/** confirmId null = preview (validated, nothing written). */
export async function writeCatalogIngredient(
  admin: SupabaseClient,
  ctx: Session,
  input: IngredientWriteInput,
  confirmId: string | null,
): Promise<IngredientWriteResult> {
  const { data, error } = await admin.rpc("mcp_write_catalog_ingredient", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: input.outletId,
    p_name: input.name,
    p_unit_code: input.unitCode,
    p_category_name: input.categoryName,
    p_opening_stock: input.openingStock,
    p_unit_cost: input.unitCost,
    p_alert_at: input.alertAt,
    p_confirm_id: confirmId,
  });
  if (error) throwInventoryWrite(error.message);
  return present(data);
}
