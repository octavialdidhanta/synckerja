import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function countGlobalInFlightPublishing(
  admin: SupabaseClient,
  platform: string,
): Promise<number> {
  const { count, error } = await admin
    .from("social_media_scheduled_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "publishing")
    .eq("platform", platform);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
