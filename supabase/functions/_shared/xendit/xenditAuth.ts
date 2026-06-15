import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tiktokShopCorsHeaders, tiktokShopJson } from "../tiktokShopAuth.ts";

export const xenditCorsHeaders = tiktokShopCorsHeaders;

export function xenditJson(body: object, status: number): Response {
  return tiktokShopJson(body, status);
}

export {
  getUserFromBearer,
  requireActiveOrg,
  requireOrgAdmin,
} from "../tiktokShopAuth.ts";

export async function requireXenditOrgAdmin(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const role = String(roleRow?.role ?? "").toLowerCase();
  if (role !== "owner" && role !== "admin") {
    return xenditJson({ error: "Forbidden: owner or admin required" }, 403);
  }
  return null;
}
