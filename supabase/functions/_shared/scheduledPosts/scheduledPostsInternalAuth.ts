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

/** Service role JWT or SCHEDULED_POSTS_INTERNAL_SECRET (pg_cron). */
export function isScheduledPostsInternalAuthorized(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return token === serviceRoleKey || (cronSecret.length > 0 && token === cronSecret);
}
