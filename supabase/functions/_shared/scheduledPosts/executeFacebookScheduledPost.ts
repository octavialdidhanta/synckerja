import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import { facebookPublishScopesOk } from "../metaPlatformScopes.ts";
import {
  buildFacebookReelFallbackUrl,
  classifyFacebookReelStatus,
  fetchFacebookReelPermalink,
  fetchFacebookReelStatus,
  finishFacebookReelsPublish,
  startFacebookReelsUploadSession,
  uploadFacebookReelsFromUrl,
  uploadFacebookReelsVideo,
  waitForFacebookReelUpload,
  type FacebookReelProgress,
} from "../metaContent/metaFacebookReelsPublishApi.ts";
import { downloadGoogleDriveVideo } from "./googleDriveVideoDownload.ts";
import { resolveGoogleDrivePublicVideoUrl } from "./googleDrivePublicVideoUrl.ts";
import { touchPublishingHeartbeat } from "./publishingHeartbeat.ts";
import {
  isPlanEligibleForFacebookAutoSchedule,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
import { resolveVideoBytesForUpload, type SharedPublishContext } from "./sharedPublishContext.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import type { FacebookProviderConfig, ScheduledPostRow } from "./scheduledPostTypes.ts";

type PlanRow = {
  id: string;
  organization_id: string;
  post_date: string | null;
  post_link_created_by: string | null;
  approved: boolean;
  production_approved: boolean;
  google_drive_link: string | null;
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

async function persistFacebookProviderConfig(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
  patch: Partial<FacebookProviderConfig>,
): Promise<Record<string, unknown>> {
  const next = { ...base, ...patch };
  const now = new Date().toISOString();
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, locked_at: now, updated_at: now })
    .eq("id", scheduleId);
  return next;
}

async function upsertFacebookLink(
  admin: SupabaseClient,
  plan: PlanRow,
  args: {
    url: string;
    accountId: string;
    accountLabel: string;
    externalPostId: string;
    employeeId?: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("social_media_links")
    .select("id")
    .eq("social_media_plan_id", plan.id)
    .eq("platform", "Facebook")
    .maybeSingle();

  const payload = {
    platform: "Facebook",
    url: args.url,
    social_media_name: args.accountLabel,
    external_post_id: args.externalPostId,
    platform_account_open_id: args.accountId,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await admin.from("social_media_links").update(payload).eq("id", existing.id);
  } else {
    await admin.from("social_media_links").insert({ ...payload, social_media_plan_id: plan.id });
    if (!plan.post_link_created_by && args.employeeId) {
      await admin
        .from("social_media_plans")
        .update({ post_link_created_by: args.employeeId })
        .eq("id", plan.id);
    }
  }

  await syncPlanCompletionStateForPlan(admin, plan.id);
}

export async function executeFacebookScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  sharedCtx?: SharedPublishContext,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");
  if (!isPlanEligibleForFacebookAutoSchedule(planEligibilityInput(plan))) {
    throw new Error("plan_not_eligible");
  }
  if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
    throw new Error("google_drive_link_changed");
  }

  const cfg = schedule.provider_config as FacebookProviderConfig;
  const pageId = String(cfg.facebook_page_id ?? "").trim();
  if (!pageId) throw new Error("missing_facebook_page_id");

  const account = await resolveMetaContentAccount(
    admin,
    schedule.organization_id,
    "facebook",
    pageId,
  );
  if (!account?.pageAccessToken) {
    throw new Error("facebook_page_not_found");
  }
  if (!facebookPublishScopesOk(account.grantedScopes)) {
    throw new Error("publish_scopes_not_granted");
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };
  const caption = schedule.caption?.trim() || schedule.title?.trim() || "";
  const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Facebook");

  const finalize = async (finalVideoId: string, postId: string | null) => {
    const permalink = await fetchFacebookReelPermalink(finalVideoId, account.pageAccessToken);
    const publishedUrl = permalink ?? buildFacebookReelFallbackUrl(pageId, finalVideoId);
    const externalPostId = postId ?? finalVideoId;
    await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
      fb_upload_phase: "published",
      fb_published_video_id: finalVideoId,
      publish_step: "processing",
    });
    await upsertFacebookLink(admin, plan, {
      url: publishedUrl,
      accountId: pageId,
      accountLabel,
      externalPostId,
      employeeId: cfg.employee_id,
    });
    return { published_url: publishedUrl, external_post_id: externalPostId };
  };

  let videoId = String(cfg.fb_video_id ?? "").trim();
  let uploadUrl = String(cfg.fb_upload_url ?? "").trim();
  let sessionCreatedNow = false;
  let progress: FacebookReelProgress = String(cfg.fb_upload_phase ?? "").trim() === "uploaded"
    ? "upload_complete"
    : "upload_needed";

  if (videoId) {
    try {
      const remote = await fetchFacebookReelStatus(videoId, account.pageAccessToken);
      progress = classifyFacebookReelStatus(remote);
      console.info(
        `facebook_status scheduleId=${schedule.id} videoId=${videoId} uploading=${remote.uploading} processing=${remote.processing} publishing=${remote.publishing} progress=${progress}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `facebook_status_unavailable scheduleId=${schedule.id} reason=${message.slice(0, 180)}`,
      );
    }
  }

  if (videoId && progress === "published") {
    return finalize(videoId, null);
  }

  if (progress === "error" || !videoId || (progress === "upload_needed" && !uploadUrl)) {
    const session = await startFacebookReelsUploadSession(pageId, account.pageAccessToken);
    videoId = session.videoId;
    uploadUrl = session.uploadUrl;
    progress = "upload_needed";
    sessionCreatedNow = true;
    providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
      fb_video_id: videoId,
      fb_upload_url: uploadUrl,
      fb_upload_phase: "started",
      publish_step: "uploading",
    });
  }

  if (progress === "upload_needed") {
    const driveUrl = plan.google_drive_link?.trim() || schedule.media_url_snapshot || "";
    const publicUrl = resolveGoogleDrivePublicVideoUrl(driveUrl);
    const heartbeat = () => touchPublishingHeartbeat(admin, [schedule.id]);

    if (publicUrl) {
      // A session left on "started" already has a binary upload attached. file_url needs a clean session.
      if (!sessionCreatedNow) {
        const session = await startFacebookReelsUploadSession(pageId, account.pageAccessToken);
        videoId = session.videoId;
        uploadUrl = session.uploadUrl;
        providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
          fb_video_id: videoId,
          fb_upload_url: uploadUrl,
          fb_upload_phase: "started",
          publish_step: "uploading",
        });
      }
      try {
        await uploadFacebookReelsFromUrl(uploadUrl, account.pageAccessToken, publicUrl);
        providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
          fb_upload_phase: "transfer",
          publish_step: "processing",
        });
        const waited = await waitForFacebookReelUpload(videoId, account.pageAccessToken, {
          onTick: heartbeat,
        });
        if (waited === "error") throw new Error("fb_file_url_processing_error");
        if (waited === "published") return finalize(videoId, null);
        progress = "upload_complete";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `facebook_file_url_fallback scheduleId=${schedule.id} reason=${message.slice(0, 180)}`,
        );
        const session = await startFacebookReelsUploadSession(pageId, account.pageAccessToken);
        videoId = session.videoId;
        uploadUrl = session.uploadUrl;
        providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
          fb_video_id: videoId,
          fb_upload_url: uploadUrl,
          fb_upload_phase: "started",
          publish_step: "uploading",
        });
        const { bytes: videoBytes } = await resolveVideoBytesForUpload(driveUrl, sharedCtx);
        await uploadFacebookReelsVideo(uploadUrl, account.pageAccessToken, videoBytes);
        progress = "upload_complete";
      }
    } else {
      providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
        publish_step: "uploading",
      });
      const { bytes: videoBytes } = await resolveVideoBytesForUpload(driveUrl, sharedCtx);
      await uploadFacebookReelsVideo(uploadUrl, account.pageAccessToken, videoBytes);
      progress = "upload_complete";
    }

    providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
      fb_upload_phase: "uploaded",
      publish_step: "processing",
    });
  }

  providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
    publish_step: "processing",
  });
  const finished = await finishFacebookReelsPublish(pageId, account.pageAccessToken, {
    videoId,
    description: caption,
  });
  return finalize(finished.videoId, finished.postId);
}
