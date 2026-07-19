import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const blibliSellerCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Production Seller API proxy host (override with BLIBLI_SELLER_API_BASE). */
export const BLIBLI_SELLER_API_BASE_DEFAULT = "https://api.blibli.com/v2";
export const BLIBLI_SELLER_CENTER_ORIGIN_DEFAULT = "https://seller.blibli.com";
export const BLIBLI_CHAT_OTT_PATH = "/proxy/seller/v1/chats/tokens";
export const BLIBLI_CHAT_OTT_RATE_LIMIT_PER_HOUR = 10;
export const BLIBLI_CHAT_IFRAME_SESSION_HOURS = 8;

export function blibliSellerJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...blibliSellerCorsHeaders, "Content-Type": "application/json" },
  });
}

export type BlibliPlatformConfig = {
  apiClientId: string;
  apiClientKey: string;
  channelId: string;
};

export function readBlibliPlatformConfig(): BlibliPlatformConfig | null {
  const apiClientId = Deno.env.get("BLIBLI_API_CLIENT_ID")?.trim() ?? "";
  const apiClientKey = Deno.env.get("BLIBLI_API_CLIENT_KEY")?.trim() ?? "";
  const channelId = Deno.env.get("BLIBLI_CHANNEL_ID")?.trim() ?? "Synckerja";
  if (!apiClientId || !apiClientKey) return null;
  return { apiClientId, apiClientKey, channelId };
}

export function isBlibliPlatformConfigured(): boolean {
  return readBlibliPlatformConfig() !== null;
}

export function requireBlibliPlatformConfigured(): Response | null {
  if (!isBlibliPlatformConfigured()) {
    return blibliSellerJson(
      {
        error:
          "Blibli Seller API is not configured. Set BLIBLI_API_CLIENT_ID, BLIBLI_API_CLIENT_KEY, and BLIBLI_CHANNEL_ID in Edge Function secrets.",
      },
      503,
    );
  }
  return null;
}

export function blibliSellerApiBase(): string {
  const explicit = Deno.env.get("BLIBLI_SELLER_API_BASE")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return BLIBLI_SELLER_API_BASE_DEFAULT;
}

export function blibliSellerCenterOrigin(): string {
  const explicit = Deno.env.get("BLIBLI_SELLER_CENTER_ORIGIN")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return BLIBLI_SELLER_CENTER_ORIGIN_DEFAULT;
}

export function buildBlibliBasicAuthHeader(clientId: string, clientKey: string): string {
  const raw = `${clientId}:${clientKey}`;
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `Basic ${btoa(bin)}`;
}

export function buildBlibliChatIframeUrl(authToken: string, origin = blibliSellerCenterOrigin()): string {
  const base = origin.replace(/\/+$/, "");
  const token = encodeURIComponent(authToken.trim());
  return `${base}/conversations?authToken=${token}&mode=iframe`;
}

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: blibliSellerJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: blibliSellerJson({ error: "Invalid token" }, 401) };
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
  if (!ok) return blibliSellerJson({ error: "Forbidden" }, 403);
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
    return blibliSellerJson({ error: "Forbidden" }, 403);
  }
  return null;
}

/** Org members can mint OTT / view settings; connect requires admin. */
export async function requireOrgMember(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: role } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (role) return null;
  return blibliSellerJson({ error: "Forbidden" }, 403);
}
