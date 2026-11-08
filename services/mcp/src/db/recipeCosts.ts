import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipeCostsQuery } from "../tools/inventory/recipeCosts";

type Session = { userId: string; organizationId: string };

/** Read-only: HPP per menu item for one outlet, computed like the POS checkout snapshot. */
export async function listRecipeCosts(
  admin: SupabaseClient,
  ctx: Session,
  query: RecipeCostsQuery,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_list_recipe_costs", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: query.outletId,
    p_search: query.search,
    p_cost_overrides: query.costOverrides,
    p_only: query.only,
    p_max_margin_pct: query.maxMarginPct,
  });
  if (error) {
    const message = error.message;
    if (message.includes("not_a_member")) throw new Error("not_a_member");
    if (message.includes("not_found")) throw new Error("not_found");
    if (message.includes("invalid_input")) throw new Error("invalid_input");
    throw new Error("query_failed");
  }
  if (!data || typeof data !== "object") throw new Error("query_failed");
  return data as Record<string, unknown>;
}
