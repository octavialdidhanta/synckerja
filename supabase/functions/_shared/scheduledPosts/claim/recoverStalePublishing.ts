import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STUCK_PUBLISHING_MINUTES } from "../monitoring/thresholds.ts";

export async function recoverStalePublishingRows(
  admin: SupabaseClient,
  staleMinutes = STUCK_PUBLISHING_MINUTES,
): Promise<number> {
  const { data, error } = await admin.rpc("recover_stale_publishing_rows", {
    p_stale_minutes: staleMinutes,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
