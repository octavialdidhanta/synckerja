import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publicCarouselImageUrl } from "../metaContent/instagramCarouselPublishApi.ts";
import { CAROUSEL_PUBLISH_IMAGE_LIMIT } from "../tiktokCarouselImageUrl.ts";
import { getThreadsAccessToken } from "../threadsContentAuth.ts";
import {
  carouselMediaSnapshot,
  loadCarouselStoragePaths,
} from "./carouselImagePaths.ts";
import { resolveGoogleDrivePublicVideoUrl } from "./googleDrivePublicVideoUrl.ts";
import {
  isCarouselContentType,
  isPlanEligibleForThreadsAutoSchedule,
  isReelContentType,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import { publishThreadsCarousel } from "./threadsCarouselPublish.ts";
import { publishThreadsVideo } from "./threadsVideoPublish.ts";
import {
  createThreadsImageGraphCaller,
  publishThreadsSingleImage,
} from "./threadsImagePublish.ts";
import type { ScheduledPostRow, ThreadsProviderConfig } from "./scheduledPostTypes.ts";

type PlanRow = {
  id: string;
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
      "id, post_date, approved, production_approved, google_drive_link, post_link_created_by, content_type:content_types(name)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlanRow;
}

async function upsertThreadsLink(
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
    .eq("platform", "Threads")
    .maybeSingle();

  const payload = {
    platform: "Threads",
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

export async function executeThreadsScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
): Promise<{ published_url: string; external_post_id: string }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");

  const cfg = schedule.provider_config as ThreadsProviderConfig;
  const threadsUserId = String(cfg.threads_user_id ?? "").trim();
  if (!threadsUserId) throw new Error("missing_threads_user_id");

  const accessToken = await getThreadsAccessToken(admin, schedule.organization_id, threadsUserId);
  if (!accessToken) throw new Error("threads_account_not_found");
  const graph = createThreadsImageGraphCaller(accessToken);
  const contentTypeName = plan.content_type?.name ?? null;

  let published: { permalink: string; mediaId: string };
  if (isReelContentType(contentTypeName)) {
    if (!isPlanEligibleForThreadsAutoSchedule({
      post_date: plan.post_date,
      approved: plan.approved,
      production_approved: plan.production_approved,
      google_drive_link: plan.google_drive_link,
      content_type_name: contentTypeName,
    })) {
      throw new Error("plan_not_eligible");
    }
    if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
      throw new Error("google_drive_link_changed");
    }
    const videoUrl = resolveGoogleDrivePublicVideoUrl(plan.google_drive_link ?? "");
    if (!videoUrl) throw new Error("google_drive_file");
    published = await publishThreadsVideo(
      { threadsUserId, videoUrl, text: schedule.caption ?? "" },
      graph,
    );
  } else if (isCarouselContentType(contentTypeName)) {
    const storagePaths = await loadCarouselStoragePaths(admin, plan.id);
    if (storagePaths.length < 1) throw new Error("carousel_images");
    if (storagePaths.length > CAROUSEL_PUBLISH_IMAGE_LIMIT) throw new Error("carousel_image_limit");
    if (!isPlanEligibleForThreadsAutoSchedule({
      post_date: plan.post_date,
      approved: plan.approved,
      production_approved: plan.production_approved,
      google_drive_link: plan.google_drive_link,
      content_type_name: contentTypeName,
      carousel_image_count: storagePaths.length,
    })) {
      throw new Error("plan_not_eligible");
    }
    if (schedule.media_url_snapshot !== carouselMediaSnapshot(storagePaths)) {
      throw new Error("carousel_images_changed");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    if (!supabaseUrl) throw new Error("supabase_url_missing");
    const imageUrls = storagePaths.map((path) => publicCarouselImageUrl(supabaseUrl, path));
    published = imageUrls.length === 1
      ? await publishThreadsSingleImage(
        { threadsUserId, imageUrl: imageUrls[0], text: schedule.caption ?? "" },
        graph,
      )
      : await publishThreadsCarousel(
        { threadsUserId, imageUrls, text: schedule.caption ?? "" },
        graph,
      );
  } else {
    throw new Error("plan_not_eligible");
  }

  await upsertThreadsLink(admin, plan, {
    url: published.permalink,
    accountId: threadsUserId,
    accountLabel: String(cfg.account_label ?? "Threads"),
    externalPostId: published.mediaId,
    employeeId: cfg.employee_id,
  });

  return { published_url: published.permalink, external_post_id: published.mediaId };
}
