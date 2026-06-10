import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const tiktokAdsCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const TIKTOK_ADS_API_VERSION = "v1.3";
export const TIKTOK_ADS_API_BASE = `https://business-api.tiktok.com/open_api/${TIKTOK_ADS_API_VERSION}`;

export function tiktokAdsJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...tiktokAdsCorsHeaders, "Content-Type": "application/json" },
  });
}

export function readPlatformTikTokAdsOAuth(): { appId: string; appSecret: string } | null {
  const appId = Deno.env.get("TIKTOK_ADS_CLIENT_KEY")?.trim() ??
    Deno.env.get("TIKTOK_ADS_APP_ID")?.trim() ?? "";
  const appSecret = Deno.env.get("TIKTOK_ADS_CLIENT_SECRET")?.trim() ??
    Deno.env.get("TIKTOK_ADS_APP_SECRET")?.trim() ?? "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function isTikTokAdsPlatformConfigured(): boolean {
  return readPlatformTikTokAdsOAuth() !== null;
}

/** Returns 503 when platform app credentials are missing from Supabase secrets. */
export function requireTikTokAdsPlatformConfigured(): Response | null {
  if (!isTikTokAdsPlatformConfigured()) {
    return tiktokAdsJson(
      {
        error:
          "TikTok Ads is not configured on the server. Set TIKTOK_ADS_CLIENT_KEY and TIKTOK_ADS_CLIENT_SECRET in Supabase Edge Function secrets.",
      },
      503,
    );
  }
  return null;
}

export function tiktokAdsOAuthRedirectUri(): string {
  const explicit = Deno.env.get("TIKTOK_ADS_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/tiktok-ads-oauth-callback`;
}

export function appPublicOrigin(): string {
  const raw =
    Deno.env.get("APP_PUBLIC_URL")?.trim() ??
    Deno.env.get("SYNCKERJA_APP_URL")?.trim() ??
    "";
  return raw.replace(/\/+$/, "");
}

export const TIKTOK_ADS_OAUTH_RETURN_PATHS = new Set([
  "/omnichannel/settings/offline-conversion",
  "/digital-marketing/tiktok-ads/settings",
]);

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: tiktokAdsJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: tiktokAdsJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function isOmnichannelTikTokAdsAdmin(
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
  const ok = await isOmnichannelTikTokAdsAdmin(admin, userId, organizationId);
  if (!ok) return tiktokAdsJson({ error: "Forbidden" }, 403);
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
    return tiktokAdsJson({ error: "Forbidden" }, 403);
  }
  return null;
}
