import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipeDraftCreate } from "../tools/inventory/recipeDrafts";

type Session = { userId: string; organizationId: string };

const PASS_THROUGH = [
  "ingredient_not_found",
  "unit_mismatch",
  "recipe_draft_quantity_too_small",
  "recipe_draft_quantity_too_large",
  "recipe_draft_duplicate_ingredient",
  "ambiguous",
];

/** Keeps the user-facing detail (which ingredient, which unit) and hides everything else. */
export function throwRecipeDraft(message: string): never {
  for (const code of PASS_THROUGH) {
    const at = message.indexOf(code);
    if (at >= 0) throw new Error(message.slice(at));
  }
  if (message.includes("menu_not_found")) throw new Error("menu_not_found");
  if (message.includes("not_a_member")) throw new Error("not_a_member");
  if (message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("invalid_input") || message.includes("recipe_draft_lines_invalid")) {
    throw new Error("invalid_input");
  }
  throw new Error("query_failed");
}

export async function createRecipeDraft(
  admin: SupabaseClient,
  ctx: Session,
  input: RecipeDraftCreate,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_create_recipe_draft", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: input.outletId,
    p_product_name: input.menu,
    p_lines: input.lines,
    p_note: input.requestNote,
  });
  if (error) throwRecipeDraft(error.message);
  if (!data || typeof data !== "object") throw new Error("query_failed");
  return data as Record<string, unknown>;
}

export async function listRecipeDrafts(
  admin: SupabaseClient,
  ctx: Session,
  status: string | null,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_list_recipe_drafts", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_status: status,
  });
  if (error) throwRecipeDraft(error.message);
  if (!data || typeof data !== "object") throw new Error("query_failed");
  return data as Record<string, unknown>;
}
