import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tiktokContentScopesIncludePublish } from "../tiktokContentAuth.ts";
import { getTikTokPublishAccessToken } from "../tiktokContentOrgResolver.ts";
import {
  assertTikTokPublicPrivacyAvailable,
  classifyTikTokPublishProgress,
  computeTikTokFileUploadChunkPlan,
  deriveTikTokPostInteractionFromCreator,
  fetchTikTokPublishStatus,
  initTikTokVideoPublishFileUpload,
  initTikTokVideoPublishPullFromUrl,
  pollTikTokPublishUntilPublicPostId,
  queryTikTokCreatorInfo,
  resolveTikTokPublishPrivacyLevel,
  uploadTikTokVideoChunks,
} from "../tiktokContent/tiktokContentPublishApi.ts";
import {
  isPlanEligibleForTikTokAutoSchedule,
  shouldCancelScheduleDueToDriveMismatch,
} from "../scheduledPosts/scheduledPostEligibility.ts";
import { touchPublishingHeartbeat } from "../scheduledPosts/publishingHeartbeat.ts";
import {
  isTikTokPullFromUrlEnabled,
  resolveVideoBytesForUpload,
  type SharedPublishContext,
} from "../scheduledPosts/sharedPublishContext.ts";
import { syncPlanCompletionStateForPlan } from "../scheduledPosts/syncPlanCompletionStateDb.ts";
import type { ScheduledPostRow } from "../scheduledPosts/scheduledPostTypes.ts";
import { DEFAULT_PRIVACY_LEVEL } from "../scheduledPosts/scheduledPostTypes.ts";

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

type TikTokProviderConfigExt = {
  open_id?: string;
  account_label?: string;
  employee_id?: string;
  tiktok_publish_id?: string;
  tiktok_upload_url?: string;
  tiktok_upload_completed?: boolean;
  tiktok_privacy_level_used?: string;
  publish_step?: string;
};

function isUploadCompletedFlag(value: unknown): boolean {
  return value === true || value === "true";
}

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

async function persistTikTokProviderConfig(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
  patch: Partial<TikTokProviderConfigExt>,
): Promise<Record<string, unknown>> {
  const next = { ...base, ...patch };
  const now = new Date().toISOString();
  await admin
    .from("social_media_scheduled_posts")
    .update({
      provider_config: next,
      locked_at: now,
      updated_at: now,
    })
    .eq("id", scheduleId);
  return next;
}

async function upsertTikTokLink(
  admin: SupabaseClient,
  plan: PlanRow,
  args: {
    url: string;
    openId: string;
    accountLabel: string;
    externalPostId: string | null;
    scheduledBy: string | null;
    employeeId?: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("social_media_links")
    .select("id")
    .eq("social_media_plan_id", plan.id)
    .eq("platform", "TikTok")
    .maybeSingle();

  const payload = {
    platform: "TikTok",
    url: args.url,
    social_media_name: args.accountLabel,
    external_post_id: args.externalPostId,
    platform_account_open_id: args.openId,
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

async function finalizeTikTokPublish(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  plan: PlanRow,
  openId: string,
  externalPostId: string,
  creatorUsername?: string,
): Promise<{ published_url: string; external_post_id: string }> {
  const cfg = schedule.provider_config as TikTokProviderConfigExt;
  const { data: account } = await admin
    .from("organization_tiktok_content_accounts")
    .select("label, display_name")
    .eq("organization_id", schedule.organization_id)
    .eq("open_id", openId)
    .maybeSingle();

  const accountLabel = String(
    cfg.account_label ?? account?.display_name ?? account?.label ?? "TikTok",
  );

  let publishedUrl =
    `https://www.tiktok.com/@${creatorUsername ?? "user"}/video/${externalPostId}`;
  if (externalPostId && !publishedUrl.includes(externalPostId)) {
    publishedUrl = `https://www.tiktok.com/video/${externalPostId}`;
  }

  await upsertTikTokLink(admin, plan, {
    url: publishedUrl,
    openId,
    accountLabel,
    externalPostId,
    scheduledBy: schedule.scheduled_by,
    employeeId: cfg.employee_id,
  });

  return { published_url: publishedUrl, external_post_id: externalPostId };
}

async function clearTikTokUploadAttempt(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const next = { ...base };
  delete next.tiktok_publish_id;
  delete next.tiktok_upload_url;
  delete next.tiktok_upload_completed;
  delete next.tiktok_privacy_level_used;
  const now = new Date().toISOString();
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, locked_at: now, updated_at: now })
    .eq("id", scheduleId);
  return next;
}

async function publishTikTokViaFileUpload(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  plan: PlanRow,
  openId: string,
  publishAccessToken: string,
  providerConfig: Record<string, unknown>,
  videoBytes: Uint8Array,
  mimeType: string,
  caption: string,
  privacyLevel: string,
  interaction: ReturnType<typeof deriveTikTokPostInteractionFromCreator>,
  creatorUsername?: string,
): Promise<{ published_url: string; external_post_id: string }> {
  const chunkPlan = computeTikTokFileUploadChunkPlan(videoBytes.byteLength);
  const initResult = await initTikTokVideoPublishFileUpload(publishAccessToken, {
    videoSize: videoBytes.byteLength,
    chunkSize: chunkPlan.chunkSize,
    totalChunkCount: chunkPlan.totalChunkCount,
    caption,
    privacyLevel,
    disableComment: interaction.disableComment,
    disableDuet: interaction.disableDuet,
    disableStitch: interaction.disableStitch,
  });

  providerConfig = await persistTikTokProviderConfig(admin, schedule.id, providerConfig, {
    tiktok_publish_id: initResult.publish_id,
    tiktok_upload_url: String(initResult.upload_url),
    tiktok_upload_completed: false,
    tiktok_privacy_level_used: privacyLevel,
    publish_step: "uploading",
  });

  await uploadTikTokVideoChunks(
    String(initResult.upload_url),
    videoBytes,
    chunkPlan,
    mimeType,
    { onChunk: () => touchPublishingHeartbeat(admin, [schedule.id]) },
  );

  providerConfig = await persistTikTokProviderConfig(admin, schedule.id, providerConfig, {
    tiktok_upload_completed: true,
    publish_step: "processing",
  });

  const { publicPostId } = await pollTikTokPublishUntilPublicPostId(
    publishAccessToken,
    initResult.publish_id,
    { onTick: () => touchPublishingHeartbeat(admin, [schedule.id]) },
  );

  return finalizeTikTokPublish(
    admin,
    schedule,
    plan,
    openId,
    publicPostId,
    creatorUsername,
  );
}

export async function executeTikTokScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  sharedCtx?: SharedPublishContext,
): Promise<{ published_url: string; external_post_id: string | null; tiktok_publish_path?: "pull" | "file_upload" }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");

  if (!isPlanEligibleForTikTokAutoSchedule(planEligibilityInput(plan))) {
    throw new Error("plan_not_eligible");
  }

  if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
    throw new Error("google_drive_link_changed");
  }

  const cfg = schedule.provider_config as TikTokProviderConfigExt;
  const openId = String(cfg.open_id ?? "").trim();
  if (!openId) throw new Error("missing_open_id");

  const publishAccessToken = await getTikTokPublishAccessToken(
    admin,
    schedule.organization_id,
    openId,
  );
  if (!publishAccessToken) {
    throw new Error(
      "publish_login_kit_token_missing: Re-authorize TikTok publishing in Digital Marketing settings",
    );
  }

  const scopes = await admin
    .from("organization_tiktok_content_connection_tokens")
    .select("oauth_scopes, publish_oauth_scopes")
    .eq("organization_id", schedule.organization_id)
    .eq("open_id", openId)
    .maybeSingle();

  const scopeForPublish = (scopes.data?.publish_oauth_scopes as string | null) ??
    (scopes.data?.oauth_scopes as string | null);
  if (!tiktokContentScopesIncludePublish(scopeForPublish)) {
    throw new Error("publish_scopes_not_granted");
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };

  const heartbeat = () => touchPublishingHeartbeat(admin, [schedule.id]);

  const finishFromPublishId = async (publishId: string) => {
    providerConfig = await persistTikTokProviderConfig(admin, schedule.id, providerConfig, {
      tiktok_publish_id: publishId,
      tiktok_upload_completed: true,
      publish_step: "processing",
    });
    const { publicPostId } = await pollTikTokPublishUntilPublicPostId(
      publishAccessToken,
      publishId,
      { onTick: heartbeat },
    );
    let creatorUsername: string | undefined;
    try {
      const creatorInfo = await queryTikTokCreatorInfo(publishAccessToken);
      creatorUsername = creatorInfo.creator_username;
    } catch {
      creatorUsername = undefined;
    }
    return finalizeTikTokPublish(
      admin,
      schedule,
      plan,
      openId,
      publicPostId,
      creatorUsername,
    );
  };

  if (cfg.tiktok_publish_id && isUploadCompletedFlag(cfg.tiktok_upload_completed)) {
    return finishFromPublishId(cfg.tiktok_publish_id);
  }

  if (cfg.tiktok_publish_id && !isUploadCompletedFlag(cfg.tiktok_upload_completed)) {
    const status = await fetchTikTokPublishStatus(publishAccessToken, cfg.tiktok_publish_id);
    const progress = classifyTikTokPublishProgress(status);
    console.info(
      `tiktok_incomplete_status scheduleId=${schedule.id} publishId=${cfg.tiktok_publish_id} status=${status.status ?? ""} uploaded_bytes=${status.uploaded_bytes ?? 0} progress=${progress}`,
    );

    if (progress === "complete" || progress === "uploaded") {
      return finishFromPublishId(cfg.tiktok_publish_id);
    }

    const savedUploadUrl = String(providerConfig.tiktok_upload_url ?? "").trim();
    if (progress === "awaiting_bytes" && savedUploadUrl) {
      const driveUrl = plan.google_drive_link?.trim() ?? schedule.media_url_snapshot;
      const { bytes: videoBytes, mimeType } = await resolveVideoBytesForUpload(driveUrl, sharedCtx);
      const chunkPlan = computeTikTokFileUploadChunkPlan(videoBytes.byteLength);
      try {
        providerConfig = await persistTikTokProviderConfig(admin, schedule.id, providerConfig, {
          publish_step: "uploading",
        });
        await uploadTikTokVideoChunks(savedUploadUrl, videoBytes, chunkPlan, mimeType, {
          onChunk: heartbeat,
        });
        return finishFromPublishId(cfg.tiktok_publish_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `tiktok_upload_restart scheduleId=${schedule.id} reason=${message.slice(0, 180)}`,
        );
      }
    } else {
      console.info(
        `tiktok_upload_restart scheduleId=${schedule.id} progress=${progress} has_upload_url=${savedUploadUrl.length > 0}`,
      );
    }

    providerConfig = await clearTikTokUploadAttempt(admin, schedule.id, providerConfig);
  }

  const driveUrl = plan.google_drive_link?.trim() ?? schedule.media_url_snapshot;
  const creatorInfo = await queryTikTokCreatorInfo(publishAccessToken);
  const requestedPrivacy = schedule.privacy_level ?? DEFAULT_PRIVACY_LEVEL;
  assertTikTokPublicPrivacyAvailable(requestedPrivacy, creatorInfo);
  const privacyLevel = resolveTikTokPublishPrivacyLevel(requestedPrivacy, creatorInfo);
  const caption = schedule.caption?.trim() || schedule.title?.trim() || " ";
  const interaction = deriveTikTokPostInteractionFromCreator(creatorInfo);

  const pullUrl = sharedCtx?.drivePublicDownloadUrl ?? null;
  const pullEnabled = isTikTokPullFromUrlEnabled();

  if (pullEnabled && pullUrl) {
    try {
      const initResult = await initTikTokVideoPublishPullFromUrl(publishAccessToken, {
        videoUrl: pullUrl,
        caption,
        privacyLevel,
        disableComment: interaction.disableComment,
        disableDuet: interaction.disableDuet,
        disableStitch: interaction.disableStitch,
      });

      providerConfig = await persistTikTokProviderConfig(admin, schedule.id, providerConfig, {
        tiktok_publish_id: initResult.publish_id,
        tiktok_upload_completed: true,
        tiktok_privacy_level_used: privacyLevel,
        publish_step: "processing",
      });

      const { publicPostId } = await pollTikTokPublishUntilPublicPostId(
        publishAccessToken,
        initResult.publish_id,
        { onTick: heartbeat },
      );

      console.info(
        `tiktok_publish_path=pull scheduleId=${schedule.id} publishId=${initResult.publish_id}`,
      );

      return {
        ...await finalizeTikTokPublish(
          admin,
          schedule,
          plan,
          openId,
          publicPostId,
          creatorInfo.creator_username,
        ),
        tiktok_publish_path: "pull",
      };
    } catch (pullErr) {
      const reason = pullErr instanceof Error ? pullErr.message : String(pullErr);
      console.warn(
        `tiktok_pull_from_url_fallback scheduleId=${schedule.id} reason=${reason.slice(0, 180)}`,
      );
    }
  }

  const { bytes: videoBytes, mimeType } = await resolveVideoBytesForUpload(driveUrl, sharedCtx);
  console.info(`tiktok_publish_path=file_upload scheduleId=${schedule.id} bytes=${videoBytes.byteLength}`);

  const fileUploadResult = await publishTikTokViaFileUpload(
    admin,
    schedule,
    plan,
    openId,
    publishAccessToken,
    providerConfig,
    videoBytes,
    mimeType,
    caption,
    privacyLevel,
    interaction,
    creatorInfo.creator_username,
  );

  return { ...fileUploadResult, tiktok_publish_path: "file_upload" };
}
