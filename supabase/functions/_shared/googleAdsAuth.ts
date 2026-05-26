import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const googleAdsCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function googleAdsJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...googleAdsCorsHeaders, "Content-Type": "application/json" },
  });
}

export function readPlatformGoogleAdsOAuth(): {
  clientId: string;
  clientSecret: string;
  developerToken: string;
} | null {
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")?.trim() ?? "";
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")?.trim() ?? "";
  if (!clientId || !clientSecret || !developerToken) return null;
  return { clientId, clientSecret, developerToken };
}

export function googleAdsOAuthRedirectUri(): string {
  const explicit = Deno.env.get("GOOGLE_ADS_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/google-ads-oauth-callback`;
}

export function appPublicOrigin(): string {
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
  if (!token) return { error: googleAdsJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: googleAdsJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function isOmnichannelGoogleAdsAdmin(
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
  const ok = await isOmnichannelGoogleAdsAdmin(admin, userId, organizationId);
  if (!ok) return googleAdsJson({ error: "Forbidden" }, 403);
  return null;
}
