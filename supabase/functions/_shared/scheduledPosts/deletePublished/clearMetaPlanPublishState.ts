import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncPlanCompletionStateForPlan } from "../syncPlanCompletionStateDb.ts";

export type ClearMetaPlanPublishStateResult = {
  linksDeleted: number;
  schedulesUpdated: number;
  locksRemoved: number;
};

export async function clearMetaPlanPublishState(
  admin: SupabaseClient,
  args: {
    planId: string;
    platform: "Instagram" | "Facebook";
    accountId: string;
  },
): Promise<ClearMetaPlanPublishStateResult> {
  const planId = args.planId.trim();
  const platform = args.platform;
  const accountId = args.accountId.trim();

  const { data: linkRows } = await admin
    .from("social_media_links")
    .select("id, platform_account_open_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", platform);

  const linksToDelete = (linkRows ?? []).filter((row) => {
    const openId = String(row.platform_account_open_id ?? "").trim();
    if (!openId) return true;
    return openId === accountId;
  });

  let linksDeleted = 0;
  if (linksToDelete.length > 0) {
    const ids = linksToDelete.map((row) => row.id);
    const { error } = await admin.from("social_media_links").delete().in("id", ids);
    if (!error) linksDeleted = ids.length;
    else console.error("clearMetaPlanPublishState links:", error.message);
  }

  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, status, provider_config, platform_account_id, external_post_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", platform)
    .neq("status", "cancelled");

  let schedulesUpdated = 0;
  const now = new Date().toISOString();
  const accountKey = platform === "Instagram"
    ? "instagram_business_account_id"
    : "facebook_page_id";

  for (const row of scheduleRows ?? []) {
    const rowAccount =
      String(row.platform_account_id ?? "").trim()
      || String((row.provider_config as Record<string, unknown>)?.[accountKey] ?? "").trim();
    const hasPost = Boolean(String(row.external_post_id ?? "").trim())
      || row.status === "published";
    if (rowAccount && rowAccount !== accountId) continue;
    if (!rowAccount && !hasPost) continue;

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
    else console.error("clearMetaPlanPublishState schedule:", error.message);
  }

  const { data: lockRows, error: lockSelectErr } = await admin
    .from("social_media_plan_schedule_manual_locks")
    .delete()
    .eq("social_media_plan_id", planId)
    .eq("platform", platform)
    .eq("platform_account_id", accountId)
    .select("id");

  if (lockSelectErr) {
    console.error("clearMetaPlanPublishState locks:", lockSelectErr.message);
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
