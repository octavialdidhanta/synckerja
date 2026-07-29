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
