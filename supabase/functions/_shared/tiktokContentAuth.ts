import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const tiktokContentCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const TIKTOK_CONTENT_API_BASE = "https://open.tiktokapis.com/v2";
export const TIKTOK_BUSINESS_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";
export const TIKTOK_CONTENT_OAUTH_SCOPES =
  "user.info.basic,video.list,user.info.stats,comment.list,comment.list.manage";

export type TikTokContentOAuthTokenKind = "login_kit" | "tt_user";

export const TIKTOK_CONTENT_OAUTH_TOKEN_KINDS = {
  loginKit: "login_kit" as TikTokContentOAuthTokenKind,
  ttUser: "tt_user" as TikTokContentOAuthTokenKind,
};

export const TIKTOK_CONTENT_COMMENT_SCOPES = ["comment.list", "comment.list.manage"] as const;

/** Union comma-separated OAuth scope strings (deduped, stable order). */
export function mergeTikTokContentOAuthScopes(
  ...scopeStrings: (string | null | undefined)[]
): string {
  const merged = new Set<string>();
  for (const raw of scopeStrings) {
    for (const part of String(raw ?? "").split(",")) {
      const trimmed = part.trim();
      if (trimmed) merged.add(trimmed);
    }
  }
  return [...merged].join(",");
}

/** TikTok often omits scopes in token JSON; merge stored + requested scopes. */
export function resolveTikTokContentOAuthScopes(stored: string | null | undefined): string {
  return mergeTikTokContentOAuthScopes(stored, TIKTOK_CONTENT_OAUTH_SCOPES);
}

export function tiktokContentScopesIncludeComments(scope: string | null | undefined): boolean {
  const parts = String(scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return TIKTOK_CONTENT_COMMENT_SCOPES.every((required) => parts.includes(required));
}

export function tiktokContentJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...tiktokContentCorsHeaders, "Content-Type": "application/json" },
  });
}

export function readPlatformTikTokContentOAuth(): { clientKey: string; clientSecret: string } | null {
  const clientKey = Deno.env.get("TIKTOK_CONTENT_CLIENT_KEY")?.trim() ??
    Deno.env.get("TIKTOK_CONTENT_APP_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("TIKTOK_CONTENT_CLIENT_SECRET")?.trim() ??
    Deno.env.get("TIKTOK_CONTENT_APP_SECRET")?.trim() ?? "";
  if (!clientKey || !clientSecret) return null;
  return { clientKey, clientSecret };
}

export function isTikTokContentPlatformConfigured(): boolean {
  return readPlatformTikTokContentOAuth() !== null;
}

export function requireTikTokContentPlatformConfigured(): Response | null {
  if (!isTikTokContentPlatformConfigured()) {
    return tiktokContentJson(
      {
        error:
          "TikTok Content is not configured. Set TIKTOK_CONTENT_CLIENT_KEY and TIKTOK_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
      },
      503,
    );
  }
  return null;
}

export function tiktokContentOAuthRedirectUri(): string {
  const explicit = Deno.env.get("TIKTOK_CONTENT_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/tiktok-content-oauth-callback`;
}

export function appPublicOrigin(): string {
  const raw =
    Deno.env.get("APP_PUBLIC_URL")?.trim() ??
    Deno.env.get("SYNCKERJA_APP_URL")?.trim() ??
    "";
  return raw.replace(/\/+$/, "");
}

export const TIKTOK_CONTENT_OAUTH_RETURN_PATHS = new Set([
  "/digital-marketing/social-media-performance/tiktok/settings",
  "/digital-marketing/social-media-performance/manage-comments/tiktok/settings",
]);

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: tiktokContentJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: tiktokContentJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function isOmnichannelContentAdmin(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data: owner } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .maybeSingle();
  if (owner) return true;

  const { data: staffRows } = await admin
    .from("organization_omnichannel_staff")
    .select("employee_id, employees!inner(user_id)")
    .eq("organization_id", organizationId)
    .eq("role", "admin");

  for (const row of staffRows ?? []) {
    const emp = row as { employees?: { user_id?: string } | { user_id?: string }[] };
    const employees = emp.employees;
    const userIds: string[] = [];
    if (Array.isArray(employees)) {
      for (const e of employees) {
        if (e?.user_id) userIds.push(String(e.user_id));
      }
    } else if (employees && typeof employees === "object" && "user_id" in employees) {
      const uid = (employees as { user_id?: string }).user_id;
      if (uid) userIds.push(String(uid));
    }
    if (userIds.includes(userId)) return true;
  }
  return false;
}

export async function requireOrgAdmin(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const ok = await isOmnichannelContentAdmin(admin, userId, organizationId);
  if (!ok) return tiktokContentJson({ error: "Forbidden" }, 403);
  return null;
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
  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return tiktokContentJson({ error: "Forbidden" }, 403);
  }
  return null;
}
