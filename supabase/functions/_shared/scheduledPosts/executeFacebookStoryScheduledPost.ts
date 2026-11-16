import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import { facebookPublishScopesOk } from "../metaPlatformScopes.ts";
import {
  buildFacebookPhotoPostUrl,
  fetchFacebookPostPermalink,
  uploadFacebookPagePhoto,
} from "../metaContent/facebookCarouselPublishApi.ts";
import {
  buildFacebookStoryUrl,
  publishFacebookPagePhotoStory,
} from "../metaContent/facebookStoriesPublishApi.ts";
import { instagramStoryImageUrl } from "../metaContent/instagramStoriesPublishApi.ts";
import { touchPublishingHeartbeat } from "./publishingHeartbeat.ts";
import {
  isPlanEligibleForInstagramStorySchedule,
  isStoryContentType,
} from "./storyPublishEligibility.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import type { FacebookProviderConfig, ScheduledPostRow } from "./scheduledPostTypes.ts";

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

export async function executeFacebookStoryScheduledPost(
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

  const cfg = schedule.provider_config as FacebookProviderConfig;
  const pageId = String(cfg.facebook_page_id ?? "").trim();
  if (!pageId) throw new Error("missing_facebook_page_id");

  const account = await resolveMetaContentAccount(
    admin,
    schedule.organization_id,
    "facebook",
    pageId,
  );
  if (!account?.pageAccessToken) throw new Error("facebook_page_not_found");
  if (!facebookPublishScopesOk(account.grantedScopes)) {
    throw new Error("publish_scopes_not_granted");
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };
  const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Facebook");
  const heartbeat = () => touchPublishingHeartbeat(admin, [schedule.id]);

  const existingPhotoId = Array.isArray(cfg.fb_photo_ids) && cfg.fb_photo_ids.length > 0
    ? String(cfg.fb_photo_ids[0] ?? "").trim()
    : "";

  let photoId = existingPhotoId;
  if (!photoId) {
    const imageUrl = instagramStoryImageUrl(exportPath);
    providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
      publish_step: "uploading",
      fb_upload_phase: "photos",
    });
    await heartbeat();
    const uploaded = await uploadFacebookPagePhoto(pageId, account.pageAccessToken, {
      imageUrl,
      published: false,
    });
    photoId = uploaded.photoId;
    providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
      fb_photo_ids: [photoId],
      fb_upload_phase: "photos",
      publish_step: "processing",
    });
  }

  await heartbeat();
  const story = await publishFacebookPagePhotoStory(pageId, account.pageAccessToken, photoId);
  providerConfig = await persistFacebookProviderConfig(admin, schedule.id, providerConfig, {
    fb_photo_ids: [photoId],
    fb_carousel_post_id: story.postId,
    fb_upload_phase: "published",
    publish_step: "done",
  });

  const permalink = await fetchFacebookPostPermalink(story.postId, account.pageAccessToken);
  const publishedUrl = permalink
    ?? buildFacebookStoryUrl(story.postId)
    ?? buildFacebookPhotoPostUrl(story.postId);

  await upsertFacebookLink(admin, plan, {
    url: publishedUrl,
    accountId: pageId,
    accountLabel,
    externalPostId: story.postId,
    employeeId: cfg.employee_id,
  });

  console.info(`facebook_publish_path=stories scheduleId=${schedule.id}`);
  return { published_url: publishedUrl, external_post_id: story.postId };
}
