import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncPlanCompletionStateForPlan } from "../syncPlanCompletionStateDb.ts";

export type ClearTikTokPlanPublishStateResult = {
  linksDeleted: number;
  schedulesUpdated: number;
  locksRemoved: number;
};

export async function clearTikTokPlanPublishState(
  admin: SupabaseClient,
  args: {
    planId: string;
    openId: string;
  },
): Promise<ClearTikTokPlanPublishStateResult> {
  const planId = args.planId.trim();
  const openId = args.openId.trim();

  const { data: linkRows } = await admin
    .from("social_media_links")
    .select("id, platform_account_open_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "TikTok");

  const linksToDelete = (linkRows ?? []).filter((row) => {
    const rowOpenId = String(row.platform_account_open_id ?? "").trim();
    if (!rowOpenId) return true;
    return rowOpenId === openId;
  });

  let linksDeleted = 0;
  if (linksToDelete.length > 0) {
    const ids = linksToDelete.map((row) => row.id);
    const { error } = await admin.from("social_media_links").delete().in("id", ids);
    if (!error) linksDeleted = ids.length;
    else console.error("clearTikTokPlanPublishState links:", error.message);
  }

  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, status, provider_config, platform_account_id, external_post_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "TikTok")
    .neq("status", "cancelled");

  let schedulesUpdated = 0;
  const now = new Date().toISOString();

  for (const row of scheduleRows ?? []) {
    const rowOpenId =
      String(row.platform_account_id ?? "").trim()
      || String((row.provider_config as Record<string, unknown>)?.open_id ?? "").trim();
    const hasPost = Boolean(String(row.external_post_id ?? "").trim())
      || row.status === "published";
    if (rowOpenId && rowOpenId !== openId) continue;
    if (!rowOpenId && !hasPost) continue;

    const { error } = await admin
      .from("social_media_scheduled_posts")
      .update({
        status: "cancelled",
        error_message: "deleted_by_user",
        published_url: null,
        external_post_id: null,
        updated_at: now,
      })
      .eq("id", row.id);

    if (!error) schedulesUpdated += 1;
    else console.error("clearTikTokPlanPublishState schedule:", error.message);
  }

  const { data: lockRows, error: lockSelectErr } = await admin
    .from("social_media_plan_schedule_manual_locks")
    .delete()
    .eq("social_media_plan_id", planId)
    .eq("platform", "TikTok")
    .eq("platform_account_id", openId)
    .select("id");

  if (lockSelectErr) {
    console.error("clearTikTokPlanPublishState locks:", lockSelectErr.message);
  }

  const { count: remainingLinks } = await admin
    .from("social_media_links")
    .select("id", { count: "exact", head: true })
    .eq("social_media_plan_id", planId);

  if ((remainingLinks ?? 0) === 0) {
    await admin
      .from("social_media_plans")
      .update({ post_link_created_by: null, updated_at: now })
      .eq("id", planId);
  }

  await syncPlanCompletionStateForPlan(admin, planId);

  return {
    linksDeleted,
    schedulesUpdated,
    locksRemoved: lockRows?.length ?? 0,
  };
}
