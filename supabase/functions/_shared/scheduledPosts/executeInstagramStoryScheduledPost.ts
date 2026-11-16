import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import {
  createInstagramStoriesImageContainer,
  instagramStoryImageUrl,
} from "../metaContent/instagramStoriesPublishApi.ts";
import {
  fetchInstagramMediaPermalink,
  publishInstagramReelsContainer,
  waitForInstagramReelsContainerReady,
} from "../metaContent/metaReelsPublishApi.ts";
import { touchPublishingHeartbeat } from "./publishingHeartbeat.ts";
import {
  isPlanEligibleForInstagramStorySchedule,
  isStoryContentType,
} from "./storyPublishEligibility.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import type { InstagramProviderConfig, ScheduledPostRow } from "./scheduledPostTypes.ts";

const INSTAGRAM_PUBLISH_SCOPES = ["instagram_content_publish"] as const;
export const MEDIA_SOURCE_STORY_EXPORT = "story_export";

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
  content_type?: { name?: string } | null;
};

async function loadStoryPlan(admin: SupabaseClient, planId: string): Promise<PlanRow | null> {
  const { data, error } = await admin
    .from("social_media_plans")
    .select(
      "id, organization_id, post_date, approved, production_approved, post_link_created_by, content_type:content_types(name)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlanRow;
}

async function loadStoryExportPath(admin: SupabaseClient, planId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("canva_story_runs")
    .select("export_path, images_ready")
    .eq("social_media_plan_id", planId)
    .maybeSingle();
  if (error || !data || data.images_ready !== true) return null;
  const path = String(data.export_path ?? "").trim();
  return path || null;
}

async function persistInstagramProviderConfig(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
  patch: Partial<InstagramProviderConfig>,
): Promise<Record<string, unknown>> {
  const next = { ...base, ...patch };
  const now = new Date().toISOString();
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, locked_at: now, updated_at: now })
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

export async function executeInstagramStoryScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const plan = await loadStoryPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");
  if (!isStoryContentType(plan.content_type?.name)) {
    throw new Error("content_type_story");
  }

  const exportPath = await loadStoryExportPath(admin, plan.id);
  if (!isPlanEligibleForInstagramStorySchedule({
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    content_type_name: plan.content_type?.name ?? null,
    export_path: exportPath,
  })) {
    throw new Error("plan_not_eligible");
  }

  const snapshot = String(schedule.media_url_snapshot ?? "").trim();
  if (!exportPath || !snapshot || snapshot !== exportPath) {
    throw new Error("story_export_changed");
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
  if (!account?.pageAccessToken) throw new Error("instagram_account_not_found");
  if (!metaScopesIncludePublish(account.grantedScopes)) {
    throw new Error("publish_scopes_not_granted");
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };
  const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Instagram");
  const heartbeat = () => touchPublishingHeartbeat(admin, [schedule.id]);

  const finishPublished = async (mediaId: string) => {
    const permalink = await fetchInstagramMediaPermalink(mediaId, account.pageAccessToken);
    const publishedUrl = permalink ?? `https://www.instagram.com/stories/`;
    await upsertInstagramLink(admin, plan, {
      url: publishedUrl,
      accountId: igAccountId,
      accountLabel,
      externalPostId: mediaId,
      employeeId: cfg.employee_id,
    });
    return { published_url: publishedUrl, external_post_id: mediaId };
  };

  const publishContainer = async (containerId: string) => {
    try {
      providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
        publish_step: "processing",
      });
      await waitForInstagramReelsContainerReady(containerId, account.pageAccessToken, {
        maxWaitMs: 60_000,
        intervalMs: 2_000,
        onTick: heartbeat,
      });
      const { mediaId } = await publishInstagramReelsContainer(
        igAccountId,
        account.pageAccessToken,
        containerId,
      );
      return finishPublished(mediaId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes("meta_reels_container_error")
        || message.toLowerCase().includes("meta_reels_container_expired")
      ) {
        await clearInstagramUploadState(admin, schedule.id, providerConfig);
      }
      throw err;
    }
  };

  if (cfg.ig_container_id && cfg.ig_upload_phase === "uploaded") {
    console.info(
      `instagram_publish_path=stories scheduleId=${schedule.id} resume=1`,
    );
    return publishContainer(cfg.ig_container_id);
  }

  if (cfg.ig_container_id) {
    providerConfig = await clearInstagramUploadState(admin, schedule.id, providerConfig);
  }

  const imageUrl = instagramStoryImageUrl(exportPath);
  const created = await createInstagramStoriesImageContainer(
    igAccountId,
    account.pageAccessToken,
    { imageUrl },
  );
  providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
    ig_container_id: created.containerId,
    ig_upload_phase: "uploaded",
    publish_step: "processing",
  });
  console.info(`instagram_publish_path=stories scheduleId=${schedule.id}`);
  return publishContainer(created.containerId);
}
