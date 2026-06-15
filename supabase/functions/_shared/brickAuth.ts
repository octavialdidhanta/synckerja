import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brickCorsHeaders, brickJson } from "./brickApi.ts";

export { brickCorsHeaders, brickJson };

export {
  getUserFromBearer,
  requireActiveOrg,
} from "../tiktokShopAuth.ts";

export async function requireBrickOrgAdmin(
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
    return brickJson({ error: "Forbidden: owner or admin required" }, 403);
  }
  return null;
}

const RATE_LIMIT_MS = 2 * 60 * 1000;

export async function checkBrickSyncRateLimit(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Response | null> {
  const { data: row } = await admin
    .from("organization_brick_sync_limits")
    .select("last_sync_requested_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const last = row?.last_sync_requested_at ? new Date(String(row.last_sync_requested_at)).getTime() : 0;
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
    return brickJson({
      error: "Rate limit: wait before refreshing again",
      retryAfterSeconds: waitSec,
    }, 429);
  }

  await admin.from("organization_brick_sync_limits").upsert({
    organization_id: organizationId,
    last_sync_requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return null;
}
