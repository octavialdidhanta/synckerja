import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "../authz/context";
import { assertOrgOwnerOrAdmin } from "../tools/aiEmployee/rules";

export type ProductKnowledgeListInput = {
  serviceId: string | null;
  subServiceId: string | null;
  search: string | null;
  limit: number | null;
};

export async function listProductKnowledge(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  input: ProductKnowledgeListInput,
) {
  assertOrgOwnerOrAdmin(ctx);
  const { data, error } = await admin.rpc("mcp_list_product_knowledge", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_service_id: input.serviceId,
    p_sub_service_id: input.subServiceId,
    p_search: input.search,
    p_limit: input.limit,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("forbidden")) throw new Error("forbidden");
    if (message.includes("invalid_input")) throw new Error("invalid_input");
    throw new Error("query_failed");
  }
  return Array.isArray(data) ? data : [];
}
