/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
} from "../_shared/metaContentAuth.ts";
import { metaGraphVersion } from "../_shared/metaPlatformScopes.ts";
import {
  collectDiscoveredComments,
  mergeDiscoveredComments,
  normalizeInstagramUsername,
  OUTREACH_DISCOVER_COMMENT_CAP,
  type ExistingAudienceRow,
  type ManualKind,
  type AudienceSource,
  type AudienceStatus,
  type RawOutreachMedia,
} from "../_shared/instagramOutreach/audience.ts";

type Body = {
  organization_id?: string;
  campaign_id?: string;
};

type SyncCode =
  | "NO_IG_ACCOUNT"
  | "TOKEN_INVALID"
  | "COMPETITOR_NOT_FOUND"
  | "COMMENTS_UNAVAILABLE"
  | "META_ERROR"
  | "RATE_LIMIT";

const COMMENT_TEXT_MAX = 2000;

function clip(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function sanitizeMetaMessage(message: string): string {
  return message.replace(/access_token=[^&\s]+/gi, "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function mapMetaError(error: { code?: number; message?: string; type?: string }): SyncCode {
  const code = error.code;
  const msg = (error.message ?? "").toLowerCase();
  if (code === 190 || code === 102 || msg.includes("access token") || msg.includes("session has expired")) {
    return "TOKEN_INVALID";
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || msg.includes("rate limit")) {
    return "RATE_LIMIT";
  }
  if (code === 100 && msg.includes("supported fields")) {
    return "COMMENTS_UNAVAILABLE";
  }
  if (
    code === 110 ||
    msg.includes("does not exist") ||
    msg.includes("invalid user") ||
    msg.includes("nonexisting") ||
    msg.includes("cannot find") ||
    msg.includes("unsupported get request") ||
    (code === 100 && msg.includes("business_discovery"))
  ) {
    return "COMPETITOR_NOT_FOUND";
  }
  if (
    msg.includes("permission")
    || (error.type === "OAuthException" && (code === 10 || code === 200))
  ) {
    return "TOKEN_INVALID";
  }
  return "META_ERROR";
}

async function assertOrgOwner(
  admin: { from: (table: string) => any },
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: org } = await admin
    .from("organizations")
    .select("user_id, created_by")
    .eq("id", organizationId)
    .maybeSingle();
  const orgRow = org as { user_id?: string | null; created_by?: string | null } | null;
  if (orgRow && (orgRow.user_id === userId || orgRow.created_by === userId)) return null;

  const { data: roles, error: rolesError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);
  if (rolesError) {
    return metaContentJson({ ok: false, code: "META_ERROR" }, 500);
  }
  const isOwner = ((roles ?? []) as { role?: string | null }[]).some(
    (row) => String(row.role ?? "").trim().toLowerCase() === "owner",
  );
  if (isOwner) return null;
  return metaContentJson({ ok: false, code: "OWNER_REQUIRED" }, 403);
}

async function markSyncError(
  admin: { from: (table: string) => any },
  campaignId: string,
  organizationId: string,
  code: SyncCode,
  detail?: string,
): Promise<void> {
  const lastSyncError = detail ? `${code}|${sanitizeMetaMessage(detail)}` : code;
  await admin
    .from("instagram_outreach_campaigns")
    .update({ last_sync_error: lastSyncError, updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("organization_id", organizationId);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: metaContentCorsHeaders });
    }
    if (req.method !== "POST") {
      return metaContentJson({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return metaContentJson({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    const body = (await req.json().catch(() => ({}))) as Body;
    const organizationId = String(body.organization_id ?? "").trim();
    const campaignId = String(body.campaign_id ?? "").trim();
    if (!organizationId || !campaignId) {
      return metaContentJson({ error: "Missing organization_id or campaign_id" }, 400);
    }

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;
    const ownerForbidden = await assertOrgOwner(admin, userRes.userId, organizationId);
    if (ownerForbidden) return ownerForbidden;

    const { data: campaignRow } = await admin
      .from("instagram_outreach_campaigns")
      .select("id, organization_id, instagram_business_account_id, competitor_username")
      .eq("id", campaignId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!campaignRow) {
      return metaContentJson({ ok: false, code: "CAMPAIGN_NOT_FOUND" }, 404);
    }
    const campaign = campaignRow as {
      id: string;
      organization_id: string;
      instagram_business_account_id: string;
      competitor_username: string;
    };

    const { data: accountRow } = await admin
      .from("organization_instagram_accounts")
      .select("instagram_business_account_id, page_access_token, is_active")
      .eq("organization_id", organizationId)
      .eq("instagram_business_account_id", campaign.instagram_business_account_id)
      .eq("is_active", true)
      .maybeSingle();
    const account = accountRow as {
      instagram_business_account_id?: string;
      page_access_token?: string | null;
    } | null;
    const pageToken = String(account?.page_access_token ?? "").trim();
    const igId = String(account?.instagram_business_account_id ?? "").trim();
    if (!igId || !pageToken) {
      await markSyncError(admin, campaign.id, organizationId, "NO_IG_ACCOUNT");
      return metaContentJson({ ok: false, code: "NO_IG_ACCOUNT" }, 200);
    }

    const competitor = normalizeInstagramUsername(campaign.competitor_username);
    if (!competitor) {
      await markSyncError(admin, campaign.id, organizationId, "COMPETITOR_NOT_FOUND");
      return metaContentJson({ ok: false, code: "COMPETITOR_NOT_FOUND" }, 200);
    }

    const version = metaGraphVersion();
    const { data: ownedRows } = await admin
      .from("organization_instagram_accounts")
      .select("instagram_business_account_id, instagram_username, page_access_token")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    const owned = ((ownedRows ?? []) as {
      instagram_business_account_id?: string | null;
      instagram_username?: string | null;
      page_access_token?: string | null;
    }[]).find((row) => normalizeInstagramUsername(String(row.instagram_username ?? "")) === competitor);

    let media: RawOutreachMedia[] = [];
    if (!owned) {
      await markSyncError(admin, campaign.id, organizationId, "COMMENTS_UNAVAILABLE");
      return metaContentJson({ ok: false, code: "COMMENTS_UNAVAILABLE" }, 200);
    }

    const ownedId = String(owned.instagram_business_account_id ?? "").trim();
    const ownedToken = String(owned.page_access_token ?? "").trim();
    if (!ownedId || !ownedToken) {
      await markSyncError(admin, campaign.id, organizationId, "NO_IG_ACCOUNT");
      return metaContentJson({ ok: false, code: "NO_IG_ACCOUNT" }, 200);
    }

    const fields =
      "id,permalink,timestamp,caption,like_count,comments_count,comments.limit(25){id,text,username,timestamp}";
    const url =
      `https://graph.facebook.com/${version}/${encodeURIComponent(ownedId)}/media` +
      `?fields=${encodeURIComponent(fields)}` +
      `&limit=12` +
      `&access_token=${encodeURIComponent(ownedToken)}`;

    try {
      const res = await fetch(url);
      const json = await res.json().catch(() => ({})) as {
        data?: RawOutreachMedia[];
        error?: { message?: string; code?: number; type?: string };
      };
      if (!res.ok || json.error) {
        const mapped = mapMetaError(json.error ?? { message: `HTTP ${res.status}` });
        const detail = mapped === "COMMENTS_UNAVAILABLE" ? undefined : json.error?.message;
        await markSyncError(admin, campaign.id, organizationId, mapped, detail);
        return metaContentJson({
          ok: false,
          code: mapped,
          detail: detail ? sanitizeMetaMessage(detail) : null,
        }, 200);
      }
      media = json.data ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      await markSyncError(admin, campaign.id, organizationId, "META_ERROR", message);
      return metaContentJson({ ok: false, code: "META_ERROR" }, 200);
    }

    const collected = collectDiscoveredComments({
      media,
      competitorUsername: competitor,
      maxComments: OUTREACH_DISCOVER_COMMENT_CAP,
    });

    const { data: existingRows, error: existingError } = await admin
      .from("instagram_outreach_targets")
      .select("username, source, manual_kind, status, comment_text, comment_id, media_permalink")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaign.id);
    if (existingError) {
      await markSyncError(admin, campaign.id, organizationId, "META_ERROR", existingError.message);
      return metaContentJson({ ok: false, code: "META_ERROR" }, 200);
    }

    const existing: ExistingAudienceRow[] = ((existingRows ?? []) as Record<string, unknown>[]).map((row) => ({
      username: String(row.username),
      source: row.source as AudienceSource,
      manualKind: (row.manual_kind as ManualKind | null) ?? null,
      status: row.status as AudienceStatus,
      commentText: (row.comment_text as string | null) ?? null,
      commentId: (row.comment_id as string | null) ?? null,
      mediaPermalink: (row.media_permalink as string | null) ?? null,
    }));

    const changes = mergeDiscoveredComments(existing, collected.comments).map((change) => ({
      ...change,
      commentText: clip(change.commentText, COMMENT_TEXT_MAX),
    }));

    const inserts = changes.filter((change) => change.action === "insert").map((change) => ({
      organization_id: organizationId,
      campaign_id: campaign.id,
      username: change.username,
      source: "comment",
      manual_kind: null,
      comment_text: change.commentText,
      comment_id: change.commentId,
      media_permalink: change.mediaPermalink,
      status: "new",
    }));

    for (let i = 0; i < inserts.length; i += 100) {
      const slice = inserts.slice(i, i + 100);
      const { error } = await admin.from("instagram_outreach_targets").insert(slice);
      if (error) {
        await markSyncError(admin, campaign.id, organizationId, "META_ERROR", error.message);
        return metaContentJson({ ok: false, code: "META_ERROR" }, 200);
      }
    }

    const updates = changes.filter((change) => change.action === "update");
    for (const change of updates) {
      const { error } = await admin
        .from("instagram_outreach_targets")
        .update({
          comment_text: change.commentText,
          comment_id: change.commentId,
          media_permalink: change.mediaPermalink,
        })
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaign.id)
        .eq("username", change.username);
      if (error) {
        await markSyncError(admin, campaign.id, organizationId, "META_ERROR", error.message);
        return metaContentJson({ ok: false, code: "META_ERROR" }, 200);
      }
    }

    await admin
      .from("instagram_outreach_campaigns")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", campaign.id)
      .eq("organization_id", organizationId);

    return metaContentJson({
      ok: true,
      posts_scanned: collected.postsScanned,
      comments_seen: collected.commentsSeen,
      usernames_added: inserts.length,
      usernames_updated: updates.length,
      skipped_no_username: collected.skippedNoUsername,
      like_count_total: collected.likeCountTotal,
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("instagram-outreach-discover", message);
    return metaContentJson({ ok: false, code: "META_ERROR" }, 500);
  }
});
