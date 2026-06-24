import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseYouTubeVideoIdFromUrl } from "../../youtubeContentPlanMatcher.ts";
import { getYouTubeContentAccessToken } from "../../youtubeContentOrgResolver.ts";
import { deleteYouTubeVideo } from "../../youtubeContent/youtubeContentDeleteApi.ts";
import { clearYouTubePlanPublishState } from "./clearYouTubePlanPublishState.ts";

export type DeleteYouTubePublishedPostResult =
  | {
    ok: true;
    already_deleted: boolean;
    nothing_to_delete_on_platform: boolean;
    cleanup: {
      linksDeleted: number;
      schedulesUpdated: number;
      locksRemoved: number;
    };
  }
  | { ok: false; error: string };

type ScheduleRow = {
  id: string;
  status: string;
  external_post_id: string | null;
  provider_config: Record<string, unknown> | null;
  platform_account_id: string | null;
  created_at: string;
};

type LinkRow = {
  id: string;
  url: string;
  external_post_id: string | null;
  platform_account_open_id: string | null;
};

async function resolveVideoId(
  admin: SupabaseClient,
  planId: string,
  channelId: string,
): Promise<string | null> {
  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, status, external_post_id, provider_config, platform_account_id, created_at")
    .eq("social_media_plan_id", planId)
    .eq("platform", "YouTube")
    .order("created_at", { ascending: false });

  const schedules = (scheduleRows ?? []) as ScheduleRow[];
  const matchingSchedules = schedules.filter((row) => {
    const rowChannel =
      String(row.platform_account_id ?? "").trim()
      || String(row.provider_config?.channel_id ?? "").trim();
    return !rowChannel || rowChannel === channelId;
  });

  for (const row of matchingSchedules) {
    const fromSchedule = String(row.external_post_id ?? "").trim();
    if (fromSchedule) return fromSchedule;
  }

  const { data: linkRows } = await admin
    .from("social_media_links")
    .select("id, url, external_post_id, platform_account_open_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "YouTube");

  const links = (linkRows ?? []) as LinkRow[];
  const matchingLinks = links.filter((row) => {
    const openId = String(row.platform_account_open_id ?? "").trim();
    return !openId || openId === channelId;
  });

  for (const link of matchingLinks) {
    const fromLink = String(link.external_post_id ?? "").trim()
      || parseYouTubeVideoIdFromUrl(String(link.url ?? ""));
    if (fromLink) return fromLink;
  }

  return null;
}

export async function deleteYouTubePublishedPost(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    planId: string;
    channelId: string;
  },
): Promise<DeleteYouTubePublishedPostResult> {
  const organizationId = args.organizationId.trim();
  const planId = args.planId.trim();
  const channelId = args.channelId.trim();

  if (!organizationId || !planId || !channelId) {
    return { ok: false, error: "missing_required_fields" };
  }

  const { data: plan } = await admin
    .from("social_media_plans")
    .select("id, organization_id")
    .eq("id", planId)
    .maybeSingle();

  if (!plan || plan.organization_id !== organizationId) {
    return { ok: false, error: "plan_not_found" };
  }

  const videoId = await resolveVideoId(admin, planId, channelId);
  let alreadyDeleted = false;

  if (videoId) {
    const accessToken = await getYouTubeContentAccessToken(admin, organizationId, channelId);
    if (!accessToken) {
      return { ok: false, error: "youtube_token_missing" };
    }

    const deleteResult = await deleteYouTubeVideo(accessToken, videoId);
    if (!deleteResult.ok) {
      return { ok: false, error: deleteResult.error };
    }
    alreadyDeleted = deleteResult.alreadyDeleted;
  }

  const cleanup = await clearYouTubePlanPublishState(admin, { planId, channelId });

  return {
    ok: true,
    already_deleted: alreadyDeleted,
    nothing_to_delete_on_platform: !videoId,
    cleanup,
  };
}
