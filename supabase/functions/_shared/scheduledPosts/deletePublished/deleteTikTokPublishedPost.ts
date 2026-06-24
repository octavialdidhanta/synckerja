import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clearTikTokPlanPublishState } from "./clearTikTokPlanPublishState.ts";

export type DeleteTikTokPublishedPostResult =
  | {
    ok: true;
    platform_only_db_cleanup: true;
    nothing_to_delete_on_platform: boolean;
    cleanup: {
      linksDeleted: number;
      schedulesUpdated: number;
      locksRemoved: number;
    };
  }
  | { ok: false; error: string };

export async function deleteTikTokPublishedPost(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    planId: string;
    openId: string;
  },
): Promise<DeleteTikTokPublishedPostResult> {
  const organizationId = args.organizationId.trim();
  const planId = args.planId.trim();
  const openId = args.openId.trim();

  if (!organizationId || !planId || !openId) {
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

  const { data: linkRows } = await admin
    .from("social_media_links")
    .select("id, url, external_post_id, platform_account_open_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "TikTok");

  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, external_post_id, platform_account_id, provider_config, status")
    .eq("social_media_plan_id", planId)
    .eq("platform", "TikTok")
    .neq("status", "cancelled");

  const hasMatchingLink = (linkRows ?? []).some((row) => {
    const rowOpenId = String(row.platform_account_open_id ?? "").trim();
    return !rowOpenId || rowOpenId === openId;
  });

  const hasMatchingSchedule = (scheduleRows ?? []).some((row) => {
    const rowOpenId =
      String(row.platform_account_id ?? "").trim()
      || String((row.provider_config as Record<string, unknown>)?.open_id ?? "").trim();
    return !rowOpenId || rowOpenId === openId;
  });

  const nothingOnPlatform = !hasMatchingLink && !hasMatchingSchedule;

  const cleanup = await clearTikTokPlanPublishState(admin, { planId, openId });

  return {
    ok: true,
    platform_only_db_cleanup: true,
    nothing_to_delete_on_platform: nothingOnPlatform,
    cleanup,
  };
}
