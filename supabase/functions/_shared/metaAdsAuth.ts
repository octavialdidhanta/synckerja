import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const metaAdsCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const META_ADS_OAUTH_SCOPES = "ads_read,ads_management,business_management";

export function metaGraphVersion(): string {
  return Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v22.0";
}

export function metaAdsJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...metaAdsCorsHeaders, "Content-Type": "application/json" },
  });
}

/** Facebook Login for Business configuration ID (same app as Instagram when unset). */
export function readMetaAdsOAuthConfigId(): string | null {
  const id =
    Deno.env.get("META_ADS_OAUTH_CONFIG_ID")?.trim() ??
    Deno.env.get("META_OAUTH_CONFIG_ID")?.trim() ??
    "";
  return id || null;
}

export function readPlatformMetaAdsOAuth(): { appId: string; appSecret: string } | null {
  const appId =
    Deno.env.get("META_ADS_APP_ID")?.trim() ??
    Deno.env.get("META_APP_ID")?.trim() ??
    "";
  const appSecret =
    Deno.env.get("META_ADS_APP_SECRET")?.trim() ??
    Deno.env.get("META_APP_SECRET")?.trim() ??
    "";
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function metaAdsOAuthRedirectUri(): string {
  const explicit = Deno.env.get("META_ADS_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/meta-ads-oauth-callback`;
}

export function appPublicOrigin(): string {
  const raw =
    Deno.env.get("APP_PUBLIC_URL")?.trim() ??
    Deno.env.get("SYNCKERJA_APP_URL")?.trim() ??
    "";
  return raw.replace(/\/+$/, "");
}

export const META_ADS_OAUTH_RETURN_PATHS = new Set([
  "/omnichannel/settings/offline-conversion",
  "/omnichannel/settings/google-ads",
  "/digital-marketing/meta-ads/settings",
]);

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: metaAdsJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: metaAdsJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function isOmnichannelMetaAdsAdmin(
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
  const ok = await isOmnichannelMetaAdsAdmin(admin, userId, organizationId);
  if (!ok) return metaAdsJson({ error: "Forbidden" }, 403);
  return null;
}

export async function exchangeMetaLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string,
): Promise<string> {
  const v = metaGraphVersion();
  const exchangeUrl =
    `https://graph.facebook.com/${v}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  const longRes = await fetch(exchangeUrl, { method: "GET" });
  const longData = await longRes.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (longRes.ok && longData?.access_token?.trim()) {
    return longData.access_token.trim();
  }
  console.warn("meta-ads: fb_exchange_token failed", longData?.error?.message ?? longRes.status);
  return shortToken;
}
