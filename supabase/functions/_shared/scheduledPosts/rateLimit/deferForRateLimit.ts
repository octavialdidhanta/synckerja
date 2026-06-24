import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  INTERNAL_DEFER_JITTER_SECONDS,
  INTERNAL_DEFER_SECONDS,
  type RateLimitDeferReason,
} from "./rateLimitConfig.ts";
import {
  isInstagramResumeRow,
  isLinkedInResumeRow,
  isPublishResumeRow,
  isTikTokResumeRow,
  isYouTubeResumeRow,
  stripPublishResumeFlags,
} from "./publishResume.ts";

function computeDeferAt(): string {
  const jitter = Math.floor(Math.random() * (INTERNAL_DEFER_JITTER_SECONDS * 2 + 1))
    - INTERNAL_DEFER_JITTER_SECONDS;
  const seconds = Math.max(30, INTERNAL_DEFER_SECONDS + jitter);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function deferForRateLimit(
  admin: SupabaseClient,
  scheduleId: string,
  reason: RateLimitDeferReason,
): Promise<string> {
  const nextRetryAt = computeDeferAt();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("social_media_scheduled_posts")
    .update({
      status: "pending",
      locked_at: null,
      next_retry_at: nextRetryAt,
      error_message: reason,
      updated_at: now,
    })
    .eq("id", scheduleId)
    .eq("status", "publishing");

  if (error) throw new Error(error.message);
  return nextRetryAt;
}

export {
  isInstagramResumeRow,
  isLinkedInResumeRow,
  isPublishResumeRow,
  isTikTokResumeRow,
  isYouTubeResumeRow,
  stripPublishResumeFlags,
};
