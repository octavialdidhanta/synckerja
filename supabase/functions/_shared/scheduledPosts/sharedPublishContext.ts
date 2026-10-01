import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadGoogleDriveVideo } from "./googleDriveVideoDownload.ts";
import {
  isGoogleDriveFileLink,
  resolveGoogleDrivePublicVideoUrl,
} from "./googleDrivePublicVideoUrl.ts";

export type PreloadedDriveVideo = {
  bytes: Uint8Array;
  mimeType: string;
};

export type SharedPublishContext = {
  driveUrl: string;
  /** Public direct download URL for TikTok PULL_FROM_URL */
  drivePublicDownloadUrl: string | null;
  preloadedVideo?: PreloadedDriveVideo;
};

const PLATFORMS_NEEDING_BYTES = new Set([
  "YouTube",
  "Instagram",
  "Facebook",
  "LinkedIn",
]);

/** TikTok may use pull-only when sole platform and pull succeeds; preload needed for fallback/mixed batch. */
export function planPublishNeedsPreloadedVideo(platforms: string[]): boolean {
  const normalized = platforms.map((p) => p.trim());
  if (normalized.some((p) => PLATFORMS_NEEDING_BYTES.has(p))) return true;
  if (!normalized.includes("TikTok")) return false;
  return normalized.length > 1 || !isTikTokPullFromUrlEnabled();
}

export function isTikTokPullFromUrlEnabled(): boolean {
  const raw = Deno.env.get("TIKTOK_PULL_FROM_URL_ENABLED");
  if (raw === undefined || raw === "") return true;
  return raw.toLowerCase() === "true" || raw === "1";
}

export function isPlanPublishSequential(): boolean {
  const raw = Deno.env.get("PLAN_PUBLISH_SEQUENTIAL");
  return raw?.toLowerCase() === "true" || raw === "1";
}

/**
 * Instagram Reels upload to rupload fails with HTTP 400 when it runs in the
 * same moment as Facebook (same Meta app). A later solo retry succeeds, which
 * is why the row sits on Scheduled for several minutes. Upload Instagram after
 * the other platforms in the same job. A container that is already uploaded
 * only needs media_publish and can stay in the parallel batch.
 */
export function instagramPublishShouldFollowPeers(row: {
  platform: string;
  provider_config?: Record<string, unknown> | null;
}): boolean {
  if (row.platform !== "Instagram") return false;
  const phase = String(row.provider_config?.ig_upload_phase ?? "").trim();
  return phase !== "uploaded";
}

/** Each parallel upload must own its bytes. A shared Uint8Array can be detached by the first fetch. */
export function cloneSharedPublishContext(ctx: SharedPublishContext): SharedPublishContext {
  if (!ctx.preloadedVideo) {
    return { driveUrl: ctx.driveUrl, drivePublicDownloadUrl: ctx.drivePublicDownloadUrl };
  }
  return {
    driveUrl: ctx.driveUrl,
    drivePublicDownloadUrl: ctx.drivePublicDownloadUrl,
    preloadedVideo: {
      bytes: ctx.preloadedVideo.bytes.slice(),
      mimeType: ctx.preloadedVideo.mimeType,
    },
  };
}

export async function buildSharedPublishContext(
  driveUrl: string,
  platforms: string[],
): Promise<SharedPublishContext> {
  const trimmed = driveUrl?.trim() ?? "";
  if (!trimmed || !isGoogleDriveFileLink(trimmed)) {
    throw new Error("invalid_google_drive_video_url");
  }

  const drivePublicDownloadUrl = resolveGoogleDrivePublicVideoUrl(trimmed);
  const ctx: SharedPublishContext = {
    driveUrl: trimmed,
    drivePublicDownloadUrl,
  };

  if (planPublishNeedsPreloadedVideo(platforms)) {
    const { bytes, mimeType } = await downloadGoogleDriveVideo(trimmed);
    ctx.preloadedVideo = { bytes, mimeType };
  }

  return ctx;
}

export async function resolveDriveUrlFromPlan(
  admin: SupabaseClient,
  planId: string,
  fallbackSnapshot?: string | null,
): Promise<string> {
  const { data, error } = await admin
    .from("social_media_plans")
    .select("google_drive_link")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const link = String(data?.google_drive_link ?? "").trim() || String(fallbackSnapshot ?? "").trim();
  if (!link) throw new Error("google_drive_link");
  return link;
}

export async function resolveVideoBytesForUpload(
  driveUrl: string,
  sharedCtx?: SharedPublishContext,
): Promise<PreloadedDriveVideo> {
  if (sharedCtx?.preloadedVideo) {
    return sharedCtx.preloadedVideo;
  }
  const { bytes, mimeType } = await downloadGoogleDriveVideo(driveUrl);
  return { bytes, mimeType };
}
