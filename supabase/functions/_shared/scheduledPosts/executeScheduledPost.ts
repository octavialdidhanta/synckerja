import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { shouldDryRunPublish } from "./dryRun/shouldDryRunPublish.ts";
import { executeDryRunScheduledPost } from "./executeDryRunScheduledPost.ts";
import {
  getPlatformScheduleCapability,
  normalizeSchedulePlatform,
} from "./platformRegistry.ts";
import { buildScheduleStubError } from "./platforms/stubErrors.ts";
import { executeTikTokScheduledPost } from "./platforms/tiktok.ts";
import { executeInstagramScheduledPost } from "./platforms/instagram.ts";
import { executeFacebookScheduledPostStub } from "./platforms/facebook.ts";
import { executeYouTubeScheduledPost } from "./platforms/youtube.ts";
import { executeLinkedInScheduledPost } from "./platforms/linkedin.ts";
import type { ScheduledPostRow } from "./scheduledPostTypes.ts";

export type ExecuteScheduledPostResult = {
  published_url: string;
  external_post_id: string;
};

export async function executeScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
): Promise<ExecuteScheduledPostResult> {
  const platform = normalizeSchedulePlatform(schedule.platform);
  const capability = getPlatformScheduleCapability(platform);

  if (!capability) {
    throw new Error(
      buildScheduleStubError("not_implemented", platform, schedule.delivery_mode ?? "unknown"),
    );
  }

  if (!capability.implemented) {
    throw new Error(
      buildScheduleStubError(capability.stubCode, platform, capability.deliveryMode),
    );
  }

  if (shouldDryRunPublish(schedule)) {
    return executeDryRunScheduledPost(schedule);
  }

  switch (platform) {
    case "TikTok":
      return executeTikTokScheduledPost(admin, schedule);
    case "Instagram":
      return executeInstagramScheduledPost(admin, schedule);
    case "Facebook":
      return executeFacebookScheduledPostStub();
    case "YouTube":
      return executeYouTubeScheduledPost(admin, schedule);
    case "LinkedIn":
      return executeLinkedInScheduledPost(admin, schedule);
    default:
      throw new Error(
        buildScheduleStubError("not_implemented", platform, schedule.delivery_mode ?? "unknown"),
      );
  }
}
