import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PER_ORG_PER_TICK } from "../rateLimit/rateLimitConfig.ts";
import type { ScheduledPostRow } from "../scheduledPostTypes.ts";

export async function claimDueScheduledPosts(
  admin: SupabaseClient,
  limit: number,
  perOrgLimit = PER_ORG_PER_TICK,
): Promise<ScheduledPostRow[]> {
  const { data, error } = await admin.rpc("claim_due_scheduled_posts", {
    p_limit: limit,
    p_per_org_limit: perOrgLimit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledPostRow[];
}

export async function claimResumePublishingPosts(
  admin: SupabaseClient,
  limit = 10,
): Promise<ScheduledPostRow[]> {
  const { data, error } = await admin.rpc("claim_resume_publishing_posts", {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledPostRow[];
}
