import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  parseYouTubeOAuthScopes,
  youtubeContentScopesIncludeUpload,
} from "../youtubeContentAuth.ts";
import { getYouTubeContentAccessToken } from "../youtubeContentOrgResolver.ts";
import {
  appendShortsHashtag,
  assertYouTubeVideoOwnedByChannelWithRetry,
  buildYouTubePublishedUrl,
  computeYouTubeUploadChunkPlan,
  initYouTubeResumableUpload,
  mapSchedulePrivacyToYouTube,
  pollYouTubeVideoUntilProcessed,
  uploadYouTubeVideoChunks,
} from "../youtubeContent/youtubeContentPublishApi.ts";
import { downloadGoogleDriveVideo } from "./googleDriveVideoDownload.ts";
import {
  isPlanEligibleForYouTubeAutoSchedule,
  isReelContentType,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
import { resolveVideoBytesForUpload, type SharedPublishContext } from "./sharedPublishContext.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import type { ScheduledPostRow, YouTubeProviderConfig } from "./scheduledPostTypes.ts";
import { DEFAULT_YOUTUBE_SCHEDULE_PRIVACY } from "./normalizeYouTubeSchedulePrivacy.ts";

type PlanRow = {
  id: string;
  organization_id: string;
  post_date: string | null;
  approved: boolean;
  production_approved: boolean;
  google_drive_link: string | null;
  post_link_created_by: string | null;
  content_type?: { name?: string } | null;
};

async function loadPlan(admin: SupabaseClient, planId: string): Promise<PlanRow | null> {
  const { data, error } = await admin
    .from("social_media_plans")
    .select(
      "id, organization_id, post_date, approved, production_approved, google_drive_link, post_link_created_by, content_type:content_types(name)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlanRow;
}

function planEligibilityInput(plan: PlanRow) {
  return {
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: plan.content_type?.name ?? null,
  };
}

async function persistYouTubeProviderConfig(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
  patch: Partial<YouTubeProviderConfig>,
): Promise<Record<string, unknown>> {
  const next = { ...base, ...patch };
  await admin
    .from("social_media_scheduled_posts")
    .update({
      provider_config: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);
  return next;
}

async function upsertYouTubeLink(
  admin: SupabaseClient,
  plan: PlanRow,
  args: {
    url: string;
    channelId: string;
    accountLabel: string;
    externalPostId: string;
    employeeId?: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("social_media_links")
    .select("id")
    .eq("social_media_plan_id", plan.id)
    .eq("platform", "YouTube")
    .maybeSingle();

  const payload = {
    platform: "YouTube",
    url: args.url,
    social_media_name: args.accountLabel,
    external_post_id: args.externalPostId,
    platform_account_open_id: args.channelId,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await admin.from("social_media_links").update(payload).eq("id", existing.id);
  } else {
    await admin.from("social_media_links").insert({
      ...payload,
      social_media_plan_id: plan.id,
    });

    if (!plan.post_link_created_by) {
      const employeeId = String(args.employeeId ?? "").trim();
      if (employeeId) {
        await admin
          .from("social_media_plans")
          .update({ post_link_created_by: employeeId })
          .eq("id", plan.id);
      }
    }
  }

  await syncPlanCompletionStateForPlan(admin, plan.id);
}

async function finalizeYouTubePublish(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  plan: PlanRow,
  channelId: string,
  videoId: string,
  cfg: YouTubeProviderConfig,
  verified?: { channelTitle?: string; privacyStatus?: string | null },
): Promise<{ published_url: string; external_post_id: string }> {
  const { data: account } = await admin
    .from("organization_youtube_content_accounts")
    .select("label, display_name")
    .eq("organization_id", schedule.organization_id)
    .eq("channel_id", channelId)
    .maybeSingle();

  const accountLabel = String(
    cfg.account_label ?? account?.display_name ?? account?.label ?? "YouTube",
  );
  const publishedUrl = buildYouTubePublishedUrl(videoId);

  await upsertYouTubeLink(admin, plan, {
    url: publishedUrl,
    channelId,
    accountLabel,
    externalPostId: videoId,
    employeeId: cfg.employee_id,
  });

  if (verified?.channelTitle || verified?.privacyStatus) {
    await persistYouTubeProviderConfig(
      admin,
      schedule.id,
      schedule.provider_config as Record<string, unknown>,
      {
        published_channel_id: channelId,
        ...(verified.channelTitle ? { published_channel_title: verified.channelTitle } : {}),
        ...(verified.privacyStatus ? { published_privacy_status: verified.privacyStatus } : {}),
      },
    );
  }

  return { published_url: publishedUrl, external_post_id: videoId };
}

export async function executeYouTubeScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  sharedCtx?: SharedPublishContext,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");

  if (!isPlanEligibleForYouTubeAutoSchedule(planEligibilityInput(plan))) {
    throw new Error("plan_not_eligible");
  }

  if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
    throw new Error("google_drive_link_changed");
  }

  const cfg = schedule.provider_config as YouTubeProviderConfig;
  const channelId = String(cfg.channel_id ?? "").trim();
  if (!channelId) throw new Error("missing_channel_id");

  const accessToken = await getYouTubeContentAccessToken(
    admin,
    schedule.organization_id,
    channelId,
  );
  if (!accessToken) {
    throw new Error("youtube_token_missing: Re-authorize YouTube in Digital Marketing settings");
  }

  const { data: tokenRow } = await admin
    .from("organization_youtube_content_connection_tokens")
    .select("oauth_scopes")
    .eq("organization_id", schedule.organization_id)
    .eq("channel_id", channelId)
    .maybeSingle();

  const scopes = parseYouTubeOAuthScopes(tokenRow?.oauth_scopes);
  if (!youtubeContentScopesIncludeUpload(scopes)) {
    throw new Error("upload_scopes_not_granted");
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };

  if (cfg.youtube_video_id) {
    const verified = await assertYouTubeVideoOwnedByChannelWithRetry(
      accessToken,
      cfg.youtube_video_id,
      channelId,
    );
    await pollYouTubeVideoUntilProcessed(accessToken, cfg.youtube_video_id);
    return finalizeYouTubePublish(
      admin,
      schedule,
      plan,
      channelId,
      cfg.youtube_video_id,
      cfg,
      verified,
    );
  }

  const title = schedule.title?.trim() || plan.content_type?.name?.trim() || "Synckerja Reel";
  const isReel = isReelContentType(plan.content_type?.name);
  const description = appendShortsHashtag(
    schedule.caption?.trim() || schedule.title?.trim() || "",
    isReel,
  );
  const privacyStatus = mapSchedulePrivacyToYouTube(
    schedule.privacy_level ?? DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
  );

  const driveUrl = plan.google_drive_link?.trim() ?? schedule.media_url_snapshot;
  const { bytes: videoBytes, mimeType } = await resolveVideoBytesForUpload(driveUrl, sharedCtx);
  const chunkPlan = computeYouTubeUploadChunkPlan(videoBytes.byteLength);

  let uploadUrl = String(cfg.youtube_upload_url ?? "").trim();
  let startByte = Number(cfg.youtube_upload_bytes_sent ?? 0);

  if (!uploadUrl) {
    const init = await initYouTubeResumableUpload(accessToken, {
      title,
      description,
      privacyStatus,
      videoSize: videoBytes.byteLength,
      mimeType,
    });
    uploadUrl = init.uploadUrl;
    startByte = 0;
    providerConfig = await persistYouTubeProviderConfig(admin, schedule.id, providerConfig, {
      youtube_upload_url: uploadUrl,
      youtube_upload_bytes_sent: 0,
      youtube_upload_completed: false,
    });
  }

  const { videoId } = await uploadYouTubeVideoChunks(
    uploadUrl,
    accessToken,
    videoBytes,
    chunkPlan,
    mimeType,
    startByte,
  );

  providerConfig = await persistYouTubeProviderConfig(admin, schedule.id, providerConfig, {
    youtube_upload_completed: true,
    youtube_upload_bytes_sent: videoBytes.byteLength,
    youtube_video_id: videoId,
  });

  const verified = await assertYouTubeVideoOwnedByChannelWithRetry(accessToken, videoId, channelId);
  await pollYouTubeVideoUntilProcessed(accessToken, videoId);

  return finalizeYouTubePublish(admin, schedule, plan, channelId, videoId, cfg, verified);
}
