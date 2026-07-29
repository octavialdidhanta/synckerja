import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import {
  buildInstagramReelsFallbackUrl,
  createInstagramReelsContainer,
  fetchInstagramMediaPermalink,
  publishInstagramReelsContainer,
  uploadInstagramReelsVideo,
  waitForInstagramReelsContainerReady,
} from "../metaContent/metaReelsPublishApi.ts";
import {
  isPlanEligibleForInstagramAutoSchedule,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
import { resolveVideoBytesForUpload, type SharedPublishContext } from "./sharedPublishContext.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import type { InstagramProviderConfig, ScheduledPostRow } from "./scheduledPostTypes.ts";

const INSTAGRAM_PUBLISH_SCOPES = ["instagram_content_publish"] as const;

function metaScopesIncludePublish(granted: string[]): boolean {
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return INSTAGRAM_PUBLISH_SCOPES.every((s) => grantedSet.has(s.toLowerCase()));
}

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

async function persistInstagramProviderConfig(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
  patch: Partial<InstagramProviderConfig>,
): Promise<Record<string, unknown>> {
  const next = { ...base, ...patch };
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, updated_at: new Date().toISOString() })
    .eq("id", scheduleId);
  return next;
}

async function clearInstagramUploadState(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const next = { ...base };
  delete next.ig_container_id;
  delete next.ig_upload_phase;
  delete next.ig_upload_session_id;
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, updated_at: new Date().toISOString() })
    .eq("id", scheduleId);
  return next;
}

function isFatalInstagramContainerError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("meta_reels_container_error") ||
    m.includes("meta_reels_container_expired")
  );
}

async function publishInstagramContainerWhenReady(
  admin: SupabaseClient,
  scheduleId: string,
  providerConfig: Record<string, unknown>,
  args: {
    igAccountId: string;
    pageAccessToken: string;
    containerId: string;
  },
): Promise<{ mediaId: string }> {
  try {
    await waitForInstagramReelsContainerReady(args.containerId, args.pageAccessToken);
    return await publishInstagramReelsContainer(
      args.igAccountId,
      args.pageAccessToken,
      args.containerId,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isFatalInstagramContainerError(message)) {
      await clearInstagramUploadState(admin, scheduleId, providerConfig);
    }
    throw err;
  }
}

async function upsertInstagramLink(
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
    .eq("platform", "Instagram")
    .maybeSingle();

  const payload = {
    platform: "Instagram",
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

export async function executeInstagramScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  sharedCtx?: SharedPublishContext,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");
  if (!isPlanEligibleForInstagramAutoSchedule(planEligibilityInput(plan))) {
    throw new Error("plan_not_eligible");
  }
  if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
    throw new Error("google_drive_link_changed");
  }

  const cfg = schedule.provider_config as InstagramProviderConfig;
  const igAccountId = String(cfg.instagram_business_account_id ?? "").trim();
  if (!igAccountId) throw new Error("missing_instagram_business_account_id");

  const account = await resolveMetaContentAccount(
    admin,
    schedule.organization_id,
    "instagram",
    igAccountId,
  );
  if (!account?.pageAccessToken) {
    throw new Error("instagram_account_not_found");
  }
  if (!metaScopesIncludePublish(account.grantedScopes)) {
    throw new Error("publish_scopes_not_granted");
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };
  const caption = schedule.caption?.trim() || schedule.title?.trim() || "";
  const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Instagram");

  const finishPublished = async (mediaId: string) => {
    const permalink = await fetchInstagramMediaPermalink(mediaId, account.pageAccessToken);
    const publishedUrl = permalink ?? buildInstagramReelsFallbackUrl(mediaId);
    await upsertInstagramLink(admin, plan, {
      url: publishedUrl,
      accountId: igAccountId,
      accountLabel,
      externalPostId: mediaId,
      employeeId: cfg.employee_id,
    });
    return { published_url: publishedUrl, external_post_id: mediaId };
  };

  if (cfg.ig_container_id && cfg.ig_upload_phase === "uploaded") {
    const { mediaId } = await publishInstagramContainerWhenReady(
      admin,
      schedule.id,
      providerConfig,
      {
        igAccountId,
        pageAccessToken: account.pageAccessToken,
        containerId: cfg.ig_container_id,
      },
    );
    return finishPublished(mediaId);
  }

  const driveUrl = plan.google_drive_link?.trim() ?? schedule.media_url_snapshot;
  const { bytes: videoBytes } = await resolveVideoBytesForUpload(driveUrl, sharedCtx);

  let containerId = String(cfg.ig_container_id ?? "").trim();
  let uploadUri = "";

  if (!containerId) {
    const container = await createInstagramReelsContainer(
      igAccountId,
      account.pageAccessToken,
      { caption },
    );
    containerId = container.containerId;
    uploadUri = container.uploadUri;
    providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
      ig_container_id: containerId,
      ig_upload_session_id: uploadUri,
      ig_upload_phase: "created",
    });
  }

  if (cfg.ig_upload_phase !== "uploaded") {
    if (!uploadUri && cfg.ig_upload_session_id) {
      uploadUri = String(cfg.ig_upload_session_id);
    }
    if (!uploadUri) {
      const container = await createInstagramReelsContainer(
        igAccountId,
        account.pageAccessToken,
        { caption },
      );
      containerId = container.containerId;
      uploadUri = container.uploadUri;
      providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
        ig_container_id: containerId,
        ig_upload_session_id: uploadUri,
        ig_upload_phase: "created",
      });
    }

    await uploadInstagramReelsVideo(uploadUri, account.pageAccessToken, videoBytes);
    providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
      ig_upload_phase: "uploaded",
    });
  }

  const { mediaId } = await publishInstagramContainerWhenReady(
    admin,
    schedule.id,
    providerConfig,
    {
      igAccountId,
      pageAccessToken: account.pageAccessToken,
      containerId,
    },
  );
  return finishPublished(mediaId);
}
