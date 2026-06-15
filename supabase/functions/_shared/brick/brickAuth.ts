import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brickCorsHeaders, brickJson } from "./brickApi.ts";

export { brickCorsHeaders, brickJson };

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: brickJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: brickJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function requireActiveOrg(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return brickJson({ error: "Forbidden" }, 403);
  }
  return null;
}

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

const RATE_LIMIT_MS = 60 * 1000;

export async function shouldApplyBrickSyncRateLimit(
  admin: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { count: bankCount } = await admin
    .from("bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("brick_link_status", "linked")
    .not("brick_last_sync_at", "is", null);

  const { count: debtCount } = await admin
    .from("debts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("brick_link_status", "linked")
    .not("brick_last_sync_at", "is", null);

  return ((bankCount ?? 0) + (debtCount ?? 0)) > 0;
}

export async function checkBrickSyncRateLimit(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Response | null> {
  const { data: row } = await admin
    .from("organization_brick_sync_limits")
    .select("last_sync_requested_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const last = row?.last_sync_requested_at
    ? new Date(String(row.last_sync_requested_at)).getTime()
    : 0;
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
    return brickJson({
      error: "Rate limit: wait before refreshing again",
      retryAfterSeconds: waitSec,
    }, 429);
  }

  return null;
}

export async function recordBrickSyncRateLimit(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await admin.from("organization_brick_sync_limits").upsert({
    organization_id: organizationId,
    last_sync_requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function checkBrickDisburseRateLimit(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Response | null> {
  const { data: row } = await admin
    .from("organization_brick_sync_limits")
    .select("last_disburse_requested_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const last = row?.last_disburse_requested_at
    ? new Date(String(row.last_disburse_requested_at)).getTime()
    : 0;
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
    return brickJson({
      error: "Rate limit: wait before disbursement again",
      retryAfterSeconds: waitSec,
    }, 429);
  }

  return null;
}

export async function recordBrickDisburseRateLimit(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await admin.from("organization_brick_sync_limits").upsert({
    organization_id: organizationId,
    last_disburse_requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
