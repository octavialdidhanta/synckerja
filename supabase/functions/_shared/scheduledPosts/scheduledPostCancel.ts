import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function cancelPendingSchedulesForPlan(
  admin: SupabaseClient,
  planId: string,
  reason = "cancelled",
): Promise<number> {
  const { data, error } = await admin
    .from("social_media_scheduled_posts")
    .update({
      status: "cancelled",
      error_message: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("social_media_plan_id", planId)
    .in("status", ["pending", "publishing"])
    .select("id");

  if (error) {
    console.error("cancelPendingSchedulesForPlan:", error.message);
    return 0;
  }
  return (data ?? []).length;
}

export async function cancelScheduleById(
  admin: SupabaseClient,
  scheduleId: string,
  reason = "cancelled_by_user",
): Promise<boolean> {
  const { error } = await admin
    .from("social_media_scheduled_posts")
    .update({
      status: "cancelled",
      error_message: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId)
    .in("status", ["pending", "publishing"]);

  return !error;
}

function providerConfigAccountField(platform: string): string | null {
  switch (platform.trim()) {
    case "TikTok":
      return "open_id";
    case "YouTube":
      return "channel_id";
    case "Instagram":
      return "instagram_business_account_id";
    case "LinkedIn":
      return "page_id";
    default:
      return null;
  }
}

/** Cancel only pending/publishing schedules for the same platform + OAuth account on a plan. */
export async function cancelPendingSchedulesForPlatformAccount(
  admin: SupabaseClient,
  planId: string,
  platform: string,
  accountId: string,
): Promise<void> {
  const accountTrim = String(accountId ?? "").trim();
  if (!accountTrim) return;

  const configField = providerConfigAccountField(platform);
  if (!configField) {
    await admin
      .from("social_media_scheduled_posts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("social_media_plan_id", planId)
      .eq("platform", platform)
      .in("status", ["pending", "publishing"]);
    return;
  }

  const { error } = await admin
    .from("social_media_scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("social_media_plan_id", planId)
    .eq("platform", platform)
    .filter(`provider_config->>${configField}`, "eq", accountTrim)
    .in("status", ["pending", "publishing"]);

  if (error) {
    console.error("cancelPendingSchedulesForPlatformAccount:", error.message);
  }
}
