import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidGoogleDriveAccessToken } from "./googleDriveAccess.ts";

export function extractGoogleDriveFileId(url: string): string | null {
  if (!url?.trim()) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/i);
  if (fileMatch) return fileMatch[1];
  if (url.includes("drive.google.com") && /[?&]id=([a-zA-Z0-9-_]+)/i.test(url)) {
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/i);
    if (openMatch) return openMatch[1];
  }
  return null;
}

export type DriveAccessResolveResult =
  | { ok: true; accessToken: string }
  | { ok: false; message: string; status: number };

export async function resolveDriveAccessFromJwt(
  supabaseAdmin: SupabaseClient,
  jwt: string,
  logPrefix: string,
): Promise<DriveAccessResolveResult> {
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !user) {
    return { ok: false, message: "Invalid or expired session", status: 401 };
  }

  const { accessToken, error: tokenErr } = await getValidGoogleDriveAccessToken(
    supabaseAdmin,
    user.id,
    logPrefix,
  );
  if (!accessToken) {
    return { ok: false, message: tokenErr ?? "No Google access", status: 400 };
  }
  return { ok: true, accessToken };
}

/** Public /review/{token} — scoped to the plan file on the review link. */
export async function resolveDriveAccessFromReviewToken(
  supabaseAdmin: SupabaseClient,
  reviewToken: string,
  fileIdRaw: string,
  logPrefix: string,
): Promise<DriveAccessResolveResult> {
  if (!reviewToken || reviewToken.length > 128) {
    return { ok: false, message: "Invalid or missing review_token", status: 400 };
  }

  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("public_review_tokens")
    .select("social_media_plan_id, created_by, link_url")
    .eq("token", reviewToken)
    .maybeSingle();

  if (tokenErr || !tokenRow?.social_media_plan_id) {
    return { ok: false, message: "Invalid or expired review link", status: 404 };
  }

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("social_media_plans")
    .select("google_drive_link, pic_production_id, organization_id")
    .eq("id", tokenRow.social_media_plan_id)
    .maybeSingle();

  if (planErr || !plan) {
    return { ok: false, message: "Content not found", status: 404 };
  }

  const planLink = (plan.google_drive_link ?? tokenRow.link_url ?? "").trim();
  const planFileId = extractGoogleDriveFileId(planLink);
  if (!planFileId || planFileId !== fileIdRaw) {
    return { ok: false, message: "File does not match review content", status: 403 };
  }

  const candidateUserIds: string[] = [];
  if (tokenRow.created_by) candidateUserIds.push(tokenRow.created_by);

  if (plan.pic_production_id) {
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("user_id")
      .eq("id", plan.pic_production_id)
      .maybeSingle();
    if (typeof emp?.user_id === "string") candidateUserIds.push(emp.user_id);
  }

  if (plan.organization_id) {
    const { data: orgEmps } = await supabaseAdmin
      .from("employees")
      .select("user_id")
      .eq("organization_id", plan.organization_id)
      .not("user_id", "is", null)
      .limit(20);
    const orgUserIds = (orgEmps ?? [])
      .map((r) => r.user_id)
      .filter((id): id is string => typeof id === "string");
    if (orgUserIds.length > 0) {
      const { data: orgCreds } = await supabaseAdmin
        .from("user_google_oauth_credentials")
        .select("user_id")
        .not("refresh_token", "is", null)
        .in("user_id", orgUserIds);
      for (const row of orgCreds ?? []) {
        if (typeof row.user_id === "string") candidateUserIds.push(row.user_id);
      }
    }
  }

  const seen = new Set<string>();
  for (const userId of candidateUserIds) {
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    const { accessToken } = await getValidGoogleDriveAccessToken(
      supabaseAdmin,
      userId,
      logPrefix,
    );
    if (accessToken) {
      return { ok: true, accessToken };
    }
  }

  return { ok: false, message: "Preview stream unavailable", status: 503 };
}

export function parseSupabaseJwtFromRequest(req: Request, url: URL): string | null {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const t = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (t) return t;
  }
  const q = url.searchParams.get("supabase_token")?.trim();
  return q || null;
}

/** CDN-friendly cache for public review URLs (token is part of the URL). */
export function cacheControlForReviewResource(
  reviewToken: string,
  kind: "media" | "thumbnail" | "probe",
): string {
  if (!reviewToken) return "private, max-age=300";
  if (kind === "probe") return "public, max-age=120, s-maxage=600, stale-while-revalidate=300";
  if (kind === "thumbnail") return "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";
  return "public, max-age=900, s-maxage=3600, stale-while-revalidate=900";
}
