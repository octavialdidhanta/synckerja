import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const linkedinContentCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Organic insights, comments, and page admin (Community Management API required). */
export const LINKEDIN_CONTENT_OAUTH_SCOPES_DEFAULT = [
  "r_organization_social_feed",
  "w_organization_social_feed",
  "w_organization_social",
  "rw_organization_admin",
].join(" ");

export const LINKEDIN_SCOPE_FEATURE_MAP = {
  insights: ["r_organization_social_feed"] as const,
  comments: ["r_organization_social_feed", "w_organization_social_feed"] as const,
  publish: ["w_organization_social"] as const,
  pages: ["rw_organization_admin"] as const,
} as const;

export function parseLinkedInGrantedScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function missingLinkedInScopesForFeature(
  granted: string[],
  feature: keyof typeof LINKEDIN_SCOPE_FEATURE_MAP,
): string[] {
  const required = LINKEDIN_SCOPE_FEATURE_MAP[feature];
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return required.filter((s) => !grantedSet.has(s.toLowerCase()));
}

export function linkedinContentOAuthScopes(): string {
  const explicit = Deno.env.get("LINKEDIN_CONTENT_OAUTH_SCOPES")?.trim();
  return explicit || LINKEDIN_CONTENT_OAUTH_SCOPES_DEFAULT;
}

export function linkedinContentJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...linkedinContentCorsHeaders, "Content-Type": "application/json" },
  });
}

export function readPlatformLinkedInContentOAuth(): { clientId: string; clientSecret: string } | null {
  const clientId = Deno.env.get("LINKEDIN_CONTENT_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("LINKEDIN_CONTENT_CLIENT_SECRET")?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isLinkedInContentPlatformConfigured(): boolean {
  return readPlatformLinkedInContentOAuth() !== null;
}

export function requireLinkedInContentPlatformConfigured(): Response | null {
  if (!isLinkedInContentPlatformConfigured()) {
    return linkedinContentJson(
      {
        error:
          "LinkedIn Content is not configured. Set LINKEDIN_CONTENT_CLIENT_ID and LINKEDIN_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
      },
      503,
    );
  }
  return null;
}

export function linkedinContentOAuthRedirectUri(): string {
  const explicit = Deno.env.get("LINKEDIN_CONTENT_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/linkedin-content-api`;
}

export function appPublicOrigin(): string {
  const raw =
    Deno.env.get("APP_PUBLIC_URL")?.trim() ??
    Deno.env.get("SYNCKERJA_APP_URL")?.trim() ??
    "";
  return raw.replace(/\/+$/, "");
}

export const LINKEDIN_CONTENT_OAUTH_RETURN_PATHS = new Set([
  "/digital-marketing/social-media-performance/linkedin/settings",
]);

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: linkedinContentJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: linkedinContentJson({ error: "Invalid token" }, 401) };
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
  if (!ok) return linkedinContentJson({ error: "Forbidden" }, 403);
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
    return linkedinContentJson({ error: "Forbidden" }, 403);
  }
  return null;
}
