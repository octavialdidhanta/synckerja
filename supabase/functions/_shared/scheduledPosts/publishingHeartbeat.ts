import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Refresh locked_at while a worker is alive.
 * Stall recovery treats a publishing row with no heartbeat as stuck, not still uploading.
 */
export async function touchPublishingHeartbeat(
  admin: SupabaseClient,
  scheduleIds: string[],
): Promise<void> {
  const ids = [...new Set(scheduleIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("social_media_scheduled_posts")
    .update({ locked_at: now, updated_at: now })
    .in("id", ids)
    .eq("status", "publishing");
  if (error) {
    console.warn(`publishing_heartbeat_failed: ${error.message}`);
  }
}
