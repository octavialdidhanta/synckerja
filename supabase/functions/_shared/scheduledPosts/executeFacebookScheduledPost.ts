import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import { facebookPublishScopesOk } from "../metaPlatformScopes.ts";
import {
  buildFacebookReelFallbackUrl,
  fetchFacebookReelPermalink,
  finishFacebookReelsPublish,
  startFacebookReelsUploadSession,
  uploadFacebookReelsVideo,
} from "../metaContent/metaFacebookReelsPublishApi.ts";
import { downloadGoogleDriveVideo } from "./googleDriveVideoDownload.ts";
import {
  isPlanEligibleForFacebookAutoSchedule,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
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
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, updated_at: new Date().toISOString() })
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

  let videoId = String(cfg.fb_video_id ?? "").trim();
  let uploadUrl = String(cfg.fb_upload_url ?? "").trim();
  const uploadPhase = String(cfg.fb_upload_phase ?? "").trim();

  if (videoId && uploadPhase === "uploaded") {
    const finished = await finishFacebookReelsPublish(pageId, account.pageAccessToken, {
      videoId,
      description: caption,
    });
    videoId = finished.videoId;
    const permalink = await fetchFacebookReelPermalink(videoId, account.pageAccessToken);
    const publishedUrl = permalink ?? buildFacebookReelFallbackUrl(pageId, videoId);
    const externalPostId = finished.postId ?? videoId;
    const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Facebook");

    await upsertFacebookLink(admin, plan, {
      url: publishedUrl,
      accountId: pageId,
      accountLabel,
      externalPostId,
      employeeId: cfg.employee_id,
    });

    return { published_url: publishedUrl, external_post_id: externalPostId };
  }

  if (!videoId || !uploadUrl) {
    const session = await startFacebookReelsUploadSession(pageId, account.pageAccessToken);
    videoId = session.videoId;
    uploadUrl = session.uploadUrl;
    providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
      fb_video_id: videoId,
      fb_upload_url: uploadUrl,
      fb_upload_phase: "started",
    });
  }

  if (uploadPhase !== "uploaded") {
    const driveUrl = plan.google_drive_link?.trim() ?? schedule.media_url_snapshot;
    const { bytes: videoBytes } = await downloadGoogleDriveVideo(driveUrl);
    await uploadFacebookReelsVideo(uploadUrl, account.pageAccessToken, videoBytes);
    providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
      fb_upload_phase: "uploaded",
    });
  }

  const finished = await finishFacebookReelsPublish(pageId, account.pageAccessToken, {
    videoId,
    description: caption,
  });
  videoId = finished.videoId;
  const permalink = await fetchFacebookReelPermalink(videoId, account.pageAccessToken);
  const publishedUrl = permalink ?? buildFacebookReelFallbackUrl(pageId, videoId);
  const externalPostId = finished.postId ?? videoId;
  const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Facebook");

  await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
    fb_upload_phase: "published",
  });

  await upsertFacebookLink(admin, plan, {
    url: publishedUrl,
    accountId: pageId,
    accountLabel,
    externalPostId,
    employeeId: cfg.employee_id,
  });

  return { published_url: publishedUrl, external_post_id: externalPostId };
}
