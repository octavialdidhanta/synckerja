import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Scopes the Developer Portal app must enable before the owner can authorize. */
export const CANVA_OAUTH_SCOPES = [
  "profile:read",
  "design:meta:read",
  "design:content:read",
  "design:content:write",
  "asset:read",
  "asset:write",
  "folder:read",
  "folder:write",
].join(" ");

export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_REVOKE_URL = "https://api.canva.com/rest/v1/oauth/revoke";
export const CANVA_SETTINGS_PATH = "/digital-marketing/social-media/settings";

export const canvaCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function canvaJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...canvaCorsHeaders, "Content-Type": "application/json" },
  });
}

export function readPlatformCanvaOAuth(): { clientId: string; clientSecret: string } | null {
  const clientId = Deno.env.get("CANVA_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("CANVA_CLIENT_SECRET")?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function canvaBasicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export function canvaOAuthRedirectUri(): string {
  const explicit = Deno.env.get("CANVA_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/canva-oauth-callback`;
}

export function canvaAppPublicOrigin(): string {
  const raw =
    Deno.env.get("APP_PUBLIC_URL")?.trim() ??
    Deno.env.get("SYNCKERJA_APP_URL")?.trim() ??
    "";
  return raw.replace(/\/+$/, "");
}

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: canvaJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: canvaJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function requireActiveOrgMember(
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
    return canvaJson({ error: "Forbidden" }, 403);
  }
  return null;
}

export async function requireOrgOwnerOrAdmin(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (!roleRow?.id) return canvaJson({ error: "Forbidden" }, 403);
  return null;
}
