import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const youtubeContentCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const YOUTUBE_CONTENT_COMMENTS_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/youtube.force-ssl";

export const YOUTUBE_CONTENT_UPLOAD_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/youtube.upload";

export const YOUTUBE_CONTENT_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  YOUTUBE_CONTENT_UPLOAD_OAUTH_SCOPE,
  YOUTUBE_CONTENT_COMMENTS_OAUTH_SCOPE,
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

export function parseYouTubeOAuthScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function youtubeContentScopesIncludeUpload(scopes: unknown): boolean {
  const list = parseYouTubeOAuthScopes(scopes);
  return list.some(
    (s) =>
      s.includes("youtube.upload")
      || s === "https://www.googleapis.com/auth/youtube",
  );
}

export function hasYouTubeCommentsOAuthScope(scopes: string[]): boolean {
  return scopes.some(
    (s) =>
      s.includes("youtube.force-ssl")
      || s === "https://www.googleapis.com/auth/youtube",
  );
}

export function youtubeContentJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...youtubeContentCorsHeaders, "Content-Type": "application/json" },
  });
}

export function readPlatformYouTubeContentOAuth(): { clientId: string; clientSecret: string } | null {
  const clientId = Deno.env.get("YOUTUBE_CONTENT_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("YOUTUBE_CONTENT_CLIENT_SECRET")?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isYouTubeContentPlatformConfigured(): boolean {
  return readPlatformYouTubeContentOAuth() !== null;
}

export function requireYouTubeContentPlatformConfigured(): Response | null {
  if (!isYouTubeContentPlatformConfigured()) {
    return youtubeContentJson(
      {
        error:
          "YouTube Content is not configured. Set YOUTUBE_CONTENT_CLIENT_ID and YOUTUBE_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
      },
      503,
    );
  }
  return null;
}

export function youtubeContentOAuthRedirectUri(): string {
  const explicit = Deno.env.get("YOUTUBE_CONTENT_OAUTH_REDIRECT_URI")?.trim();
  if (explicit) return explicit;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/youtube-content-oauth-callback`;
}

export function appPublicOrigin(): string {
  const raw =
    Deno.env.get("APP_PUBLIC_URL")?.trim() ??
    Deno.env.get("SYNCKERJA_APP_URL")?.trim() ??
    "";
  return raw.replace(/\/+$/, "");
}

export const YOUTUBE_CONTENT_OAUTH_RETURN_PATHS = new Set([
  "/digital-marketing/social-media-performance/youtube/settings",
  "/digital-marketing/social-media-performance/manage-comments/youtube/settings",
]);

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: youtubeContentJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: youtubeContentJson({ error: "Invalid token" }, 401) };
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
  if (!ok) return youtubeContentJson({ error: "Forbidden" }, 403);
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
    return youtubeContentJson({ error: "Forbidden" }, 403);
  }
  return null;
}
