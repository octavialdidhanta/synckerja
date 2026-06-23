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
