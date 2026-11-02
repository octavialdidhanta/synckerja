import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const scheduledPostsCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function scheduledPostsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...scheduledPostsCorsHeaders, "Content-Type": "application/json" },
  });
}

/** MCP schedule calls carry the cron secret plus the session user. Other actions stay on the user JWT. */
export function mcpScheduleUserId(action: string, body: Record<string, unknown>): string | null {
  if (action !== "schedule") return null;
  const secret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const provided = typeof body.internal_secret === "string" ? body.internal_secret : "";
  const userId = typeof body.mcp_user_id === "string" ? body.mcp_user_id.trim() : "";
  if (!secret || provided !== secret || !userId) return null;
  return userId;
}

export async function isActiveOrganizationMember(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("user_organizations")
    .select("is_active")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return false;
  return (data as { is_active?: boolean | null }).is_active !== false;
}

const MCP_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Constant-time compare. Does not treat a missing secret as a match. */
export function internalSecretMatches(provided: string, expected: string): boolean {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

export function credentialShape(value: string): string {
  if (!value) return "empty";
  if (value.startsWith("eyJ")) return "jwt";
  if (value.startsWith("sb_secret_")) return "sb_secret";
  if (value.startsWith("sb_")) return "sb_other";
  return "other";
}

/**
 * Ads dashboard reads from MCP. The caller must present SCHEDULED_POSTS_INTERNAL_SECRET
 * and the session user id. The bearer is not compared to SUPABASE_SERVICE_ROLE_KEY:
 * the MCP server's service-role JWT is valid at PostgREST, but it is not the same
 * string Supabase injects into the function, so that comparison rejected every call.
 * A user JWT without the secret never takes this path.
 */
export function mcpServiceInternalUserId(req: Request, body: Record<string, unknown>): string | null {
  const secret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const provided = typeof body.internal_secret === "string" ? body.internal_secret : "";
  const userId = typeof body.mcp_user_id === "string" ? body.mcp_user_id.trim() : "";
  if (!provided) return null;
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!internalSecretMatches(provided, secret) || !MCP_USER_ID.test(userId)) {
    console.error("ads internal door rejected", {
      reason: !internalSecretMatches(provided, secret) ? "secret_rejected" : "invalid_user",
      bearerShape: credentialShape(token),
    });
    return null;
  }
  return userId;
}

export type OrganizationMembershipState =
  | { state: "active" }
  | { state: "mismatch" }
  | { state: "policy"; table: "user_organizations" }
  | { state: "query_failed"; table: "user_organizations" };

function policyDenied(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "42501" || /permission denied|row-level security|policy/i.test(message);
}

export async function describeOrganizationMembership(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<OrganizationMembershipState> {
  const { data, error } = await admin
    .from("user_organizations")
    .select("is_active")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    const denied = policyDenied(error);
    console.error("organization membership query failed", {
      reason: denied ? "database_policy" : "query_failed",
      code: error.code ?? "",
      table: "user_organizations",
    });
    return denied
      ? { state: "policy", table: "user_organizations" }
      : { state: "query_failed", table: "user_organizations" };
  }
  if (!data || (data as { is_active?: boolean | null }).is_active === false) return { state: "mismatch" };
  return { state: "active" };
}

/** Service role JWT or SCHEDULED_POSTS_INTERNAL_SECRET (pg_cron). */
export function isScheduledPostsInternalAuthorized(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return token === serviceRoleKey || (cronSecret.length > 0 && token === cronSecret);
}
