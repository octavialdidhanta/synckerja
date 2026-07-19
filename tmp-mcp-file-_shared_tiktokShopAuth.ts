import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const tiktokShopCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const TIKTOK_SHOP_API_BASE_DEFAULT = "https://open-api.tiktokglobalshop.com";
export const TIKTOK_SHOP_AUTH_AUTHORIZE_BASE_DEFAULT = "https://services.tiktokshop.com";
/** Token exchange/refresh host (separate from open-api seller endpoints). */
export const TIKTOK_SHOP_AUTH_TOKEN_BASE_DEFAULT = "https://auth.tiktok-shops.com";

export function tiktokShopJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...tiktokShopCorsHeaders, "Content-Type": "application/json" },
  });
}

export type TikTokShopPlatformOAuth = {
  appKey: string;
  appSecret: string;
  serviceId: string;
};

export function readPlatformTikTokShopOAuth(): TikTokShopPlatformOAuth | null {
  const appKey = Deno.env.get("TIKTOK_SHOP_APP_KEY")?.trim() ??
    Deno.env.get("TIKTOK_SHOP_CLIENT_KEY")?.trim() ?? "";
  const appSecret = Deno.env.get("TIKTOK_SHOP_APP_SECRET")?.trim() ??
    Deno.env.get("TIKTOK_SHOP_CLIENT_SECRET")?.trim() ?? "";
  const serviceId = Deno.env.get("TIKTOK_SHOP_SERVICE_ID")?.trim() ?? "";
  if (!appKey || !appSecret || !serviceId) return null;
  return { appKey, appSecret, serviceId };
}

export function isTikTokShopPlatformConfigured(): boolean {
  return readPlatformTikTokShopOAuth() !== null;
}

export function requireTikTokShopPlatformConfigured(): Response | null {
  if (!isTikTokShopPlatformConfigured()) {
    return tiktokShopJson(
      {
        error:
          "TikTok Shop is not configured. Set TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET, and TIKTOK_SHOP_SERVICE_ID in Supabase Edge Function secrets.",
      },
      503,
    );
  }
  return null;
}

export function tiktokShopApiBase(): string {
  const explicit = Deno.env.get("TIKTOK_SHOP_API_BASE")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return TIKTOK_SHOP_API_BASE_DEFAULT;
}

export function tiktokShopAuthAuthorizeBase(): string {
  const explicit = Deno.env.get("TIKTOK_SHOP_AUTH_AUTHORIZE_BASE")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return TIKTOK_SHOP_AUTH_AUTHORIZE_BASE_DEFAULT;
}

export function tiktokShopAuthTokenBase(): string {
  const explicit = Deno.env.get("TIKTOK_SHOP_AUTH_TOKEN_BASE")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return TIKTOK_SHOP_AUTH_TOKEN_BASE_DEFAULT;
}

export function tiktokShopOAuthRedirectUri(): string {
  const explicit = Deno.env.get("TIKTOK_SHOP_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/tiktok-shop-oauth-callback`;
}

export function appPublicOrigin(): string {
  const raw =
    Deno.env.get("APP_PUBLIC_URL")?.trim() ??
    Deno.env.get("SYNCKERJA_APP_URL")?.trim() ??
    "";
  return raw.replace(/\/+$/, "");
}

export const TIKTOK_SHOP_OAUTH_RETURN_PATHS = new Set([
  "/operations/sales/tiktok-shop/settings",
  "/digital-marketing/tiktok-shop/settings",
]);

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: tiktokShopJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: tiktokShopJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function isOmnichannelShopAdmin(
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
  const ok = await isOmnichannelShopAdmin(admin, userId, organizationId);
  if (!ok) return tiktokShopJson({ error: "Forbidden" }, 403);
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
    return tiktokShopJson({ error: "Forbidden" }, 403);
  }
  return null;
}
